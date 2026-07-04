import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 获取学生列表
export async function GET(req: NextRequest) {
  try {
    // 使用 service role key，不需要验证 token
    const client = getSupabaseClient();

    const { searchParams } = new URL(req.url);
    const classId = searchParams.get('class_id');
    const keyword = searchParams.get('keyword');

    let query = client
      .from('students')
      .select('*, classes(id, name)')
      .order('student_number', { ascending: true });

    if (classId) {
      query = query.eq('class_id', classId);
    }

    // 模糊搜索：按姓名或学号
    if (keyword && keyword.trim()) {
      const kw = keyword.trim();
      query = query.or(`name.ilike.%${kw}%,student_number.ilike.%${kw}%`);
    }

    const { data, error } = await query;

    if (error) throw new Error(`查询学生失败: ${error.message}`);

    // 按班级名+学号排序（class name 可能需要从关联取）
    const sorted = (data || []).sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
      const classA = (a.classes as Record<string, unknown>)?.name as string || '';
      const classB = (b.classes as Record<string, unknown>)?.name as string || '';
      if (classA !== classB) return classA.localeCompare(classB, 'zh-CN');
      const numA = (a.student_number as string) || '';
      const numB = (b.student_number as string) || '';
      return numA.localeCompare(numB, 'zh-CN');
    });

    return NextResponse.json(sorted);
  } catch (err) {
    console.error('获取学生列表错误:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 新增学生
export async function POST(req: NextRequest) {
  try {
    // 使用 service role key，不需要验证 token
    const client = getSupabaseClient();

    const body = await req.json();
    const { class_id, student_number, name } = body;

    const operatorName = req.headers.get('x-operator') || 'system';

    if (!class_id || !student_number?.trim() || !name?.trim()) {
      return NextResponse.json({ error: '请填写完整信息' }, { status: 400 });
    }

    // 检查学号是否已存在
    const { data: existing } = await client
      .from('students')
      .select('id')
      .eq('student_number', student_number.trim())
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: '该学号已存在' }, { status: 409 });
    }

    const { data, error } = await client
      .from('students')
      .insert({
        class_id,
        student_number: student_number.trim(),
        name: name.trim(),
        created_by: operatorName,
      })
      .select('*, classes(id, name)')
      .single();

    if (error) throw new Error(`创建学生失败: ${error.message}`);

    // 自动创建 Supabase Auth 账号（默认密码 123456）和 profiles 记录
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const email = `${student_number.trim()}@student.edusys`;

    try {
      // 创建 Auth 账号
      const authResp = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceRoleKey!,
          'Authorization': `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          email,
          password: '123456',
          email_confirm: true,
          user_metadata: {
            role: 'student',
            name: name.trim(),
            student_id: student_number.trim(),
          },
        }),
      });

      if (authResp.ok) {
        const authData = await authResp.json();
        const userId = authData.id;
        // 创建 profiles 记录
        await client.from('profiles').insert({
          user_id: userId,
          role: 'student',
          name: name.trim(),
          student_id: student_number.trim(),
        });
      } else {
        const authErrData = await authResp.json();
        // 如果账号已存在，忽略错误
        if (!authErrData.msg?.includes('already') && !authErrData.msg?.includes('已存在')) {
          console.error('创建学生 Auth 账号失败:', authErrData);
        }
      }
    } catch (authErr) {
      console.error('创建学生 Auth 账号异常:', authErr);
      // 不影响学生记录的创建
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('创建学生错误:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 修改学生
export async function PUT(req: NextRequest) {
  try {
    // 使用 service role key，不需要验证 token
    const client = getSupabaseClient();

    const body = await req.json();
    const { id, class_id, student_number, name } = body;

    const operatorName = req.headers.get('x-operator') || 'system';

    if (!id) {
      return NextResponse.json({ error: '缺少学生ID' }, { status: 400 });
    }

    if (!class_id || !student_number?.trim() || !name?.trim()) {
      return NextResponse.json({ error: '请填写完整信息' }, { status: 400 });
    }

    // 检查学号是否已被其他学生使用
    const { data: existing } = await client
      .from('students')
      .select('id')
      .eq('student_number', student_number.trim())
      .neq('id', id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: '该学号已被其他学生使用' }, { status: 409 });
    }

    const { data, error } = await client
      .from('students')
      .update({
        class_id,
        student_number: student_number.trim(),
        name: name.trim(),
        updated_by: operatorName,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*, classes(id, name)')
      .single();

    if (error) throw new Error(`修改学生失败: ${error.message}`);

    // 同步更新 profiles 表中的学生姓名（通过 student_id 关联）
    const { data: studentData } = await client
      .from('students')
      .select('student_number')
      .eq('id', id)
      .single();

    if (studentData) {
      // 通过 student_id 字段查找对应的 profile
      const { data: profileData } = await client
        .from('profiles')
        .select('id')
        .eq('student_id', studentData.student_number)
        .maybeSingle();

      if (profileData) {
        await client
          .from('profiles')
          .update({ name: name.trim(), updated_at: new Date().toISOString() })
          .eq('id', profileData.id);
      }
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('修改学生错误:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 删除学生
export async function DELETE(req: NextRequest) {
  try {
    // 使用 service role key，不需要验证 token
    const client = getSupabaseClient();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '缺少学生ID' }, { status: 400 });
    }

    const { error } = await client
      .from('students')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`删除学生失败: ${error.message}`);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('删除学生错误:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
