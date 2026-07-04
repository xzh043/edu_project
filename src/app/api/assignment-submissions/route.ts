import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// GET: 查询提交记录
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const assignmentId = searchParams.get('assignment_id');
    const studentId = searchParams.get('student_id');

    const supabase = getSupabaseClient();
    let query = supabase.from('assignment_submissions').select('*');

    if (id) {
      query = query.eq('id', id);
    } else if (assignmentId && studentId) {
      query = query.eq('assignment_id', assignmentId).eq('student_id', studentId);
    } else if (assignmentId) {
      query = query.eq('assignment_id', assignmentId);
    } else {
      return NextResponse.json({ error: '缺少查询参数' }, { status: 400 });
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (id) {
      return NextResponse.json(data?.[0] || null);
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error('查询提交记录失败:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// POST: 开始答题（创建 submission）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { assignment_id, student_id, student_number, student_name } = body;

    if (!assignment_id || !student_id) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // 检查是否已有提交记录
    const { data: existing } = await supabase
      .from('assignment_submissions')
      .select('*')
      .eq('assignment_id', assignment_id)
      .eq('student_id', student_id)
      .single();

    if (existing) {
      return NextResponse.json(existing);
    }

    // 获取题目信息
    const { data: allQuestions } = await supabase
      .from('questions')
      .select('id, answer, category, class_name, student_number')
      .eq('assignment_id', assignment_id);

    // 获取学生信息（班级名和学号）用于筛选题目
    let studentClassName = '';
    let studentNumberValue = student_number || '';
    if (!studentNumberValue) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('student_id')
        .eq('user_id', student_id)
        .single();
      if (profile?.student_id) {
        studentNumberValue = profile.student_id;
      }
    }
    if (studentNumberValue) {
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

    // 筛选该学生的题目
    const studentQuestions = (allQuestions || []).filter(q => {
      if (!q.category || q.category === '' || q.category === 'teacher_assignment' || q.category.includes('下发作业') || q.category.includes('老师下发作业')) {
        return true;
      }
      if (q.category === 'class_assignment' || q.category.startsWith('class_assignment-') || q.category.includes('班级共性作业')) {
        let questionClassName = q.class_name || '';
        if (!questionClassName && q.category.startsWith('class_assignment-')) {
          questionClassName = q.category.substring('class_assignment-'.length);
        }
        return questionClassName === studentClassName;
      }
      if (q.category === 'personal_assignment' || q.category.startsWith('personal_assignment-') || q.category.includes('个性化作业')) {
        let questionStudentNumber = q.student_number || '';
        if (!questionStudentNumber && q.category.startsWith('personal_assignment-')) {
          questionStudentNumber = q.category.substring('personal_assignment-'.length);
        }
        return questionStudentNumber === studentNumberValue;
      }
      return false;
    });

    const maxScore = studentQuestions.length;

    // 创建提交记录
    const { data, error } = await supabase
      .from('assignment_submissions')
      .insert({
        assignment_id,
        student_id,
        student_number: student_number || '',
        student_name: student_name || '',
        status: 'in_progress',
        max_score: maxScore,
      })
      .select()
      .single();

    if (error) {
      console.error('创建提交记录失败:', error);
      return NextResponse.json({ error: '创建提交记录失败' }, { status: 500 });
    }

    // 如果带 answers，直接提交并批改
    const { answers } = body;
    if (answers && Array.isArray(answers) && answers.length > 0) {
      const questionMap = new Map(studentQuestions.map((q: { id: string; answer: string }) => [q.id, q.answer]));
      let totalScore = 0;
      const answerRecords = answers.map((a: { question_id: string; student_answer: string }, index: number) => {
        const correctAnswer = questionMap.get(a.question_id);
        const isCorrect = correctAnswer && a.student_answer === correctAnswer;
        if (isCorrect) totalScore++;
        return {
          submission_id: data.id,
          question_id: a.question_id,
          student_answer: a.student_answer,
          is_correct: isCorrect,
          score: isCorrect ? 1 : 0,
        };
      });

      // 保存答案
      const { error: answerError } = await supabase
        .from('question_answers')
        .insert(answerRecords);

      if (answerError) {
        console.error('保存答案失败:', answerError);
      }

      // 更新提交记录为已批改
      const { data: updatedData } = await supabase
        .from('assignment_submissions')
        .update({
          status: 'graded',
          total_score: totalScore,
          submitted_at: new Date().toISOString(),
          graded_at: new Date().toISOString(),
        })
        .eq('id', data.id)
        .select()
        .single();

      return NextResponse.json(updatedData || data);
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('开始答题失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// PUT: 提交答案
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { submission_id, answers } = body;

    if (!submission_id || !answers || !Array.isArray(answers)) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // 获取提交记录
    const { data: submission } = await supabase
      .from('assignment_submissions')
      .select('id, assignment_id, status')
      .eq('id', submission_id)
      .single();

    if (!submission) {
      return NextResponse.json({ error: '提交记录不存在' }, { status: 404 });
    }

    if (submission.status === 'submitted' || submission.status === 'graded') {
      return NextResponse.json({ error: '作业已提交，不能重复提交' }, { status: 400 });
    }

    // 获取正确答案
    const { data: questions } = await supabase
      .from('questions')
      .select('id, answer, type')
      .eq('assignment_id', submission.assignment_id);

    const questionMap = new Map((questions || []).map(q => [q.id, q]));

    // 批量保存/更新答案并判分（客观题自动判分）
    let totalScore = 0;
    for (const ans of answers) {
      const question = questionMap.get(ans.question_id);
      const isCorrect = question ? (ans.student_answer === question.answer) : false;
      const score = isCorrect ? 1 : 0;
      totalScore += score;

      // upsert answer
      const { error: upsertError } = await supabase
        .from('question_answers')
        .upsert({
          submission_id,
          question_id: ans.question_id,
          student_answer: ans.student_answer || null,
          is_correct: isCorrect,
          score: score,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'submission_id,question_id' });

      if (upsertError) {
        console.error('保存答案失败:', upsertError);
      }
    }

    // 更新提交记录
    const { data, error } = await supabase
      .from('assignment_submissions')
      .update({
        status: 'graded',
        total_score: totalScore,
        submitted_at: new Date().toISOString(),
        graded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', submission_id)
      .select()
      .single();

    if (error) {
      console.error('更新提交记录失败:', error);
      return NextResponse.json({ error: '更新提交记录失败' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('提交答案失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
