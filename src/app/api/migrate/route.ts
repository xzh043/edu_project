import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// POST /api/migrate — run database migrations
export async function POST() {
  try {
    const client = await getSupabaseClient();

    // Check if teacher_status column exists
    const { data: checkData } = await client
      .from('assignments')
      .select('teacher_status')
      .limit(1);

    if (checkData && checkData.length > 0 && 'teacher_status' in checkData[0]) {
      return NextResponse.json({ message: 'Migration already applied', migrated: false });
    }

    // If column doesn't exist, we need to add it
    // Since we can't run ALTER TABLE via Supabase REST API,
    // we'll try inserting a test record with the new columns
    // to see if they exist
    return NextResponse.json({
      message: 'Please run the migration SQL in Supabase SQL Editor',
      migrated: false,
      sql: `
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS teacher_status text DEFAULT 'pending';
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS class_status text DEFAULT 'pending';
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS class_total integer DEFAULT 0;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS class_completed integer DEFAULT 0;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS personal_status text DEFAULT 'pending';
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS personal_total integer DEFAULT 0;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS personal_completed integer DEFAULT 0;

UPDATE assignments SET
  teacher_status = 'completed',
  class_status = 'completed',
  personal_status = 'completed'
WHERE status = 'completed' OR status = 'published';`
    });
  } catch (err) {
    console.error('Migration check failed:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
