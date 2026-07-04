import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import * as XLSX from 'xlsx';

interface CourseImportRow {
  chapterName: string;
  knowledgeName: string;
}

interface CourseImportResult {
  row: number;
  chapterName: string;
  knowledgeName: string;
  status: 'success' | 'error';
  message: string;
}

export async function POST(req: NextRequest) {
  try {
    const client = getSupabaseClient();
    const operator = req.headers.get('x-operator') || 'system';

    // 解析 FormData
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: '请上传文件' }, { status: 400 });
    }

    // 读取 Excel
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json({ error: 'Excel 文件为空' }, { status: 400 });
    }
    const sheet = workbook.Sheets[sheetName];
    const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (rows.length < 2) {
      return NextResponse.json({ error: 'Excel 文件没有数据行' }, { status: 400 });
    }

    // 跳过表头，解析数据行
    const importRows: CourseImportRow[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      const chapterName = String(row[0] ?? '').trim();
      const knowledgeName = String(row[1] ?? '').trim();

      if (!chapterName && !knowledgeName) continue; // 跳过空行

      importRows.push({ chapterName, knowledgeName });
    }

    if (importRows.length === 0) {
      return NextResponse.json({ error: '没有有效的数据行' }, { status: 400 });
    }

    // 逐行导入
    const results: CourseImportResult[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < importRows.length; i++) {
      const row = importRows[i];
      const rowNum = i + 2; // Excel 行号（1-based + 1 表头）

      if (!row.chapterName) {
        results.push({ row: rowNum, chapterName: row.chapterName, knowledgeName: row.knowledgeName, status: 'error', message: '章节名称不能为空' });
        errorCount++;
        continue;
      }
      if (!row.knowledgeName) {
        results.push({ row: rowNum, chapterName: row.chapterName, knowledgeName: row.knowledgeName, status: 'error', message: '知识点名称不能为空' });
        errorCount++;
        continue;
      }

      const { error: insertError } = await client
        .from('courses')
        .insert({
          chapter_name: row.chapterName,
          knowledge_name: row.knowledgeName,
          created_by: operator,
        });

      if (insertError) {
        results.push({ row: rowNum, chapterName: row.chapterName, knowledgeName: row.knowledgeName, status: 'error', message: '导入失败：' + insertError.message });
        errorCount++;
      } else {
        results.push({ row: rowNum, chapterName: row.chapterName, knowledgeName: row.knowledgeName, status: 'success', message: '导入成功' });
        successCount++;
      }
    }

    return NextResponse.json({
      success: true,
      total: importRows.length,
      successCount,
      errorCount,
      results,
    });
  } catch (err) {
    console.error('课程导入错误:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
