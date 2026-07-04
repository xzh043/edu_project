import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getSupabaseClient } from '@/storage/database/supabase-client';

const COZE_API_BASE = 'https://api.coze.cn';
const WORKFLOW_ID_TEACHER = '7657200672664682548';
const WORKFLOW_ID_CLASS = '7657939219155337225';
const WORKFLOW_ID_PERSONAL = '7657927738251264027';
const CLIENT_ID = process.env.OAUTH_CLIENT_ID || '';
const PRIVATE_KEY = (process.env.OAUTH_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const PUBLIC_KEY_ID = process.env.OAUTH_PUBLIC_KEY_ID || '';

function generateJWT(): string {
  if (!PRIVATE_KEY) {
    throw new Error('Coze OAuth 未配置，请在环境变量中设置 OAUTH_PRIVATE_KEY');
  }
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    { iss: CLIENT_ID, aud: 'api.coze.cn', iat: now, exp: now + 600, jti: crypto.randomUUID() },
    PRIVATE_KEY,
    { algorithm: 'RS256', header: { alg: 'RS256', kid: PUBLIC_KEY_ID } }
  );
}

async function getAccessToken(): Promise<string> {
  const token = generateJWT();
  const response = await fetch(`${COZE_API_BASE}/api/permission/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      duration_seconds: 86399,
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get access token: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.access_token;
}

interface QuestionItem {
  questionId: number;
  category: string;
  type: number;
  title: string;
  options: { key: string; text: string }[];
  answer: string;
  analysis: string;
}

async function runWorkflow(
  accessToken: string,
  workflowId: string,
  parameters: Record<string, unknown>
): Promise<QuestionItem[]> {
  const workflowResponse = await fetch(`${COZE_API_BASE}/v1/workflow/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      workflow_id: workflowId,
      parameters,
    }),
  });

  if (!workflowResponse.ok) {
    const errorText = await workflowResponse.text();
    console.error(`Workflow ${workflowId} run failed:`, errorText);
    return [];
  }

  const workflowResult = await workflowResponse.json();
  console.log(`Workflow ${workflowId} result:`, JSON.stringify(workflowResult).substring(0, 500));

  let questionList: QuestionItem[] = [];
  const outputData = workflowResult.data;

  try {
    let dataObj = outputData;
    if (typeof dataObj === 'string') {
      dataObj = JSON.parse(dataObj);
    }
    if (dataObj && typeof dataObj.output === 'string') {
      const outputParsed = JSON.parse(dataObj.output);
      questionList = outputParsed.questionList || [];
    } else if (dataObj && Array.isArray(dataObj.questionList)) {
      questionList = dataObj.questionList;
    } else if (Array.isArray(dataObj)) {
      questionList = dataObj;
    }
  } catch {
    const rawStr = typeof outputData === 'string' ? outputData : JSON.stringify(outputData);
    const match = rawStr.match(/"questionList"\s*:\s*(\[[\s\S]*?\])\s*\}/);
    if (match) {
      try { questionList = JSON.parse(match[1]); } catch { /* ignore */ }
    }
  }

  return questionList;
}

async function saveQuestions(
  client: any,
  assignmentId: string,
  questions: QuestionItem[],
  startOrder: number,
  metadata?: { class_name?: string; student_number?: string; student_name?: string }
): Promise<number> {
  if (questions.length === 0) return startOrder;

  const questionRecords = questions.map((q: QuestionItem, index: number) => ({
    assignment_id: assignmentId,
    question_id: q.questionId || startOrder + index,
    type: q.type || 1,
    title: q.title,
    options: q.options || [],
    answer: q.answer,
    analysis: q.analysis || '',
    category: q.category || '',
    class_name: metadata?.class_name || '',
    student_number: metadata?.student_number || '',
    student_name: metadata?.student_name || '',
    sort_order: startOrder + index,
  }));

  const { error: insertError } = await client.from('questions').insert(questionRecords);

  if (insertError) {
    console.error('Failed to insert questions:', insertError);
    // If category column doesn't exist, retry without it
    if (insertError.message?.includes('category') || insertError.message?.includes('class_name') || insertError.message?.includes('student_number') || insertError.message?.includes('student_name')) {
      console.log('Retrying without new columns...');
      const safeRecords = questionRecords.map(({ category, class_name, student_number, student_name, ...rest }: any) => rest);
      const { error: retryError } = await client.from('questions').insert(safeRecords);
      if (retryError) {
        console.error('Retry also failed:', retryError);
        throw new Error('题目保存失败');
      }
      return startOrder + questions.length;
    }
    throw new Error('题目保存失败');
  }

  return startOrder + questions.length;
}

