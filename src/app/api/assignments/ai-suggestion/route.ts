import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const COZE_API_BASE = 'https://api.coze.cn';
const WORKFLOW_ID = '7658601073989648424';
const CLIENT_ID = process.env.OAUTH_CLIENT_ID || '';
const PRIVATE_KEY = (process.env.OAUTH_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const PUBLIC_KEY_ID = process.env.OAUTH_PUBLIC_KEY_ID || '';

async function getCozeAccessToken(): Promise<string> {
  if (!PRIVATE_KEY) {
    throw new Error('Coze OAuth 未配置，请在环境变量中设置 OAUTH_PRIVATE_KEY');
  }
  const now = Math.floor(Date.now() / 1000);
  const token = jwt.sign(
    { iss: CLIENT_ID, aud: 'api.coze.cn', iat: now, exp: now + 600, jti: crypto.randomUUID() },
    PRIVATE_KEY,
    { algorithm: 'RS256', header: { alg: 'RS256', kid: PUBLIC_KEY_ID } }
  );

  const resp = await fetch(`${COZE_API_BASE}/api/permission/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      duration_seconds: 86399,
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    }),
  });
  const data = await resp.json();
  console.log('Token response:', JSON.stringify(data).substring(0, 200));
  if (!data.access_token) throw new Error(`Failed to get Coze access token: ${JSON.stringify(data).substring(0, 200)}`);
  return data.access_token;
}

// GET: fetch existing suggestion
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const assignmentId = searchParams.get('assignment_id');
  if (!assignmentId) return NextResponse.json({ error: 'assignment_id required' }, { status: 400 });

  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/assignment_ai_suggestions?assignment_id=eq.${assignmentId}&order=created_at.desc&limit=1`,
    { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY }` } }
  );
  const data = await resp.json();
  return NextResponse.json({ suggestion: data[0] || null });
}

// POST: generate AI suggestion
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { assignment_id } = body;
    if (!assignment_id) return NextResponse.json({ error: 'assignment_id required' }, { status: 400 });

    // Get wrong answer stats (top 5 by error rate)
    const wrongResp = await fetch(
      `${SUPABASE_URL}/rest/v1/question_answers?select=submission_id,question_id,is_correct` +
      `&is_correct=eq.false`,
      { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` } }
    );
    const wrongAnswers = await wrongResp.json();

    // Get questions for this assignment
    const questionsResp = await fetch(
      `${SUPABASE_URL}/rest/v1/questions?assignment_id=eq.${assignment_id}&select=id,title,type,answer`,
      { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` } }
    );
    const questions = await questionsResp.json();

    // Count errors per question
    const errorCount: Record<string, number> = {};
    for (const wa of wrongAnswers) {
      const q = questions.find((q: any) => q.id === wa.question_id);
      if (q) {
        errorCount[wa.question_id] = (errorCount[wa.question_id] || 0) + 1;
      }
    }

    // Sort by error count and take top 5
    const sortedErrors = Object.entries(errorCount)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 5);

    // Format content for Coze
    let content = '';
    if (sortedErrors.length === 0) {
      content = '暂无错题记录';
    } else {
      content = sortedErrors.map(([qId, count], i) => {
        const q = questions.find((q: any) => q.id === qId);
        return `${i + 1}. 题目：${q?.title || '未知'}\n   正确答案：${q?.answer || '未知'}\n   错误学生人数：${count}人`;
      }).join('\n\n');
    }

    // Call Coze workflow
    const accessToken = await getCozeAccessToken();
    const workflowResp = await fetch(`${COZE_API_BASE}/v1/workflow/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        workflow_id: WORKFLOW_ID,
        parameters: {
          content: content,
        },
      }),
    });

    const workflowData = await workflowResp.json();
    console.log('Assignment AI suggestion workflow result:', JSON.stringify(workflowData).substring(0, 500));

    // Parse response
    let suggestionText = '';
    if (workflowData.code === 0 && workflowData.data) {
      try {
        const output = typeof workflowData.data === 'string'
          ? JSON.parse(workflowData.data).output || workflowData.data
          : workflowData.data.output || JSON.stringify(workflowData.data);
        suggestionText = typeof output === 'string' ? output : JSON.stringify(output);
      } catch {
        suggestionText = String(workflowData.data);
      }
    } else if (workflowData.debug_url) {
      return NextResponse.json({
        error: workflowData.msg || '工作流执行失败',
        debug_url: workflowData.debug_url,
        code: workflowData.code,
      });
    } else {
      return NextResponse.json({ error: workflowData.msg || '工作流执行失败' });
    }

    if (!suggestionText) {
      return NextResponse.json({ error: '工作流未返回有效内容' });
    }

    // Delete existing suggestion (keep only one)
    await fetch(
      `${SUPABASE_URL}/rest/v1/assignment_ai_suggestions?assignment_id=eq.${assignment_id}`,
      {
        method: 'DELETE',
        headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, Prefer: 'return=minimal' },
      }
    );

    // Insert new suggestion
    const insertResp = await fetch(
      `${SUPABASE_URL}/rest/v1/assignment_ai_suggestions`,
      {
        method: 'POST',
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({ assignment_id, content: suggestionText }),
      }
    );
    const inserted = await insertResp.json();
    if (!insertResp.ok) {
      console.error('Failed to save suggestion:', inserted);
      return NextResponse.json({ error: '保存建议失败', detail: inserted }, { status: 500 });
    }

    return NextResponse.json({ suggestion: inserted[0] });
  } catch (e: any) {
    console.error('Assignment AI suggestion error:', e);
    return NextResponse.json({ error: e.message || 'Unknown error' }, { status: 500 });
  }
}
