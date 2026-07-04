import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, employee_id, phone, password } = body;

    // 参数校验
    if (!name || !employee_id || !phone || !password) {
      return NextResponse.json(
        { error: '请填写所有必填项' },
        { status: 400 }
      );
    }

    // 手机号格式校验（中国大陆手机号）
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return NextResponse.json(
        { error: '请输入有效的手机号' },
        { status: 400 }
      );
    }

    // 工号格式校验
    if (employee_id.trim().length < 2) {
      return NextResponse.json(
        { error: '工号格式不正确' },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    // 检查手机号是否已注册
    const virtualEmail = `${phone}@teacher.edusys`;
    const { data: existingUser } = await client
      .from('profiles')
      .select('id')
      .eq('phone', phone)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json(
        { error: '该手机号已注册' },
        { status: 409 }
      );
    }

    // 检查工号是否已注册
    const { data: existingEmployee } = await client
      .from('profiles')
      .select('id')
      .eq('employee_id', employee_id)
      .maybeSingle();

    if (existingEmployee) {
      return NextResponse.json(
        { error: '该工号已注册' },
        { status: 409 }
      );
    }

    // 使用 Supabase Auth 注册
    const { data, error } = await client.auth.signUp({
      email: virtualEmail,
      password,
      options: {
        data: {
          role: 'teacher',
          name,
          phone,
          employee_id,
        },
      },
    });

    if (error) {
      if (error.message.includes('already registered')) {
        return NextResponse.json(
          { error: '该手机号已注册' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data.user) {
      return NextResponse.json({ error: '注册失败' }, { status: 500 });
    }

    // 创建用户资料
    const { error: profileError } = await client
      .from('profiles')
      .insert({
        user_id: data.user.id,
        role: 'teacher',
        name,
        phone,
        employee_id,
      });

    if (profileError) {
      console.error('创建用户资料失败:', profileError);
      // 不返回错误，用户已注册成功，资料可以后续补全
    }

    return NextResponse.json({
      success: true,
      message: '注册成功',
      user: {
        id: data.user.id,
        role: 'teacher',
        name,
        phone,
        employee_id,
      },
    });
  } catch (err) {
    console.error('注册接口错误:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
