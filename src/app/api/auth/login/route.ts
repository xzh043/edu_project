import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, identifier, password } = body;

    if (!type || !identifier || !password) {
      return NextResponse.json(
        { error: '请填写完整的登录信息' },
        { status: 400 }
      );
    }

    // 根据登录类型构造虚拟邮箱
    let email: string;
    if (type === 'teacher') {
      email = `${identifier}@teacher.edusys`;
    } else if (type === 'student') {
      email = `${identifier}@student.edusys`;
    } else {
      return NextResponse.json(
        { error: '无效的登录类型' },
        { status: 400 }
      );
    }

    // 使用 service role key 的客户端来验证登录
    // （当前 Supabase 实例的 anon key 不支持 Auth API 调用）
    const client = getSupabaseClient();

    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      const message = error.message === 'Invalid login credentials'
        ? (type === 'teacher' ? '手机号或密码错误' : '学号或密码错误')
        : error.message;
      return NextResponse.json({ error: message }, { status: 401 });
    }

    if (!data.user || !data.session) {
      return NextResponse.json({ error: '登录失败' }, { status: 401 });
    }

    // 使用 service role key 获取用户 profile（绕过 RLS）
    const serviceClient = getSupabaseClient();
    const { data: profile, error: profileError } = await serviceClient
      .from('profiles')
      .select('*')
      .eq('user_id', data.user.id)
      .maybeSingle();

    if (profileError) {
      console.error('获取用户资料失败:', profileError);
    }

    return NextResponse.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        role: type,
        name: profile?.name || data.user.user_metadata?.name || '',
        phone: profile?.phone || data.user.user_metadata?.phone || '',
        employee_id: profile?.employee_id || data.user.user_metadata?.employee_id || '',
        student_id: profile?.student_id || data.user.user_metadata?.student_id || '',
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
      },
    });
  } catch (err) {
    console.error('登录接口错误:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
