import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 获取班级列表
export async function GET(req: NextRequest) {
  try {
    // 使用 service role key，不需要验证 token
    const client = getSupabaseClient();

    const { data, error } = await client
      .from('classes')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw new Error(`查询班级失败: ${error.message}`);

    return NextResponse.json(data);
  } catch (err) {
    console.error('获取班级列表错误:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 删除班级
export async function DELETE(req: NextRequest) {
  try {
    // 使用 service role key，不需要验证 token
    const client = getSupabaseClient();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: '缺少班级ID' }, { status: 400 });
    }

    // 检查班级下是否有学生
    const { count, error: countError } = await client
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('class_id', id);

    if (countError) throw new Error(`查询学生数量失败: ${countError.message}`);

    if (count && count > 0) {
      return NextResponse.json(
        { error: `该班级下还有 ${count} 名学生，请先移除或转出学生后再删除班级` },
        { status: 400 }
      );
    }

    const { error } = await client
      .from('classes')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`删除班级失败: ${error.message}`);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('删除班级错误:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 新增班级
export async function POST(req: NextRequest) {
  try {
    // 使用 service role key，不需要验证 token
    const client = getSupabaseClient();



    const operatorName = req.headers.get('x-operator') || 'system';

    const body = await req.json();
    const { name } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: '班级名称不能为空' }, { status: 400 });
    }

    // 检查班级名是否已存在
    const { data: existing } = await client
      .from('classes')
      .select('id')
      .eq('name', name.trim())
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: '该班级已存在' }, { status: 409 });
    }

    const { data, error } = await client
      .from('classes')
      .insert({
        name: name.trim(),
        created_by: operatorName,
      })
      .select()
      .single();

    if (error) throw new Error(`创建班级失败: ${error.message}`);

    return NextResponse.json(data);
  } catch (err) {
    console.error('创建班级错误:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
