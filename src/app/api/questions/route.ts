import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// GET /api/questions?assignment_id=xxx
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const assignment_id = searchParams.get('assignment_id');

    if (!assignment_id) {
      return NextResponse.json({ error: '缺少作业ID' }, { status: 400 });
    }

    const client = await getSupabaseClient();
    const { data, error } = await client
      .from('questions')
      .select('*')
      .eq('assignment_id', assignment_id)
      .order('sort_order', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('获取题目列表失败:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// POST /api/questions — create a single question
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { assignment_id, question_id, type, title, options, answer, analysis, sort_order, category, class_name, student_number, student_name } = body;

    if (!assignment_id || !title || !answer) {
      return NextResponse.json({ error: '缺少必填字段' }, { status: 400 });
    }

    const client = await getSupabaseClient();
    const { data, error } = await client
      .from('questions')
      .insert({
        assignment_id,
        question_id: question_id || 0,
        type: type || 1,
        title,
        options: options || [],
        answer,
        analysis,
        sort_order: sort_order || 0,
        category: category || '',
        class_name: class_name || '',
        student_number: student_number || '',
        student_name: student_name || '',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('创建题目失败:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// PUT /api/questions — update a question
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, question_id, type, title, options, answer, analysis, sort_order, category, class_name, student_number, student_name } = body;

    if (!id) {
      return NextResponse.json({ error: '缺少题目ID' }, { status: 400 });
    }

    const client = await getSupabaseClient();

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (question_id !== undefined) updateData.question_id = question_id;
    if (type !== undefined) updateData.type = type;
    if (title !== undefined) updateData.title = title;
    if (options !== undefined) updateData.options = options;
    if (answer !== undefined) updateData.answer = answer;
    if (analysis !== undefined) updateData.analysis = analysis;
    if (sort_order !== undefined) updateData.sort_order = sort_order;
    if (category !== undefined) updateData.category = category;
    if (class_name !== undefined) updateData.class_name = class_name;
    if (student_number !== undefined) updateData.student_number = student_number;
    if (student_name !== undefined) updateData.student_name = student_name;

    const { data, error } = await client
      .from('questions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('更新题目失败:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// DELETE /api/questions?id=xxx
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '缺少题目ID' }, { status: 400 });
    }

    const client = await getSupabaseClient();
    const { error } = await client.from('questions').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('删除题目失败:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
