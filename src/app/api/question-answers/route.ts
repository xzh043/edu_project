import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// GET: 获取答题详情（题目+学生答案）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const submissionId = searchParams.get('submission_id');

    if (!submissionId) {
      return NextResponse.json({ error: '缺少提交ID' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // 获取提交记录
    const { data: submission, error: subError } = await supabase
      .from('assignment_submissions')
      .select('*, student_id')
      .eq('id', submissionId)
      .single();

    if (subError || !submission) {
      return NextResponse.json({ error: '提交记录不存在' }, { status: 404 });
    }

    // 获取学生信息（班级名和学号）
    let studentClassName = '';
    let studentNumber = '';
    
    // 先通过 profiles 表查找学生学号（submission.student_id 是 profiles.user_id）
    const { data: profile } = await supabase
      .from('profiles')
      .select('student_id')
      .eq('user_id', submission.student_id)
      .single();
    
    console.log('submission.student_id:', submission.student_id);
    console.log('profile:', profile);
    
    if (profile?.student_id) {
      studentNumber = profile.student_id;
      // 再用学号去 students 表查询班级信息
      const { data: student } = await supabase
        .from('students')
        .select('class_id')
        .eq('student_number', studentNumber)
        .single();
      console.log('student:', student);
      if (student) {
        const { data: classData } = await supabase
          .from('classes')
          .select('name')
          .eq('id', student.class_id)
          .single();
        console.log('classData:', classData);
        if (classData) {
          studentClassName = classData.name;
        }
      }
    }
    
    console.log('studentClassName:', studentClassName);
    console.log('studentNumber:', studentNumber);

    // 获取题目
    const { data: allQuestions, error: qError } = await supabase
      .from('questions')
      .select('*')
      .eq('assignment_id', submission.assignment_id)
      .order('sort_order', { ascending: true });

    if (qError) {
      return NextResponse.json({ error: '查询题目失败' }, { status: 500 });
    }

    // 筛选该学生需要作答的题目
    const filteredQuestions = (allQuestions || []).filter(q => {
      // 老师下发作业 - category 为空或为 'teacher_assignment' 或包含"下发作业"或"老师下发作业"
      if (!q.category || q.category === '' || q.category === 'teacher_assignment' || q.category.includes('下发作业') || q.category.includes('老师下发作业')) {
        return true;
      }
      
      // 班级共性作业 - category 为 'class_assignment' 或 'class_assignment-xxx' 或包含"班级共性作业" 且班级匹配
      if (q.category === 'class_assignment' || q.category.startsWith('class_assignment-') || q.category.includes('班级共性作业')) {
        // 优先使用 class_name 字段，否则从 category 中提取
        let questionClassName = q.class_name || '';
        if (!questionClassName && q.category.startsWith('class_assignment-')) {
          questionClassName = q.category.substring('class_assignment-'.length);
        }
        return questionClassName === studentClassName;
      }
      
      // 个性化作业 - category 为 'personal_assignment' 或 'personal_assignment-xxx' 或包含"个性化作业" 且学号匹配
      if (q.category === 'personal_assignment' || q.category.startsWith('personal_assignment-') || q.category.includes('个性化作业')) {
        // 优先使用 student_number 字段，否则从 category 中提取
        let questionStudentNumber = q.student_number || '';
        if (!questionStudentNumber && q.category.startsWith('personal_assignment-')) {
          questionStudentNumber = q.category.substring('personal_assignment-'.length);
        }
        return questionStudentNumber === studentNumber;
      }
      
      return false;
    });

    // 获取学生答案
    const { data: answers } = await supabase
      .from('question_answers')
      .select('*')
      .eq('submission_id', submissionId);

    const answerMap = new Map((answers || []).map(a => [a.question_id, a]));

    // 组装：题目 + 答案，重新编号题号
    const result = {
      submission,
      questions: filteredQuestions.map((q, index) => {
        const ans = answerMap.get(q.id);
        return {
          ...q,
          question_id: index + 1,
          student_answer: ans?.student_answer || null,
          is_correct: ans?.is_correct ?? null,
          score: ans?.score ?? null,
          answer_id: ans?.id || null,
        };
      }),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('获取答题详情失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// PUT: 保存单题答案（实时保存）
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { submission_id, question_id, student_answer } = body;

    if (!submission_id || !question_id) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('question_answers')
      .upsert({
        submission_id,
        question_id,
        student_answer: student_answer || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'submission_id,question_id' })
      .select()
      .single();

    if (error) {
      console.error('保存答案失败:', error);
      return NextResponse.json({ error: '保存答案失败' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('保存答案失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