// Safe update that ignores errors for missing columns (pre-migration)
async function safeUpdate(client: any, assignmentId: string, updates: Record<string, unknown>) {
  try {
    await client
      .from('assignments')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', assignmentId);
  } catch (err) {
    // If some columns don't exist yet, try updating only the standard columns
    const safeUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if ('status' in updates) safeUpdates.status = updates.status;
    try {
      await client.from('assignments').update(safeUpdates).eq('id', assignmentId);
    } catch {
      // ignore
    }
  }
}

// Check if all three types are done, and update overall status
async function updateOverallStatus(client: any, assignmentId: string) {
  const { data: assignment } = await client
    .from('assignments')
    .select('teacher_status, class_status, personal_status, class_total, class_completed, personal_total, personal_completed, status')
    .eq('id', assignmentId)
    .single();

  if (!assignment) return;

  // If progress columns don't exist yet, fall back to simple status check
  if (!assignment.teacher_status) {
    // Old behavior: just check if any questions exist
    const { count } = await client
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .eq('assignment_id', assignmentId);
    if ((count || 0) > 0) {
      await safeUpdate(client, assignmentId, { status: 'completed' });
    }
    return;
  }

  const teacherDone = assignment.teacher_status === 'completed' || assignment.teacher_status === 'failed';
  const classDone = assignment.class_status === 'completed' || assignment.class_status === 'failed'
    || (assignment.class_total === 0 && assignment.class_status !== 'generating');
  const personalDone = assignment.personal_status === 'completed' || assignment.personal_status === 'failed'
    || (assignment.personal_total === 0 && assignment.personal_status !== 'generating');

  const allDone = teacherDone && classDone && personalDone;

  if (allDone) {
    await safeUpdate(client, assignmentId, { status: 'completed' });
  }
}

