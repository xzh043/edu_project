import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function POST() {
  try {
    const client = await getSupabaseClient();
    
    await client.from('question_answers').delete().neq('id', '');
    const { error } = await client.from('questions').delete().neq('id', '');
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ success: true, message: '所有题目已清空' });
  } catch (err) {
    console.error('清空题目失败:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}