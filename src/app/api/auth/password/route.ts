import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, oldPassword, newPassword } = body;

    if (!userId || !oldPassword || !newPassword) {
      return NextResponse.json({ error: '请填写完整信息' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: '新密码长度不能少于6位' }, { status: 400 });
    }

    if (oldPassword === newPassword) {
      return NextResponse.json({ error: '新密码不能与旧密码相同' }, { status: 400 });
    }

    // 用 service role key 验证旧密码：通过登录来验证
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // 先查出用户的 email
    const client = getSupabaseClient();
    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('user_id, role')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    // 构造邮箱并验证旧密码
    const email = profile.role === 'teacher'
      ? `${userId}@teacher.edusys`  // 不对，需要用 phone 来查
      : `${userId}@student.edusys`;

    // 用 admin API 查用户邮箱
    const adminResp = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      headers: {
        'apikey': serviceRoleKey!,
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
    });
    const adminData = await adminResp.json();
    const userEmail = adminData?.email;

    if (!userEmail) {
      return NextResponse.json({ error: '用户账号异常' }, { status: 500 });
    }

    // 验证旧密码：用 service role key 登录
    const verifyResp = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey!,
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ email: userEmail, password: oldPassword }),
    });

    if (!verifyResp.ok) {
      return NextResponse.json({ error: '旧密码不正确' }, { status: 400 });
    }

    // 用 admin API 更新密码
    const updateResp = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey!,
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ password: newPassword }),
    });

    if (!updateResp.ok) {
      const errData = await updateResp.json();
      return NextResponse.json({ error: '密码修改失败：' + (errData.msg || '未知错误') }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '密码修改成功' });
  } catch (err) {
    console.error('修改密码错误:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
