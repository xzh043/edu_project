import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// GET /api/assignments?type=quiz|homework&id=xxx
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const keyword = searchParams.get('keyword');
    const id = searchParams.get('id'); // 新增：支持按 ID 查询

    const client = await getSupabaseClient();

    // 如果提供了 ID，直接返回单个作业
    if (id) {
      const { data: assignment, error } = await client
        .from('assignments')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!assignment) {
        return NextResponse.json({ error: '作业不存在' }, { status: 404 });
      }

      return NextResponse.json([assignment]); // 返回数组格式，保持一致性
    }

    let query = client
      .from('assignments')
      .select('*')
      .order('created_at', { ascending: false });

    if (type) {
      query = query.eq('type', type);
    }
    if (keyword) {
      query = query.ilike('name', `%${keyword}%`);
    }

    const { data: assignments, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const enrichedAssignments = await Promise.all(
      assignments.map(async (assignment) => {
        const { data: submissions, error: subError } = await client
          .from('assignment_submissions')
          .select('student_id, student_number, total_score, max_score, status')
          .eq('assignment_id', assignment.id);

        if (subError || !submissions) {
          return { ...assignment, completion_rate: 0, avg_score: 0 };
        }

        const { data: allStudents } = await client
          .from('students')
          .select('id, student_number, class_id');

        const { data: profiles } = await client
          .from('profiles')
          .select('user_id, student_id');

        const studentNumberToUserId = new Map((profiles || []).map(p => [p.student_id, p.user_id]));
        const submissionByUserId = new Map((submissions || []).map(s => [s.student_id, s]));

        const totalStudents = (allStudents || []).length;

        const submittedCount = (allStudents || []).filter(s => {
          const userId = studentNumberToUserId.get(s.student_number);
          if (userId) {
            const sub = submissionByUserId.get(userId);
            if (sub && sub.status && sub.status !== 'draft' && sub.status !== 'in_progress') {
              return true;
            }
          }
          return false;
        }).length;

        const gradedSubmissions = submissions.filter(
          (s) => s.status === 'graded' && s.total_score !== null && s.max_score !== null && s.max_score > 0
        );

        const completionRate = totalStudents > 0 ? Math.round((submittedCount / totalStudents) * 100) : 0;
        const avgScore = gradedSubmissions.length > 0
          ? Math.round(
              gradedSubmissions.reduce((sum, s) => sum + (s.total_score || 0), 0) / gradedSubmissions.length
            )
          : 0;

        return { ...assignment, completion_rate: completionRate, avg_score: avgScore };
      })
    );

    return NextResponse.json(enrichedAssignments);
  } catch (err) {
    console.error('获取作业列表失败:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// POST /api/assignments
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const operator = decodeURIComponent(request.headers.get('x-operator') || 'system');

    const {
      name,
      type,
      chapters,
      knowledge_points,
      xzt_cnt,
      pdt_cnt,
      ppt_file_url,
      ppt_file_id,
      deadline,
      requirements, // 作业要求
      class_ids, // 关联班级ID数组
    } = body;

    if (!name || !type) {
      return NextResponse.json({ error: '作业名称和类型不能为空' }, { status: 400 });
    }

    const client = await getSupabaseClient();
    const insertData: Record<string, unknown> = {
      name,
      type,
      chapters: chapters || [],
      knowledge_points: knowledge_points || [],
      xzt_cnt: xzt_cnt || 0,
      pdt_cnt: pdt_cnt || 0,
      ppt_file_url,
      ppt_file_id,
      deadline,
      status: 'generating',
      created_by: operator,
    };

    // 新增字段（需要先在 Supabase 执行 SQL）
    if (requirements !== undefined) {
      insertData.requirements = requirements;
    }
    if (class_ids !== undefined) {
      insertData.class_ids = class_ids;
    }

    // Try adding progress columns (may not exist before migration)
    try {
      insertData.teacher_status = 'pending';
      insertData.class_status = 'pending';
      insertData.class_total = 0;
      insertData.class_completed = 0;
      insertData.personal_status = 'pending';
      insertData.personal_total = 0;
      insertData.personal_completed = 0;
    } catch {
      // ignore - columns may not exist yet
    }

    const { data, error } = await client
      .from('assignments')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('创建作业失败:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// PUT /api/assignments
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const operator = decodeURIComponent(request.headers.get('x-operator') || 'system');
    const { id, name, type, chapters, knowledge_points, xzt_cnt, pdt_cnt, deadline, requirements, class_ids } = body;

    if (!id) {
      return NextResponse.json({ error: '缺少作业ID' }, { status: 400 });
    }

    const client = await getSupabaseClient();

    // Check if assignment has answers (questions answered by students)
    // For now, check if assignment is published — published assignments cannot be edited
    const { data: existing } = await client
      .from('assignments')
      .select('status')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: '作业不存在' }, { status: 404 });
    }

    if (existing.status === 'published') {
      return NextResponse.json({ error: '已发布的作业不能修改' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      updated_by: operator,
      updated_at: new Date().toISOString(),
    };
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type;
    if (chapters !== undefined) updateData.chapters = chapters;
    if (knowledge_points !== undefined) updateData.knowledge_points = knowledge_points;
    if (xzt_cnt !== undefined) updateData.xzt_cnt = xzt_cnt;
    if (pdt_cnt !== undefined) updateData.pdt_cnt = pdt_cnt;
    if (deadline !== undefined) updateData.deadline = deadline;
    if (requirements !== undefined) updateData.requirements = requirements;
    if (class_ids !== undefined) updateData.class_ids = class_ids;

    const { data, error } = await client
      .from('assignments')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('更新作业失败:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// DELETE /api/assignments?id=xxx
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '缺少作业ID' }, { status: 400 });
    }

    const client = await getSupabaseClient();

    // Check status
    const { data: existing } = await client
      .from('assignments')
      .select('status')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: '作业不存在' }, { status: 404 });
    }

    if (existing.status === 'published') {
      return NextResponse.json({ error: '已发布的作业不能删除' }, { status: 400 });
    }

    const { error } = await client.from('assignments').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('删除作业失败:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
