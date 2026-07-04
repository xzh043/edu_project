import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// GET: 获取作业的学生完成情况统计
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const assignmentId = searchParams.get('assignment_id');

    if (!assignmentId) {
      return NextResponse.json({ error: '缺少作业ID' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // 1. 获取作业信息
    const { data: assignment, error: assignError } = await supabase
      .from('assignments')
      .select('id, name, type, status, chapters, knowledge_points, xzt_cnt, pdt_cnt, deadline, publish_time, created_by, created_at')
      .eq('id', assignmentId)
      .maybeSingle();

    if (assignError || !assignment) {
      return NextResponse.json({ error: '作业不存在' }, { status: 404 });
    }

    // 2. 获取题目
    const { data: questions } = await supabase
      .from('questions')
      .select('id, question_id, type, title, options, answer, analysis, sort_order')
      .eq('assignment_id', assignmentId)
      .order('sort_order', { ascending: true });

    // 3. 获取所有班级
    const { data: classes } = await supabase
      .from('classes')
      .select('id, name');

    // 4. 获取所有学生
    const { data: allStudents } = await supabase
      .from('students')
      .select('id, student_number, name, class_id');

    // 5. 获取该作业所有已批改的提交记录
    const { data: submissions } = await supabase
      .from('assignment_submissions')
      .select('id, student_id, student_number, student_name, status, total_score, max_score, submitted_at, graded_at')
      .eq('assignment_id', assignmentId)
      .eq('status', 'graded');

    // 6. 获取所有答案记录（用于错题统计）
    const submissionIds = (submissions || []).map(s => s.id);
    let allAnswers: any[] = [];
    if (submissionIds.length > 0) {
      const { data: answers } = await supabase
        .from('question_answers')
        .select('submission_id, question_id, student_answer, is_correct, score')
        .in('submission_id', submissionIds);
      allAnswers = answers || [];
    }

    // 7. 按 class_id 分组学生
    const studentsByClass = new Map<string, typeof allStudents>();
    for (const s of allStudents || []) {
      const list = studentsByClass.get(s.class_id) || [];
      list.push(s);
      studentsByClass.set(s.class_id, list);
    }

    // 建立 student_number -> profile user_id 的映射
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, student_id');
    const studentNumberToUserId = new Map((profiles || []).map(p => [p.student_id, p.user_id]));

    // 建立 user_id -> submission 的映射
    const submissionByUserId = new Map((submissions || []).map(s => [s.student_id, s]));

    // 8. 按班级统计
    const classStats = (classes || []).map(cls => {
      const classStudents = studentsByClass.get(cls.id) || [];
      const totalStudents = classStudents.length;

      // 找出该班级中已提交的学生
      const classSubmissions: typeof submissions = [];
      for (const s of classStudents) {
        const userId = studentNumberToUserId.get(s.student_number);
        if (userId) {
          const sub = submissionByUserId.get(userId);
          if (sub) classSubmissions.push(sub);
        }
      }

      const submittedCount = classSubmissions.length;
      const completionRate = totalStudents > 0 ? Math.round((submittedCount / totalStudents) * 1000) / 10 : 0;

      // 统计分数
      const scores = classSubmissions.map(s => Number(s.total_score) || 0);
      const maxScores = classSubmissions.map(s => Number(s.max_score) || 0);
      const avgScore = submittedCount > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / submittedCount * 10) / 10
        : 0;
      const maxScore = submittedCount > 0 ? Math.max(...scores) : 0;

      // 及格率（得分率 >= 60%）
      const passCount = classSubmissions.filter(s => {
        const mx = Number(s.max_score) || 0;
        return mx > 0 && (Number(s.total_score) || 0) / mx >= 0.6;
      }).length;
      const passRate = submittedCount > 0 ? Math.round((passCount / submittedCount) * 1000) / 10 : 0;

      // 得分分布（按分数段: 0-20, 20-40, 40-60, 60-80, 80-100 的得分率分段）
      const scoreDistribution = [0, 0, 0, 0, 0]; // 5个分数段
      for (const sub of classSubmissions) {
        const mx = Number(sub.max_score) || 0;
        const rate = mx > 0 ? (Number(sub.total_score) || 0) / mx * 100 : 0;
        if (rate < 20) scoreDistribution[0]++;
        else if (rate < 40) scoreDistribution[1]++;
        else if (rate < 60) scoreDistribution[2]++;
        else if (rate < 80) scoreDistribution[3]++;
        else scoreDistribution[4]++;
      }

      return {
        class_id: cls.id,
        class_name: cls.name,
        total_students: totalStudents,
        submitted_count: submittedCount,
        completion_rate: completionRate,
        avg_score: avgScore,
        max_score: maxScore,
        pass_rate: passRate,
        score_distribution: scoreDistribution,
      };
    });

    // 9. 错题排行（按题目统计错误人数）
    const questionErrorMap = new Map<string, { question_id: string; error_count: number; total_count: number }>();
    for (const ans of allAnswers) {
      const existing = questionErrorMap.get(ans.question_id) || { question_id: ans.question_id, error_count: 0, total_count: 0 };
      existing.total_count++;
      if (ans.is_correct === false) existing.error_count++;
      questionErrorMap.set(ans.question_id, existing);
    }

    const wrongRanking = Array.from(questionErrorMap.values())
      .filter(q => q.error_count > 0)
      .sort((a, b) => b.error_count - a.error_count)
      .map(q => {
        const qDetail = (questions || []).find(x => x.id === q.question_id);
        return {
          question_id: q.question_id,
          question_number: qDetail?.question_id || 0,
          type: qDetail?.type || 0,
          title: qDetail?.title || '',
          answer: qDetail?.answer || '',
          error_count: q.error_count,
          total_count: q.total_count,
          error_rate: q.total_count > 0 ? Math.round((q.error_count / q.total_count) * 1000) / 10 : 0,
        };
      });

    return NextResponse.json({
      assignment,
      questions: questions || [],
      class_stats: classStats,
      wrong_ranking: wrongRanking,
    });
  } catch (error) {
    console.error('获取作业统计失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
