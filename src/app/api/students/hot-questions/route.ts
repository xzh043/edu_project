import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const COZE_API_BASE = 'https://api.coze.cn';
const WORKFLOW_ID = '7658601170658721818';
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

// GET /api/students/hot-questions?id_number=xxx
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id_number = searchParams.get('id_number');
    const classParam = searchParams.get('class') || '';
    const chapter = searchParams.get('chapter') || '';

    if (!id_number) {
      return NextResponse.json({ error: '缺少学号参数' }, { status: 400 });
    }

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
          id_number,
          class: classParam,
          type: '0',
          chapter,
        },
      }),
    });

    if (!workflowResponse.ok) {
      const errorText = await workflowResponse.text();
      console.error('Hot questions workflow failed:', errorText);
      return NextResponse.json({ error: `工作流调用失败: ${workflowResponse.status}` }, { status: 500 });
    }

    const workflowResult = await workflowResponse.json();
    console.log('Hot questions workflow result:', JSON.stringify(workflowResult).substring(0, 500));

    // Parse response - format: { data: string which is JSON containing output array }
    let hotQuestions: { knowledge_point: string; count: string }[] = [];

    try {
      const dataStr = workflowResult.data;
      if (typeof dataStr === 'string') {
        const parsed = JSON.parse(dataStr);
        // output could be a string or already an array
        if (typeof parsed.output === 'string') {
          hotQuestions = JSON.parse(parsed.output);
        } else if (Array.isArray(parsed.output)) {
          hotQuestions = parsed.output;
        } else if (Array.isArray(parsed)) {
          hotQuestions = parsed;
        }
      } else if (Array.isArray(dataStr)) {
        hotQuestions = dataStr;
      } else if (workflowResult.output) {
        if (typeof workflowResult.output === 'string') {
          hotQuestions = JSON.parse(workflowResult.output);
        } else if (Array.isArray(workflowResult.output)) {
          hotQuestions = workflowResult.output;
        }
      }
    } catch (e) {
      console.error('Failed to parse hot questions response:', e);
      console.error('Raw data:', JSON.stringify(workflowResult).substring(0, 1000));
    }

    // Map to cleaner format and sort by count desc
    const result = (hotQuestions as Record<string, string>[])
      .map(item => ({
        knowledge_point: item.knowledge_point || item['knowledge_point'],
        count: parseInt(item.count || item['count(1)'] || '0', 10),
      }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({ hot_questions: result });
  } catch (error) {
    console.error('Hot questions API error:', error);
    return NextResponse.json({ error: '获取热点提问失败' }, { status: 500 });
  }
}
