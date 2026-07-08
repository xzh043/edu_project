import { NextResponse } from 'next/server';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

// GET /api/analysis/summary
export async function GET() {
  try {
    // 1. Get all classes
    const classesRes = await fetch(`${SUPABASE_URL}/rest/v1/classes?select=id,name&order=name.asc`, { headers });
    const classes = await classesRes.json();

    // 2. Get all students with class info
    const studentsRes = await fetch(`${SUPABASE_URL}/rest/v1/students?select=id,student_number,name,class_id&order=name.asc`, { headers });
    const students = await studentsRes.json();

    // 3. Get all assignments
    const assignmentsRes = await fetch(`${SUPABASE_URL}/rest/v1/assignments?select=id,name,type,status,chapters,knowledge_points&order=created_at.desc`, { headers });
    const assignments = await assignmentsRes.json();

    // 4. Get all submissions
    const submissionsRes = await fetch(`${SUPABASE_URL}/rest/v1/assignment_submissions?select=id,assignment_id,student_number,status,total_score,max_score`, { headers });
    const submissions = await submissionsRes.json();

    // 5. Get all question answers for accuracy
    const answersRes = await fetch(`${SUPABASE_URL}/rest/v1/question_answers?select=id,submission_id,question_id,is_correct,score`, { headers });
    const answers = await answersRes.json();

    // 6. Get chapters from courses
    const coursesRes = await fetch(`${SUPABASE_URL}/rest/v1/courses?select=chapter_name,knowledge_name&order=chapter_name.asc,knowledge_name.asc`, { headers });
    const courses = await coursesRes.json();

    // ---- Assignment completion stats ----
    const publishedAssignments = assignments.filter((a: any) => a.status === 'published');
    const assignmentStats = publishedAssignments.map((a: any) => {
      const aSubs = submissions.filter((s: any) => s.assignment_id === a.id && s.status === 'graded');
      const totalStudents = students.length;
      const completedCount = aSubs.length;
      const completionRate = totalStudents > 0 ? Math.round((completedCount / totalStudents) * 100) : 0;
      const avgScoreRate = aSubs.length > 0
        ? Math.round((aSubs.reduce((sum: number, s: any) => sum + (s.total_score || 0), 0) / aSubs.length) / (aSubs[0]?.max_score || 1) * 100)
        : 0;

      // 计算平均分（得分率转换为100分制）
      const scoreRates = aSubs.map((s: any) => {
        const mx = Number(s.max_score) || 0;
        return mx > 0 ? ((Number(s.total_score) || 0) / mx) * 100 : 0;
      });
      const avgScore = aSubs.length > 0
        ? Math.round(scoreRates.reduce((sum: number, rate: number) => sum + rate, 0) / aSubs.length * 10) / 10
        : 0;
      const maxScore = aSubs.length > 0 ? Math.round(Math.max(...scoreRates) * 10) / 10 : 0;

      // Parse chapters
      let chapterList: string[] = [];
      if (a.chapters) {
        try {
          chapterList = typeof a.chapters === 'string' ? JSON.parse(a.chapters) : a.chapters;
          if (!Array.isArray(chapterList)) chapterList = [String(chapterList)];
        } catch {
          chapterList = [String(a.chapters)];
        }
      }

      // Parse knowledge_points
      let knowledgeList: string[] = [];
      if (a.knowledge_points) {
        try {
          knowledgeList = typeof a.knowledge_points === 'string' ? JSON.parse(a.knowledge_points) : a.knowledge_points;
          if (!Array.isArray(knowledgeList)) knowledgeList = [String(knowledgeList)];
        } catch {
          knowledgeList = [String(a.knowledge_points)];
        }
      }

      return {
        id: a.id,
        name: a.name,
        type: a.type,
        chapters: chapterList,
        knowledge_points: knowledgeList,
        total_students: totalStudents,
        completed_count: completedCount,
        completion_rate: completionRate,
        avg_score_rate: avgScoreRate,
        avg_score: avgScore,
        max_score: maxScore,
      };
    });

    // ---- Chapter accuracy rates ----
    const chapterMap = new Map<string, { correct: number; total: number }>();
    
    // Build submission_id -> assignment_id mapping
    const subAssignmentMap = new Map<string, string>();
    submissions.forEach((s: any) => {
      subAssignmentMap.set(s.id, s.assignment_id);
    });

    // Build assignment_id -> chapters mapping
    const assignmentChapterMap = new Map<string, string[]>();
    assignments.forEach((a: any) => {
      if (a.chapters) {
        try {
          let chapterList = typeof a.chapters === 'string' ? JSON.parse(a.chapters) : a.chapters;
          if (!Array.isArray(chapterList)) chapterList = [chapterList];
          assignmentChapterMap.set(a.id, chapterList.map(String));
        } catch {
          assignmentChapterMap.set(a.id, [String(a.chapters)]);
        }
      }
    });

    // Calculate per-chapter accuracy
    answers.forEach((ans: any) => {
      const aId = subAssignmentMap.get(ans.submission_id);
      if (!aId) return;
      const chapters = assignmentChapterMap.get(aId) || [];
      chapters.forEach((ch: string) => {
        if (!chapterMap.has(ch)) chapterMap.set(ch, { correct: 0, total: 0 });
        const stat = chapterMap.get(ch)!;
        stat.total += 1;
        if (ans.is_correct) stat.correct += 1;
      });
    });

    const chapterAccuracy = Array.from(chapterMap.entries()).map(([chapter, stat]) => ({
      chapter,
      accuracy_rate: stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0,
      correct: stat.correct,
      total: stat.total,
    })).sort((a, b) => a.chapter.localeCompare(b.chapter));

    // ---- Student rankings ----
    const studentScoreMap = new Map<string, { totalScore: number; maxScore: number; submissionCount: number }>();
    submissions.filter((s: any) => s.status === 'graded').forEach((s: any) => {
      if (!studentScoreMap.has(s.student_number)) {
        studentScoreMap.set(s.student_number, { totalScore: 0, maxScore: 0, submissionCount: 0 });
      }
      const stat = studentScoreMap.get(s.student_number)!;
      stat.totalScore += s.total_score || 0;
      stat.maxScore += s.max_score || 0;
      stat.submissionCount += 1;
    });

    const studentRankings = students
      .map((s: any) => {
        const stat = studentScoreMap.get(s.student_number) || { totalScore: 0, maxScore: 0, submissionCount: 0 };
        const className = classes.find((c: any) => c.id === s.class_id)?.name || '';
        return {
          student_id: s.id,
          student_number: s.student_number,
          name: s.name,
          class_name: className,
          total_score: stat.totalScore,
          max_score: stat.maxScore,
          score_rate: stat.maxScore > 0 ? Math.round((stat.totalScore / stat.maxScore) * 100) : 0,
          submission_count: stat.submissionCount,
        };
      })
      .sort((a: any, b: any) => b.total_score - a.total_score || b.score_rate - a.score_rate);

    // ---- Chapters list (for selection) ----
    const chapterSet = new Set<string>();
    courses.forEach((c: any) => {
      if (c.chapter_name) chapterSet.add(c.chapter_name);
    });
    const chapters = Array.from(chapterSet).sort();

    return NextResponse.json({
      chapters,
      classes: classes.map((c: any) => c.name),
      chapter_accuracy: chapterAccuracy,
      assignment_stats: assignmentStats,
      student_rankings: studentRankings,
    });
  } catch (error) {
    console.error('Analysis summary error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: '获取数据分析失败', detail: message }, { status: 500 });
  }
}
