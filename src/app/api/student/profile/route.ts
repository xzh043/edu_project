import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// GET: 获取学生画像数据
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studentNumber = searchParams.get('student_number');
    const studentId = searchParams.get('student_id');

    if (!studentNumber && !studentId) {
      return NextResponse.json({ error: '缺少学生ID或学号' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // 1. 获取学生基本信息
    let studentQuery = supabase
      .from('students')
      .select('id, student_number, name, class_id')
      .eq('student_number', studentNumber || '')
      .maybeSingle();

    if (!studentNumber && studentId) {
      // Try by profiles.user_id first
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id, student_id, name')
        .eq('user_id', studentId)
        .maybeSingle();

      if (profile?.student_id) {
        studentQuery = supabase
          .from('students')
          .select('id, student_number, name, class_id')
          .eq('student_number', profile.student_id)
          .maybeSingle();
      }
    }

    const { data: student, error: studentError } = await studentQuery;
    if (studentError || !student) {
      return NextResponse.json({ error: '学生信息不存在' }, { status: 404 });
    }

    // 获取班级名称
    const { data: classInfo } = await supabase
      .from('classes')
      .select('name')
      .eq('id', student.class_id)
      .maybeSingle();

    // 获取 auth user_id (from profiles)
    const { data: profileData } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('student_id', student.student_number)
      .maybeSingle();

    const authUserId = profileData?.user_id || studentId || '';

    // 2. 获取该学生所有已批改的提交记录
    const { data: mySubmissions } = await supabase
      .from('assignment_submissions')
      .select('id, assignment_id, status, total_score, max_score, submitted_at, graded_at')
      .eq('student_id', authUserId)
      .eq('status', 'graded')
      .order('graded_at', { ascending: false });

    // 3. 统计数据
    const gradedSubmissions = mySubmissions || [];
    const totalSubmissions = gradedSubmissions.length;
    const totalScore = gradedSubmissions.reduce((sum, s) => sum + (Number(s.total_score) || 0), 0);
    const totalMaxScore = gradedSubmissions.reduce((sum, s) => sum + (Number(s.max_score) || 0), 0);
    const avgScore = totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 1000) / 10 : 0; // 百分制
    const maxSingleScore = totalMaxScore > 0
      ? Math.max(...gradedSubmissions.map(s => {
          const mx = Number(s.max_score) || 0;
          return mx > 0 ? Math.round((Number(s.total_score) || 0) / mx * 1000) / 10 : 0;
        }))
      : 0;

    // 4. 排名：获取所有学生的综合得分
    const { data: allSubmissions } = await supabase
      .from('assignment_submissions')
      .select('student_id, total_score, max_score')
      .eq('status', 'graded');

    // 按学生汇总总分
    const studentScoreMap = new Map<string, { total: number; max: number }>();
    for (const s of allSubmissions || []) {
      const existing = studentScoreMap.get(s.student_id) || { total: 0, max: 0 };
      existing.total += Number(s.total_score) || 0;
      existing.max += Number(s.max_score) || 0;
      studentScoreMap.set(s.student_id, existing);
    }

    // 排序得到排名
    const sortedStudents = Array.from(studentScoreMap.entries())
      .map(([uid, scores]) => ({
        student_id: uid,
        total: scores.total,
        max: scores.max,
        rate: scores.max > 0 ? scores.total / scores.max : 0,
      }))
      .sort((a, b) => b.rate - a.rate || b.total - a.total);

    const myRank = sortedStudents.findIndex(s => s.student_id === authUserId) + 1;
    const totalStudents = sortedStudents.length;

    // 5. 近期表现：最近5份作业及得分
    const recentAssignments = gradedSubmissions.slice(0, 5);
    const recentWithInfo: Array<{
      assignment_id: string;
      assignment_name: string;
      type: string;
      total_score: number;
      max_score: number;
      submitted_at: string | null;
      graded_at: string | null;
    }> = [];

    for (const sub of recentAssignments) {
      const { data: assignInfo } = await supabase
        .from('assignments')
        .select('name, type')
        .eq('id', sub.assignment_id)
        .maybeSingle();
      recentWithInfo.push({
        assignment_id: sub.assignment_id,
        assignment_name: assignInfo?.name || '未知作业',
        type: assignInfo?.type || '',
        total_score: Number(sub.total_score) || 0,
        max_score: Number(sub.max_score) || 0,
        submitted_at: sub.submitted_at,
        graded_at: sub.graded_at,
      });
    }

    // 6. 错题本：所有答错的题目
    const mySubmissionIds = gradedSubmissions.map(s => s.id);
    let wrongAnswers: Array<{
      question_id: string;
      title: string;
      type: number;
      options: any;
      student_answer: string;
      answer: string;
      analysis: string;
      assignment_name: string;
      assignment_type: string;
      submitted_at: string | null;
    }> = [];

    if (mySubmissionIds.length > 0) {
      const { data: wrongRecords } = await supabase
        .from('question_answers')
        .select('question_id, student_answer, submission_id')
        .in('submission_id', mySubmissionIds)
        .eq('is_correct', false);

      if (wrongRecords && wrongRecords.length > 0) {
        // Get question details
        const questionIds = wrongRecords.map(w => w.question_id);
        const { data: questionDetails } = await supabase
          .from('questions')
          .select('id, title, type, options, answer, analysis, assignment_id')
          .in('id', questionIds);

        // Get assignment info for each question
        const assignmentIds = [...new Set((questionDetails || []).map(q => q.assignment_id))];
        const { data: assignmentDetails } = await supabase
          .from('assignments')
          .select('id, name, type')
          .in('id', assignmentIds);

        const assignMap = new Map((assignmentDetails || []).map(a => [a.id, a]));
        const qMap = new Map((questionDetails || []).map(q => [q.id, q]));

        // Build submission_id -> submitted_at map
        const subMap = new Map(gradedSubmissions.map(s => [s.id, s.submitted_at]));

        // Build submission_id -> question_id map from wrongRecords
        const wrongSubmissionMap = new Map(wrongRecords.map(w => [w.question_id, w.submission_id]));

        for (const w of wrongRecords) {
          const q = qMap.get(w.question_id);
          if (!q) continue;
          const a = assignMap.get(q.assignment_id);
          const subId = wrongSubmissionMap.get(w.question_id);
          wrongAnswers.push({
            question_id: w.question_id,
            title: q.title,
            type: q.type,
            options: q.options,
            student_answer: w.student_answer,
            answer: q.answer,
            analysis: q.analysis,
            assignment_name: a?.name || '未知作业',
            assignment_type: a?.type || '',
            submitted_at: subId ? (subMap.get(subId) || null) : null,
          });
        }
      }
    }

    return NextResponse.json({
      basic_info: {
        name: student.name,
        student_number: student.student_number,
        class_name: classInfo?.name || '未知班级',
      },
      stats: {
        rank: myRank || 0,
        total_students: totalStudents || 0,
        total_submissions: totalSubmissions,
        avg_score: avgScore,
        highest_score: Math.round(maxSingleScore * 10) / 10,
        total_score: totalScore,
        total_max_score: totalMaxScore,
      },
      recent_performance: recentWithInfo,
      wrong_answers: wrongAnswers,
    });
  } catch (error) {
    console.error('获取学生画像失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
