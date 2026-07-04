import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const COZE_API_BASE = 'https://api.coze.cn';
const WORKFLOW_ID = '7657465645978877994';
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

// GET /api/analysis/chapter-distribution?chapter=xxx
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const chapter = searchParams.get('chapter') || '';
    const className = searchParams.get('class') || '';

    const accessToken = await getAccessToken();

    const workflowResponse = await fetch(`${COZE_API_BASE}/v1/workflow/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        workflow_id: WORKFLOW_ID,
        parameters: {
          id_number: '',
          class: className,
          type: '1',
          chapter,
        },
      }),
    });

    if (!workflowResponse.ok) {
      const errorText = await workflowResponse.text();
      console.error('Chapter distribution workflow failed:', errorText);
      return NextResponse.json({ error: `工作流调用失败: ${workflowResponse.status}` }, { status: 500 });
    }

    const workflowResult = await workflowResponse.json();
    console.log('Chapter distribution full result:', JSON.stringify(workflowResult, null, 2));

    // Check for workflow errors
    if (workflowResult.code && workflowResult.code !== 0) {
      console.error('Chapter distribution workflow error:', workflowResult.msg);
      return NextResponse.json({
        chapter,
        distribution: [],
        error: workflowResult.msg || '工作流执行失败',
        debug_url: workflowResult.debug_url || workflowResult.debug_url || null,
        raw_result: workflowResult,
      });
    }

    let distribution: { knowledge_point: string; count: string }[] = [];

    try {
      // Try multiple parsing strategies
      // Strategy 1: data is a string containing JSON with output array
      const dataStr = workflowResult.data;
      if (typeof dataStr === 'string') {
        const parsed = JSON.parse(dataStr);
        if (typeof parsed.output === 'string') {
          distribution = JSON.parse(parsed.output);
        } else if (Array.isArray(parsed.output)) {
          distribution = parsed.output;
        } else if (Array.isArray(parsed)) {
          distribution = parsed;
        }
      } else if (Array.isArray(dataStr)) {
        // data is directly an array
        distribution = dataStr;
      }
      // Strategy 2: output is at top level
      if (distribution.length === 0 && workflowResult.output) {
        if (typeof workflowResult.output === 'string') {
          distribution = JSON.parse(workflowResult.output);
        } else if (Array.isArray(workflowResult.output)) {
          distribution = workflowResult.output;
        }
      }
      // Strategy 3: result is directly the array
      if (distribution.length === 0 && Array.isArray(workflowResult)) {
        distribution = workflowResult;
      }
    } catch (e) {
      console.error('Failed to parse chapter distribution result:', e);
    }

    return NextResponse.json({
      chapter,
      class: className,
      distribution: distribution.map((d: Record<string, string>) => ({
        knowledge_point: d.knowledge_point,
        count: parseInt(d['count(1)'] || d.count || '0', 10),
      })),
      debug_url: workflowResult.debug_url || null,
      raw_data: workflowResult.data || null,
    });
  } catch (error) {
    console.error('Chapter distribution error:', error);
    return NextResponse.json({ error: '获取章节知识点分布失败' }, { status: 500 });
  }
}