// POST /api/coze/workflow — run workflow by type and update progress
export async function POST(request: Request) {
  let assignmentId: string | undefined;
  try {
    const body = await request.json();
    const { assignment_id, type, file_id, xzt_cnt, pdt_cnt, knowledge_points } = body;
    assignmentId = assignment_id;

    if (!assignment_id) {
      return NextResponse.json({ error: '缺少作业ID' }, { status: 400 });
    }

    const workflowType = type || 'all'; // 'teacher' | 'class' | 'personal' | 'all'
    const accessToken = await getAccessToken();
    const client = await getSupabaseClient();

    // Get current max sort_order for this assignment
    const { data: existingQuestions } = await client
      .from('questions')
      .select('sort_order')
      .eq('assignment_id', assignment_id)
      .order('sort_order', { ascending: false })
      .limit(1);
    let nextOrder = (existingQuestions && existingQuestions.length > 0) ? existingQuestions[0].sort_order + 1 : 1;

    if (workflowType === 'teacher' || workflowType === 'all') {
      console.log('=== 生成老师下发作业 ===');
      await safeUpdate(client, assignment_id, { teacher_status: 'generating' });

      const teacherQuestions = await runWorkflow(accessToken, WORKFLOW_ID_TEACHER, {
        ppt_file: JSON.stringify({ file_id: file_id }),
        xzt_cnt: String(xzt_cnt || 0),
        pdt_cnt: String(pdt_cnt || 0),
      });
      teacherQuestions.forEach(q => {
        if (!q.category || q.category === '') {
          q.category = 'teacher_assignment';
        }
      });

      if (teacherQuestions.length > 0) {
        nextOrder = await saveQuestions(client, assignment_id, teacherQuestions, nextOrder);
      }

      await safeUpdate(client, assignment_id, {
        teacher_status: teacherQuestions.length > 0 ? 'completed' : 'failed',
      });

      console.log(`老师下发作业生成 ${teacherQuestions.length} 题`);
    }

    if (workflowType === 'class' || workflowType === 'all') {
      console.log('=== 生成班级共性作业 ===');
      const { data: classes } = await client.from('classes').select('name');
      const classList = Array.isArray(classes) ? classes.map(c => c.name) : [];

      await safeUpdate(client, assignment_id, {
        class_status: 'generating',
        class_total: classList.length,
        class_completed: 0,
      });

      let classCompleted = 0;
      for (const className of classList) {
        console.log(`正在为班级 ${className} 生成共性作业...`);
        const classQuestions = await runWorkflow(accessToken, WORKFLOW_ID_CLASS, {
          knowledge_points: JSON.stringify(knowledge_points || []),
          class: className,
        });
        classQuestions.forEach(q => {
          if (!q.category || q.category === '') {
            q.category = `class_assignment-${className}`;
          }
        });

        if (classQuestions.length > 0) {
          nextOrder = await saveQuestions(client, assignment_id, classQuestions, nextOrder, { class_name: className });
        }

        classCompleted++;
        await safeUpdate(client, assignment_id, { class_completed: classCompleted });

        console.log(`班级 ${className} 生成 ${classQuestions.length} 题 (${classCompleted}/${classList.length})`);
      }

      await safeUpdate(client, assignment_id, { class_status: 'completed' });
    }

    if (workflowType === 'personal' || workflowType === 'all') {
      console.log('=== 生成个人个性化作业 ===');
      // 查询学生学号和姓名
      const { data: students } = await client.from('students').select('student_number, name');
      const studentList = Array.isArray(students) ? students.map(s => ({ number: s.student_number, name: s.name })) : [];

      await safeUpdate(client, assignment_id, {
        personal_status: 'generating',
        personal_total: studentList.length,
        personal_completed: 0,
      });

      let personalCompleted = 0;
      for (const student of studentList) {
        console.log(`正在为学生 ${student.number} (${student.name}) 生成个性化作业...`);
        const personalQuestions = await runWorkflow(accessToken, WORKFLOW_ID_PERSONAL, {
          knowledge_points: JSON.stringify(knowledge_points || []),
          id_number: student.number,
        });
        personalQuestions.forEach(q => {
          if (!q.category || q.category === '') {
            q.category = `personal_assignment-${student.number}`;
          }
        });

        if (personalQuestions.length > 0) {
          nextOrder = await saveQuestions(client, assignment_id, personalQuestions, nextOrder, {
            student_number: student.number,
            student_name: student.name,
          });
        }

        personalCompleted++;
        await safeUpdate(client, assignment_id, { personal_completed: personalCompleted });

        console.log(`学生 ${student.number} (${student.name}) 生成 ${personalQuestions.length} 题 (${personalCompleted}/${studentList.length})`);
      }

      await safeUpdate(client, assignment_id, { personal_status: 'completed' });
    }

    // Update overall status
    await updateOverallStatus(client, assignment_id);

    // Get final assignment state
    const { data: finalAssignment } = await client
      .from('assignments')
      .select('*')
      .eq('id', assignment_id)
      .single();

    return NextResponse.json({
      success: true,
      assignment: finalAssignment,
    });
  } catch (err) {
    console.error('Workflow execution failed:', err);

    try {
      if (assignmentId) {
        const client = await getSupabaseClient();
        // Mark the relevant type as failed
        const { data: assignment } = await client
          .from('assignments')
          .select('teacher_status, class_status, personal_status')
          .eq('id', assignmentId)
          .single();

        if (assignment) {
          const updates: Record<string, unknown> = {};
          if (assignment.teacher_status === 'generating') updates.teacher_status = 'failed';
          if (assignment.class_status === 'generating') updates.class_status = 'failed';
          if (assignment.personal_status === 'generating') updates.personal_status = 'failed';
          await safeUpdate(client, assignmentId, updates);
        }

        await updateOverallStatus(client, assignmentId);
      }
    } catch {
      // ignore
    }

    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
