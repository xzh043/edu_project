import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const COZE_API_BASE = 'https://api.coze.cn';
const WORKFLOW_ID = '7658601128179204136';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const PRIVATE_KEY = (process.env.OAUTH_PRIVATE_KEY || '').replace(/\\n/g, '\n');

function getEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

async function getCozeAccessToken(): Promise<string> {
  if (!PRIVATE_KEY) {
    throw new Error('Coze OAuth 未配置，请在环境变量中设置 OAUTH_PRIVATE_KEY');
  }
  const clientId = process.env.OAUTH_CLIENT_ID || '';
  const publicKeyId = process.env.OAUTH_PUBLIC_KEY_ID || '';

  const now = Math.floor(Date.now() / 1000);
  const token = jwt.sign(
    { iss: clientId, aud: 'api.coze.cn', iat: now, exp: now + 600, jti: crypto.randomUUID() },
    PRIVATE_KEY,
    { algorithm: 'RS256', header: { alg: 'RS256', kid: publicKeyId } }
  );

  const tokenResp = await fetch(`${COZE_API_BASE}/api/permission/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      duration_seconds: 86399,
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    }),
  });

  const tokenData = await tokenResp.json();
  if (!tokenData.access_token) {
    throw new Error(`Failed to get access token: ${JSON.stringify(tokenData)}`);
  }
  return tokenData.access_token;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get('student_id');
    const studentNumber = searchParams.get('student_number');
    const assignmentId = searchParams.get('assignment_id');

    if (!studentId && !studentNumber) {
      return NextResponse.json({ error: 'student_id or student_number required' }, { status: 400 });
    }

    const supabaseUrl = SUPABASE_URL;
    const serviceRoleKey = SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Missing database config' }, { status: 500 });
    }

    // Query suggestions
    let query = '';
    if (studentId) {
      query = `student_id=eq.${studentId}`;
    } else {
      query = `student_number=eq.${studentNumber}`;
    }

    if (assignmentId) {
      query += `&assignment_id=eq.${assignmentId}`;
    }

    const resp = await fetch(`${supabaseUrl}/rest/v1/ai_suggestions?${query}&order=created_at.desc&limit=10`, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    });

    const suggestions = await resp.json();
    return NextResponse.json({ suggestions });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { student_id, student_number, content, assignment_id } = body;

    if (!student_id || !student_number) {
      return NextResponse.json({ error: 'student_id and student_number required' }, { status: 400 });
    }

    console.log('AI suggestion POST: start, student_id:', student_id, 'student_number:', student_number, 'assignment_id:', assignment_id || 'all');

    const supabaseUrl = SUPABASE_URL;
    const serviceRoleKey = SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Missing database config' }, { status: 500 });
    }

    // Determine which workflow to use
    // assignment_id provided: workflow 7658601073989648424 (content only, specific assignment wrong answers)
    // no assignment_id: workflow 7658601128179204136 (id_number + content, all wrong answers)
    const ASSIGNMENT_WORKFLOW_ID = '7658601073989648424';
    const STUDENT_WORKFLOW_ID = '7658601128179204136';
    const workflowId = assignment_id ? ASSIGNMENT_WORKFLOW_ID : STUDENT_WORKFLOW_ID;

    // Build content parameter - if not provided, fetch wrong answers from the student
    let wrongAnswerContent = content || '';

    if (!wrongAnswerContent) {
      // Resolve student_id: the frontend passes students.id, but assignment_submissions uses profiles.user_id
      let queryStudentId = student_id;
      const profileResp = await fetch(
        `${supabaseUrl}/rest/v1/profiles?student_id=eq.${student_number}&select=user_id&limit=1`,
        {
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
          },
        }
      );
      const profileData = await profileResp.json();
      console.log('AI suggestion: profileData', JSON.stringify(profileData).slice(0, 200));
      if (Array.isArray(profileData) && profileData.length > 0 && profileData[0].user_id) {
        queryStudentId = profileData[0].user_id;
      }

      // Fetch student's submissions first
      let submissionsQuery = `student_id=eq.${queryStudentId}&status=eq.graded&select=id`;
      if (assignment_id) {
        submissionsQuery += `&assignment_id=eq.${assignment_id}`;
      }
      const submissionsResp = await fetch(
        `${supabaseUrl}/rest/v1/assignment_submissions?${submissionsQuery}`,
        {
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
          },
        }
      );
      const submissions = await submissionsResp.json();

      if (!Array.isArray(submissions) || submissions.length === 0) {
        return NextResponse.json({ error: '没有错题记录，无法生成建议' }, { status: 400 });
      }

      const submissionIds = submissions.map((s: any) => s.id);
      
      // Fetch wrong answers from those submissions
      const answersResp = await fetch(
        `${supabaseUrl}/rest/v1/question_answers?submission_id=in.(${submissionIds.join(',')})&is_correct=eq.false&select=question_id,student_answer`,
        {
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
          },
        }
      );

      const answers = await answersResp.json();

      if (!Array.isArray(answers) || answers.length === 0) {
        return NextResponse.json({ error: '没有错题记录，无法生成建议' }, { status: 400 });
      }

      // Fetch question details
      const questionIds = answers.map((a: any) => a.question_id).filter(Boolean);
      const questionsMap: Record<string, any> = {};
      
      if (questionIds.length > 0) {
        const questionsResp = await fetch(
          `${supabaseUrl}/rest/v1/questions?id=in.(${questionIds.join(',')})&select=id,title,type,answer,analysis`,
          {
            headers: {
              apikey: serviceRoleKey,
              Authorization: `Bearer ${serviceRoleKey}`,
            },
          }
        );
        const questions = await questionsResp.json();
        if (Array.isArray(questions)) {
          questions.forEach((q: any) => { questionsMap[q.id] = q; });
        }
      }

      // Format wrong answers as content
      wrongAnswerContent = answers.map((a: any, i: number) => {
        const q = questionsMap[a.question_id] || {};
        const typeStr = q.type === 1 ? '选择题' : '判断题';
        return `${i + 1}. [${typeStr}] ${q.title || ''} 正确答案: ${q.answer || ''} 学生答案: ${a.student_answer || ''}`;
      }).join('\n');
    }

    // Call Coze workflow
    const accessToken = await getCozeAccessToken();

    const workflowParameters = assignment_id
      ? { content: wrongAnswerContent }
      : { id_number: student_number, content: wrongAnswerContent };

    const workflowResp = await fetch(`${COZE_API_BASE}/v1/workflow/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        workflow_id: workflowId,
        parameters: workflowParameters,
      }),
    });

    if (!workflowResp.ok) {
      const errText = await workflowResp.text();
      console.error('Workflow HTTP error:', workflowResp.status, errText.slice(0, 500));
      return NextResponse.json({ error: `工作流请求失败: ${workflowResp.status}` }, { status: 500 });
    }

    const workflowData = await workflowResp.json();
    console.log('AI suggestion workflow result:', JSON.stringify(workflowData).slice(0, 1000));

    if (workflowData.code !== 0) {
      const errorMsg = workflowData.msg || 'Unknown workflow error';
      const debugUrl = workflowData.debug_url || '';
      console.error('Workflow error:', errorMsg, 'debug_url:', debugUrl);
      return NextResponse.json({
        error: errorMsg,
        debug_url: debugUrl,
      }, { status: 500 });
    }

    // Parse the output
    let outputText = '';
    const data = workflowData.data;
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        outputText = parsed.output || data;
      } catch {
        outputText = data;
      }
    } else if (data && typeof data === 'object') {
      outputText = data.output || JSON.stringify(data);
    }

    if (!outputText) {
      return NextResponse.json({ error: '工作流未返回有效内容' }, { status: 500 });
    }

    // Delete old suggestions for this student+assignment (keep only the latest one)
    const deleteFilter = assignment_id
      ? `student_number=eq.${student_number}&assignment_id=eq.${assignment_id}`
      : `student_number=eq.${student_number}&assignment_id=is.null`;
    await fetch(`${supabaseUrl}/rest/v1/ai_suggestions?${deleteFilter}`, {
      method: 'DELETE',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    });

    // Save to database
    const saveBody: Record<string, string> = {
      student_id,
      student_number,
      content: outputText,
    };
    if (assignment_id) saveBody.assignment_id = assignment_id;

    const saveResp = await fetch(`${supabaseUrl}/rest/v1/ai_suggestions`, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(saveBody),
    });

    if (!saveResp.ok) {
      const saveErr = await saveResp.text();
      console.error('Failed to save AI suggestion:', saveErr);
      return NextResponse.json({ error: '保存失败', detail: saveErr }, { status: 500 });
    }

    const saved = await saveResp.json();
    const suggestion = Array.isArray(saved) ? saved[0] : saved;

    return NextResponse.json({ suggestion });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const stack = error instanceof Error ? error.stack : '';
    console.error('AI suggestion error:', message, stack);
    return NextResponse.json({ error: message, stack: stack?.split('\n').slice(0, 5) }, { status: 500 });
  }
}
