import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function POST() {
  try {
    const supabase = getSupabaseClient();

    const { data: submissions } = await supabase
      .from('assignment_submissions')
      .select('id, assignment_id, student_id, student_number, max_score');

    for (const sub of submissions || []) {
      console.log(`Processing submission: ${sub.id}`);
      
      const { data: allQuestions } = await supabase
        .from('questions')
        .select('id, category, class_name, student_number')
        .eq('assignment_id', sub.assignment_id);

      let studentClassName = '';
      let studentNumberValue = sub.student_number || '';
      if (!studentNumberValue) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('student_id')
          .eq('user_id', sub.student_id)
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

      const correctMaxScore = studentQuestions.length;
      if (correctMaxScore !== sub.max_score) {
        console.log(`Updating ${sub.id}: max_score ${sub.max_score} -> ${correctMaxScore}`);
        await supabase
          .from('assignment_submissions')
          .update({ max_score: correctMaxScore })
          .eq('id', sub.id);
      }
    }

    return NextResponse.json({ success: true, message: '分数已修复' });
  } catch (err) {
    console.error('修复分数失败:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}