import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 获取课程列表
export async function GET() {
  try {
    const client = getSupabaseClient();

    const { data, error } = await client
      .from('courses')
      .select('*')
      .order('chapter_name', { ascending: true })
      .order('knowledge_name', { ascending: true });

    if (error) {
      console.error('获取课程列表失败:', error);
      return NextResponse.json({ error: '获取课程列表失败' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('获取课程列表错误:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 新增课程知识点
export async function POST(req: NextRequest) {
  try {
    const client = getSupabaseClient();
    const operator = decodeURIComponent(req.headers.get('x-operator') || 'system');

    const body = await req.json();
    const { chapter_name, knowledge_name } = body;

    if (!chapter_name || !knowledge_name) {
      return NextResponse.json({ error: '请填写完整信息' }, { status: 400 });
    }

    const { data, error } = await client
      .from('courses')
      .insert({
        chapter_name,
        knowledge_name,
        created_by: operator,
      })
      .select()
      .single();

    if (error) {
      console.error('新增课程失败:', error);
      return NextResponse.json({ error: '新增课程失败' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('新增课程错误:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 修改课程知识点
export async function PUT(req: NextRequest) {
  try {
    const client = getSupabaseClient();
    const operator = decodeURIComponent(req.headers.get('x-operator') || 'system');

    const body = await req.json();
    const { id, chapter_name, knowledge_name } = body;

    if (!id || !chapter_name || !knowledge_name) {
      return NextResponse.json({ error: '请填写完整信息' }, { status: 400 });
    }

    const { data, error } = await client
      .from('courses')
      .update({
        chapter_name,
        knowledge_name,
        updated_by: operator,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('修改课程失败:', error);
      return NextResponse.json({ error: '修改课程失败' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('修改课程错误:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 删除课程知识点
export async function DELETE(req: NextRequest) {
  try {
    const client = getSupabaseClient();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '缺少课程ID' }, { status: 400 });
    }

    const { error } = await client
      .from('courses')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('删除课程失败:', error);
      return NextResponse.json({ error: '删除课程失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('删除课程错误:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
