import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const COZE_API_BASE = 'https://api.coze.cn';
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

// POST /api/coze/upload — upload file to Coze and return file_id
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: '缺少文件' }, { status: 400 });
    }

    const accessToken = await getAccessToken();

    // Upload file to Coze
    const cozeFormData = new FormData();
    cozeFormData.append('file', file);

    const uploadResponse = await fetch(`${COZE_API_BASE}/v1/files/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: cozeFormData,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('Coze file upload failed:', errorText);
      return NextResponse.json({ error: `文件上传失败: ${uploadResponse.status}` }, { status: 500 });
    }

    const uploadResult = await uploadResponse.json();
    const file_id = uploadResult.data?.id;

    if (!file_id) {
      console.error('Coze file upload response missing file_id:', uploadResult);
      return NextResponse.json({ error: '文件上传返回数据异常' }, { status: 500 });
    }

    return NextResponse.json({ file_id, data: uploadResult.data });
  } catch (err) {
    console.error('Coze文件上传失败:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
