import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('x-session');

    if (!token) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const client = getSupabaseClient(token);
    const { data: { user }, error: authError } = await client.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '认证失败' }, { status: 401 });
    }

    // 获取用户 profile
    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('获取用户资料失败:', profileError);
    }

    // 从邮箱解析角色
    const email = user.email || '';
    let role = 'unknown';
    if (email.endsWith('@teacher.edusys')) {
      role = 'teacher';
    } else if (email.endsWith('@student.edusys')) {
      role = 'student';
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      role,
      name: profile?.name || user.user_metadata?.name || '',
      phone: profile?.phone || user.user_metadata?.phone || '',
      employee_id: profile?.employee_id || user.user_metadata?.employee_id || '',
      student_id: profile?.student_id || user.user_metadata?.student_id || '',
    });
  } catch (err) {
    console.error('获取用户信息错误:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
