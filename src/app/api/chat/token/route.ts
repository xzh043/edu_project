import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const COZE_API_BASE = 'https://api.coze.cn';

const CLIENT_ID = process.env.OAUTH_CLIENT_ID || '';
const PRIVATE_KEY = (process.env.OAUTH_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const PUBLIC_KEY_ID = process.env.OAUTH_PUBLIC_KEY_ID || '';

function generateJWT(sessionName?: string): string {
  if (!PRIVATE_KEY) {
    throw new Error('Coze OAuth 未配置，请在环境变量中设置 OAUTH_PRIVATE_KEY');
  }
  const now = Math.floor(Date.now() / 1000);

  const payload: Record<string, unknown> = {
    iss: CLIENT_ID,
    aud: COZE_API_BASE.replace('https://', ''),
    iat: now,
    exp: now + 600, // 10 minutes
    jti: crypto.randomUUID(),
  };

  if (sessionName) {
    payload.session_name = sessionName;
  }

  const headers = {
    alg: 'RS256',
    kid: PUBLIC_KEY_ID,
  };

  return jwt.sign(payload, PRIVATE_KEY, { algorithm: 'RS256', header: headers });
}

async function getAccessToken(sessionName?: string): Promise<{ accessToken: string; expiresIn: number }> {
  const token = generateJWT(sessionName);

  const response = await fetch(`${COZE_API_BASE}/api/permission/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
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

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  };
}

export async function POST(request: Request) {
  try {
    if (!CLIENT_ID || !PRIVATE_KEY || !PUBLIC_KEY_ID) {
      return NextResponse.json(
        { error: 'OAuth JWT configuration is missing' },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const sessionName = body.session_name || undefined;

    const { accessToken, expiresIn } = await getAccessToken(sessionName);

    return NextResponse.json({
      access_token: accessToken,
      expires_in: expiresIn,
    });
  } catch (error) {
    console.error('Failed to generate chat token:', error);
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 }
    );
  }
}
