import { NextRequest, NextResponse } from 'next/server';
import { importPKCS8, SignJWT } from 'jose';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getReportBuffer, createWrappedFetch } from 'coze-coding-dev-sdk';

const COZE_CLIENT_ID = '1180208030013';
const COZE_API_BASE = 'https://api.coze.cn';
const COZE_AUD = 'api.coze.cn';
const PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDPPmHAv7DJebEZ
amPo0uBTc9zP4f/j71Rz1TqUGzAjvaIA3sjNcsydhvnEb8jliLlu6bofCO3FVmlp
/kJR5BW7STxvuF68xqg8Tr3qOGCpVzrqizyLh9uSIEiHln7c3cFjaJ87qwpBvkyB
ph2juNP9cUfmNdLkw+CdJX6psNlHEJtudfVy13+lE5XB0cNrkjINzB4r5FsToLPi
ryVEi0MsxlOhcYr6NeeWWEleV7MV5F0uQyl8B27QYs2/om26A9+6M19rupLAlIum
3S6qRuXVe3AoH8D4wsUTMdA2byiqDYam7jihrIgx14XqDpTx3oDri2eSDCiQbZhU
YEh08Lo3AgMBAAECggEAATi/62/12H+Je2SKKZGHVavwLaA1GaCL4ebsN8/1N7C4
J23Tcd/vCYVbLDzwdTyaGJJI0O1aNs3smdMFjGVeJMLTbWEr2yGx/4ZYo5co0ra7
QoNcRwJKWWaBUZ33KibQgLKEMHOGAEnhOj5tcaKhn/PZVae+54RUFaO78b94zcIY
6sF9wPzCO6jq+jLqnpYy1bbyu1DDF4a/3KUWYq1lVfJ1asihzg05V7FV9EDSCW9+
t3CoJlwQIp8K8bORNqAfutZEg4SnLq1eKDER+NX3anYwub87nEpdSWRY8VZEWiW9
Ldu9uKx9Mu89pnngw8DVxFKlGAsjBQF/CuuhPTXQeQKBgQD0G2dZHJtFbTNicO1X
12QCvUQ1VeEe4T+o4cnLrTGfybGqf2XfEBdy+TDs5+y1tHjFOF1OGsWBdwL8E2T5
MzA1hHMA2yXJGca+4GFY7n+Z2mxHIwbcDnC2UAwnMuttTBZM/+/WBwjBXJ9pxvN+
gRHnEXHTx0+W8pQPa/LrMyNnTQKBgQDZVzRDqu83EcjOhG18eVqF9QJsTkk0fuig
f7bx7vas4OXQSf4HWPtLldtkPq9FN8NnMGeQfZwo+Z2C/PbUe1ah16iAuORIN8dI
ightUcv9SNlcv1Oh3N0M75DJQB4cuK/iq+fpuoclh9cyojQbw+T+sIXA1kpVAD3I
PsmWIRONkwKBgQCHpZq+eBkIcXA2ac5aG8TliMsYYEqi4ESB0kZSukFzK59gwT6Y
v9Zn+3VmkFKHfmwGHBYtSs8p7DpqXVSk7f8CHkHR3fWXVI2OkB1IT+/0TN4SgbJU
ImobxUublL4ilD9oNmjOJEaHPLMREo9IYuzR3G3GY2Ek3lPMZg4tCNPJmQKBgFos
czPMHPoVN+JvUVm+o89Ga13yUS8lpHDK7GWOhuwNV2xG9s2nnoOqxl7eHywxybHr
hFyPsRXTEwYA3IwmLDhz2Kanj5djBRzUoFBzCpao/f4cJ5/VmiU+1CybnKLAAcGj
H1J7II1ywddxMvt+GGmPZb8vaaHAuuF1I4BVct5fAoGBAMdH01bbJqFNbSmRtvUe
NsLyYL04Z4A08+Cgw7aT+tuVrzDXvc2Wy7mmznJNA0ZX67TMw29FExxXaA1qFhnU
mUVl7dKOWQEK2Ssp8X4wecWHZFe9FGNyzcBmEVAOSZFPflNSeGd01sMcgM1ScPzJ
aJUwr0fzl5/hxW46bBfnklKf
-----END PRIVATE KEY-----`;

const PUBLIC_KEY_ID = 'BR-G-wmFrWofPzt9WKt5jocLYOj7D5OgjiR-wjpvkrU';

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('Supabase 配置缺失');
  }
  return { url, anonKey };
}

export async function POST(request: NextRequest) {
  try {
    // 验证登录状态
    const sessionToken = request.headers.get('x-session');
    if (!sessionToken) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const { url, anonKey } = getSupabaseConfig();
    const reportBuffer = getReportBuffer();
    const supabase = createSupabaseClient(url, anonKey, {
      global: {
        ...(reportBuffer ? { fetch: createWrappedFetch(reportBuffer) } : {}),
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser(sessionToken);
    if (authError || !user) {
      return NextResponse.json({ error: '认证失败' }, { status: 401 });
    }

    // 获取用户信息用于会话隔离
    const sessionName = user.user_metadata?.student_id || user.user_metadata?.employee_id || user.id;
    const userName = user.user_metadata?.name || '用户';
    const userId = user.id;

    // 步骤1: 用 RSA 私钥签署 JWT
    // 严格按照 Coze OAuth JWT 文档格式：
    // Header: { alg: "RS256", typ: "JWT", kid: "<公钥指纹>" }
    // Payload: { iss: "<client_id>", aud: "api.coze.cn", iat, exp, jti, session_name }
    const privateKey = await importPKCS8(PRIVATE_KEY, 'RS256');

    const now = Math.floor(Date.now() / 1000);
    const signedJwt = await new SignJWT({
      session_name: sessionName,
    })
      .setProtectedHeader({
        alg: 'RS256',
        kid: PUBLIC_KEY_ID,
        typ: 'JWT',
      })
      .setIssuer(COZE_CLIENT_ID)
      .setAudience(COZE_AUD)
      .setIssuedAt(now)
      .setExpirationTime(now + 900)
      .setJti(crypto.randomUUID())
      .sign(privateKey);

    // 步骤2: 用 JWT 调用 Coze API 换取 OAuth Access Token
    const tokenResponse = await fetch(`${COZE_API_BASE}/api/permission/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${signedJwt}`,
      },
      body: JSON.stringify({
        duration_seconds: 86399,
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Coze OAuth token error:', errorText);
      return NextResponse.json({ error: '获取 Coze 访问令牌失败' }, { status: 500 });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const expiresIn = tokenData.expires_in;

    if (!accessToken) {
      console.error('Coze OAuth token response missing access_token:', tokenData);
      return NextResponse.json({ error: '获取 Coze 访问令牌失败' }, { status: 500 });
    }

    // 步骤3: 返回 OAuth Access Token 给前端
    return NextResponse.json({
      token: accessToken,
      expiresIn,
      userId,
      userName,
      sessionName,
    });
  } catch (error) {
    console.error('生成 Coze token 失败:', error);
    return NextResponse.json({ error: '生成访问令牌失败' }, { status: 500 });
  }
}
