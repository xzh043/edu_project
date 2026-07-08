import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import * as XLSX from 'xlsx';

interface ImportRow {
  className: string;
  studentNumber: string;
  name: string;
  password: string;
}

interface ImportResult {
  row: number;
  className: string;
  studentNumber: string;
  name: string;
  status: 'success' | 'error';
  message: string;
}

export async function POST(req: NextRequest) {
  try {
    // 使用 service role key，不需要验证 token
    const client = getSupabaseClient();
    const operatorName = decodeURIComponent(req.headers.get('x-operator') || 'system');

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
    const importRows: ImportRow[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      const className = String(row[0] ?? '').trim();
      const studentNumber = String(row[1] ?? '').trim();
      const name = String(row[2] ?? '').trim();
      const password = String(row[3] ?? '').trim();

      if (!className && !studentNumber && !name && !password) continue; // 跳过空行

      importRows.push({ className, studentNumber, name, password });
    }

    if (importRows.length === 0) {
      return NextResponse.json({ error: '没有有效的数据行' }, { status: 400 });
    }

    // 获取现有班级
    const { data: existingClasses } = await client
      .from('classes')
      .select('id, name');
    const classMap = new Map<string, string>();
    for (const cls of existingClasses || []) {
      classMap.set(cls.name, cls.id);
    }

    // 获取现有学号
    const { data: existingStudents } = await client
      .from('students')
      .select('student_number');
    const studentNumberSet = new Set<string>();
    for (const s of existingStudents || []) {
      studentNumberSet.add(s.student_number);
    }

    // 逐行处理
    const results: ImportResult[] = [];
    const newClassNames = new Set<string>();

    // 第一遍：收集需要新建的班级
    for (const row of importRows) {
      if (row.className && !classMap.has(row.className)) {
        newClassNames.add(row.className);
      }
    }

    // 批量创建不存在的班级
    for (const className of newClassNames) {
      const { data, error } = await client
        .from('classes')
        .insert({ name: className, created_by: operatorName })
        .select('id, name')
        .single();
      if (error) {
        console.error(`创建班级"${className}"失败:`, error);
      } else if (data) {
        classMap.set(data.name, data.id);
      }
    }

    // 第二遍：逐行导入学生
    for (let i = 0; i < importRows.length; i++) {
      const row = importRows[i];
      const rowNum = i + 2; // Excel 行号（1-based + 1 表头）

      // 校验
      if (!row.className) {
        results.push({ row: rowNum, className: row.className, studentNumber: row.studentNumber, name: row.name, status: 'error', message: '班级不能为空' });
        continue;
      }
      if (!row.studentNumber) {
        results.push({ row: rowNum, className: row.className, studentNumber: row.studentNumber, name: row.name, status: 'error', message: '学号不能为空' });
        continue;
      }
      if (!row.name) {
        results.push({ row: rowNum, className: row.className, studentNumber: row.studentNumber, name: row.name, status: 'error', message: '姓名不能为空' });
        continue;
      }
      // 密码为空时默认 123456
      const password = row.password || '123456';

      // 检查班级是否存在
      const classId = classMap.get(row.className);
      if (!classId) {
        results.push({ row: rowNum, className: row.className, studentNumber: row.studentNumber, name: row.name, status: 'error', message: '班级创建失败，请重试' });
        continue;
      }

      // 检查学号是否已存在
      if (studentNumberSet.has(row.studentNumber)) {
        results.push({ row: rowNum, className: row.className, studentNumber: row.studentNumber, name: row.name, status: 'error', message: '该学号已存在' });
        continue;
      }

      // 注册 Supabase Auth 账号（通过 Admin API）
      const supabaseUrl = process.env.SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const virtualEmail = `${row.studentNumber}@student.edusys`;
      let authUserId: string | null = null;

      try {
        const authResp = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': serviceRoleKey!,
            'Authorization': `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            email: virtualEmail,
            password: password,
            email_confirm: true,
            user_metadata: {
              role: 'student',
              name: row.name,
              student_id: row.studentNumber,
            },
          }),
        });

        if (authResp.ok) {
          const authData = await authResp.json();
          authUserId = authData.id;
        } else {
          const authErrData = await authResp.json();
          console.error(`注册学生账号 ${virtualEmail} 失败:`, authErrData);
        }
      } catch (authErr) {
        console.error(`注册学生账号 ${virtualEmail} 异常:`, authErr);
      }

      // 创建 profile
      if (authUserId) {
        await client
          .from('profiles')
          .insert({
            user_id: authUserId,
            role: 'student',
            name: row.name,
            student_id: row.studentNumber,
          });
      }

      // 创建学生记录
      const { error: insertError } = await client
        .from('students')
        .insert({
          class_id: classId,
          student_number: row.studentNumber,
          name: row.name,
          created_by: operatorName,
        });

      if (insertError) {
        results.push({ row: rowNum, className: row.className, studentNumber: row.studentNumber, name: row.name, status: 'error', message: insertError.message });
        continue;
      }

      // 标记学号已使用
      studentNumberSet.add(row.studentNumber);
      results.push({ row: rowNum, className: row.className, studentNumber: row.studentNumber, name: row.name, status: 'success', message: '导入成功' });
    }

    const successCount = results.filter((r) => r.status === 'success').length;
    const errorCount = results.filter((r) => r.status === 'error').length;

    return NextResponse.json({
      success: true,
      total: importRows.length,
      successCount,
      errorCount,
      results,
    });
  } catch (err) {
    console.error('批量导入学生错误:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
