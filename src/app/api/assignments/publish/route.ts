import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// POST /api/assignments/publish  — 发布或取消发布
export async function POST(request: Request) {
  try {
    const { id, unpublish } = await request.json();
    const operator = request.headers.get('x-operator') || 'system';

    if (!id) {
      return NextResponse.json({ error: '缺少作业ID' }, { status: 400 });
    }

    const client = await getSupabaseClient();

    // Check assignment status
    const { data: existing } = await client
      .from('assignments')
      .select('status, name')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: '作业不存在' }, { status: 404 });
    }

    if (unpublish) {
      // 取消发布
      if (existing.status !== 'published') {
        return NextResponse.json({ error: '只有已发布的作业才能取消发布' }, { status: 400 });
      }
      const { data, error } = await client
        .from('assignments')
        .update({
          status: 'completed',
          publish_time: null,
          updated_by: operator,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: '取消发布失败' }, { status: 500 });
      }
      return NextResponse.json({ success: true, data });
    }

    // 发布
    if (existing.status !== 'completed') {
      return NextResponse.json({ error: '只有生成完成的作业才能发布' }, { status: 400 });
    }

    // Check if questions exist
    const { count } = await client
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .eq('assignment_id', id);

    if (!count || count === 0) {
      return NextResponse.json({ error: '作业没有题目，无法发布' }, { status: 400 });
    }

    const { data, error } = await client
      .from('assignments')
      .update({
        status: 'published',
        publish_time: new Date().toISOString(),
        updated_by: operator,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('发布作业失败:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
