import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// GET: 获取学生的作业列表（含答题状态）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('student_id');
    const studentNumber = searchParams.get('student_number');
    const status = searchParams.get('status'); // pending, completed

    if (!studentId && !studentNumber) {
      return NextResponse.json({ error: '缺少学生ID或学号' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // If only student_number provided, look up student_id
    let resolvedStudentId = studentId;
    if (!resolvedStudentId && studentNumber) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('student_id', studentNumber)
        .single();
      if (profile) {
        resolvedStudentId = profile.user_id;
      } else {
        return NextResponse.json([], { status: 200 });
      }
    }

    // 获取学生信息（班级名和学号）
    let studentClassName = '';
    let studentNumberValue = studentNumber || '';
    
    // 先通过 profiles 表查找学生学号（resolvedStudentId 是 profiles.user_id）
    const { data: profile } = await supabase
      .from('profiles')
      .select('student_id')
      .eq('user_id', resolvedStudentId)
      .single();
    
    if (profile?.student_id) {
      studentNumberValue = profile.student_id;
      // 再用学号去 students 表查询班级信息
      const { data: student } = await supabase
        .from('students')
        .select('class_id')
        .eq('student_number', studentNumberValue)
        .single();
      if (student) {
        const { data: classData } = await supabase
          .from('classes')
          .select('name')
          .eq('id', student.class_id)
          .single();
        if (classData) {
          studentClassName = classData.name;
        }
      }
    }

    // 获取已发布的作业
    let assignmentsQuery = supabase
      .from('assignments')
      .select('id, name, type, chapters, knowledge_points, xzt_cnt, pdt_cnt, deadline, publish_time, created_by, created_at')
      .eq('status', 'published')
      .order('publish_time', { ascending: false });

    const { data: assignments, error: assignmentsError } = await assignmentsQuery;
    if (assignmentsError) {
      return NextResponse.json({ error: '查询作业失败' }, { status: 500 });
    }

    // 获取该学生的提交记录
    const { data: submissions } = await supabase
      .from('assignment_submissions')
      .select('id, assignment_id, status, total_score, max_score, submitted_at, graded_at')
      .eq('student_id', resolvedStudentId);

    const submissionMap = new Map((submissions || []).map(s => [s.assignment_id, s]));

    // 获取所有题目，用于统计每个作业该学生的实际题目数
    const { data: allQuestions } = await supabase
      .from('questions')
      .select('assignment_id, type, category, class_name, student_number');

    // 组装结果
    let result = (assignments || []).map(a => {
      const sub = submissionMap.get(a.id);
      
      // 统计该学生在这个作业中的实际题目数
      const studentQuestions = (allQuestions || []).filter(q => {
        if (q.assignment_id !== a.id) return false;
        // 老师下发作业
        if (!q.category || q.category === '' || q.category === 'teacher_assignment' || q.category.includes('下发作业') || q.category.includes('老师下发作业')) {
          return true;
        }
        // 班级共性作业
        if (q.category === 'class_assignment' || q.category.startsWith('class_assignment-') || q.category.includes('班级共性作业')) {
          let questionClassName = q.class_name || '';
          if (!questionClassName && q.category.startsWith('class_assignment-')) {
            questionClassName = q.category.substring('class_assignment-'.length);
          }
          return questionClassName === studentClassName;
        }
        // 个性化作业
        if (q.category === 'personal_assignment' || q.category.startsWith('personal_assignment-') || q.category.includes('个性化作业')) {
          let questionStudentNumber = q.student_number || '';
          if (!questionStudentNumber && q.category.startsWith('personal_assignment-')) {
            questionStudentNumber = q.category.substring('personal_assignment-'.length);
          }
          return questionStudentNumber === studentNumberValue;
        }
        return false;
      });
      
      const actualXztCnt = studentQuestions.filter(q => q.type === 1).length;
      const actualPdtCnt = studentQuestions.filter(q => q.type === 2).length;

      return {
        assignment_id: a.id,
        name: a.name,
        type: a.type,
        chapters: a.chapters,
        knowledge_points: a.knowledge_points,
        xzt_cnt: actualXztCnt,
        pdt_cnt: actualPdtCnt,
        deadline: a.deadline,
        publish_time: a.publish_time,
        created_by: a.created_by,
        created_at: a.created_at,
        // 答题状态
        submission_id: sub?.id || null,
        submission_status: sub?.status || null, // null=未开始, in_progress, submitted, graded
        total_score: sub?.total_score ?? null,
        max_score: sub?.max_score ?? null,
        submitted_at: sub?.submitted_at || null,
        graded_at: sub?.graded_at || null,
      };
    });

    // 按状态过滤
    if (status === 'pending') {
      result = result.filter(r => !r.submission_status || r.submission_status === 'in_progress');
    } else if (status === 'completed') {
      result = result.filter(r => r.submission_status === 'submitted' || r.submission_status === 'graded');
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('获取学生作业列表失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
