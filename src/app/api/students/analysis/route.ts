import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get('student_id'); // students table id

    if (!studentId) {
      return NextResponse.json({ error: 'student_id is required' }, { status: 400 });
    }

  // 1. Get student basic info with class name
  const studentRes = await fetch(
    `${SUPABASE_URL}/rest/v1/students?id=eq.${studentId}&select=*,classes(id,name)`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  );
  const students = await studentRes.json();
  if (!students.length) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 });
  }
  const student = students[0];

  // 2. Get profile (user_id) for this student
  const profileRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?student_id=eq.${student.student_number}&select=user_id`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  );
  const profiles = await profileRes.json();
  const userId = profiles[0]?.user_id;

  // 3. Get all classmate student_numbers
  const classRes = await fetch(
    `${SUPABASE_URL}/rest/v1/students?class_id=eq.${student.class_id}&select=student_number`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  );
  const classmates = await classRes.json();
  const classmateNumbers = classmates.map((c: { student_number: string }) => c.student_number);

  // 4. Get all profiles for classmates (to get user_ids)
  let classmateUserIds: string[] = [];
  if (classmateNumbers.length > 0) {
    // Build filter: student_id=in.(num1,num2,...)
    const inList = classmateNumbers.join(',');
    const classProfilesRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?student_id=in.(${inList})&select=user_id,student_id`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    );
    const classProfiles = await classProfilesRes.json();
    classmateUserIds = classProfiles.map((p: { user_id: string }) => p.user_id);
  }

  // 5. Get all published assignments
  const assignmentsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/assignments?status=eq.published&select=id,name,type,created_at&order=created_at.asc`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  );
  const assignments = await assignmentsRes.json();
  const totalAssignments = assignments.length;

  // 6. Get this student's submissions
  let studentSubmissions: any[] = [];
  if (userId) {
    const subRes = await fetch(
      `${SUPABASE_URL}/rest/v1/assignment_submissions?student_id=eq.${userId}&status=eq.graded&select=id,assignment_id,total_score,max_score,created_at`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    );
    studentSubmissions = await subRes.json();
  }

  // 7. Get all classmates' submissions for ranking
  let allSubmissions: any[] = [];
  if (classmateUserIds.length > 0) {
    const inList = classmateUserIds.join(',');
    const allSubRes = await fetch(
      `${SUPABASE_URL}/rest/v1/assignment_submissions?student_id=in.(${inList})&status=eq.graded&select=student_id,assignment_id,total_score,max_score`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    );
    allSubmissions = await allSubRes.json();
  }

  // Calculate completion rate
  const submittedAssignmentIds = new Set(studentSubmissions.map((s: any) => s.assignment_id));
  const completionRate = totalAssignments > 0 ? Math.round((submittedAssignmentIds.size / totalAssignments) * 100) : 0;

  // Calculate accuracy rate (total correct / total questions across all submissions)
  let totalCorrect = 0;
  let totalQuestions = 0;
  for (const sub of studentSubmissions) {
    totalCorrect += sub.total_score || 0;
    totalQuestions += sub.max_score || 0;
  }
  const accuracyRate = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

  // Calculate class ranking by total score rate
  const studentScoreMap = new Map<string, { total: number; max: number }>();
  for (const sub of allSubmissions) {
    const existing = studentScoreMap.get(sub.student_id) || { total: 0, max: 0 };
    existing.total += sub.total_score || 0;
    existing.max += sub.max_score || 0;
    studentScoreMap.set(sub.student_id, { total: existing.total, max: existing.max });
  }

  // Sort by score rate descending
  const rankingEntries = Array.from(studentScoreMap.entries())
    .map(([uid, scores]) => ({
      student_id: uid,
      rate: scores.max > 0 ? scores.total / scores.max : 0,
      total: scores.total,
      max: scores.max,
    }))
    .sort((a, b) => b.rate - a.rate);

  const classRank = userId
    ? rankingEntries.findIndex((r) => r.student_id === userId) + 1
    : 0;
  const totalRanked = rankingEntries.length;

  // Score trend - all graded submissions with assignment info
  const scoreTrend = studentSubmissions
    .map((sub: any) => {
      const assignment = assignments.find((a: any) => a.id === sub.assignment_id);
      return {
        assignment_name: assignment?.name || '未知作业',
        assignment_type: assignment?.type || '',
        score: sub.total_score,
        max_score: sub.max_score,
        rate: sub.max_score > 0 ? Math.round((sub.total_score / sub.max_score) * 100) : 0,
        date: sub.created_at,
      };
    })
    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return NextResponse.json({
    student: {
      id: student.id,
      name: student.name,
      student_number: student.student_number,
      class_name: student.classes?.name || '-',
    },
    analysis: {
      completion_rate: completionRate,
      accuracy_rate: accuracyRate,
      class_rank: classRank,
      total_classmates: totalRanked,
      total_assignments: totalAssignments,
      submitted_assignments: submittedAssignmentIds.size,
    },
    score_trend: scoreTrend,
  });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
}
