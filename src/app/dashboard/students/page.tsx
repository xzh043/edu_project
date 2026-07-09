'use client';

import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Search, Plus, Pencil, Trash2, Eye, FolderOpen, Users, Upload, FileSpreadsheet, CheckCircle2, XCircle, Download, Loader2, Sparkles } from 'lucide-react';


interface ClassItem {
  id: string;
  name: string;
}

interface StudentItem {
  id: string;
  class_id: string;
  student_number: string;
  name: string;
  created_by: string;
  created_at: string;
  updated_by: string | null;
  updated_at: string | null;
  classes: { id: string; name: string } | null;
}

export default function StudentsPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [keyword, setSearchKeyword] = useState('');
  const [loading, setLoading] = useState(false);

  // 弹窗状态
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showView, setShowView] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  // 表单数据
  const [formClassId, setFormClassId] = useState('');
  const [formStudentNumber, setFormStudentNumber] = useState('');
  const [formName, setFormName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingStudent, setViewingStudent] = useState<StudentItem | null>(null);
  const [viewingAnalysis, setViewingAnalysis] = useState<any>(null);
  const [hotQuestions, setHotQuestions] = useState<any[]>([]);
  const [hotQuestionsLoading, setHotQuestionsLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
  const [aiSuggestionLoading, setAiSuggestionLoading] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 班级删除状态
  const [showDeleteClass, setShowDeleteClass] = useState(false);
  const [deletingClassId, setDeletingClassId] = useState<string | null>(null);
  const [deletingClassName, setDeletingClassName] = useState('');

  // 批量导入状态
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<{ className: string; studentNumber: string; name: string; password: string }[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<{
    total: number;
    successCount: number;
    errorCount: number;
    results: { row: number; className: string; studentNumber: string; name: string; status: string; message: string }[];
  } | null>(null);

  // 错误信息
  const [formError, setFormError] = useState('');

  // 获取当前用户名（用于 x-operator header，需要编码以支持中文）
  const getOperatorName = useCallback(() => {
    try {
      const user = localStorage.getItem('edu_user');
      const name = user ? JSON.parse(user).name : 'system';
      return encodeURIComponent(name);
    } catch {
      return 'system';
    }
  }, []);



  const fetchClasses = useCallback(async () => {
    try {
      const token = localStorage.getItem('edu_session') 
        ? JSON.parse(localStorage.getItem('edu_session') || '{}').access_token 
        : null;
      
      if (!token) {
        setClasses([]);
        return;
      }

      const res = await fetch('/api/classes', {
        headers: { 'x-session': token }
      });
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      
      const data = await res.json();
      setClasses(data || []);
    } catch (err) {
      console.error('获取班级失败:', err);
      setClasses([]);
    }
  }, []);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('edu_session') 
        ? JSON.parse(localStorage.getItem('edu_session') || '{}').access_token 
        : null;
      
      if (!token) {
        setStudents([]);
        return;
      }

      // 通过 API 获取，绕过 RLS
      const url = new URL('/api/students', window.location.origin);
      if (selectedClassId) {
        url.searchParams.set('class_id', selectedClassId);
      }
      if (keyword.trim()) {
        url.searchParams.set('keyword', keyword.trim());
      }

      const res = await fetch(url.toString(), {
        headers: { 'x-session': token }
      });
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      
      const data = await res.json();
      setStudents(data || []);
    } catch (err) {
      console.error('获取学生列表失败:', err);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [selectedClassId, keyword]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  // 格式化日期
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  // 重置表单
  const resetForm = () => {
    setFormClassId('');
    setFormStudentNumber('');
    setFormName('');
    setFormError('');
  };

  // 处理文件选择
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportResults(null);

    // 前端预览
    try {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) return;
      const sheet = workbook.Sheets[sheetName];
      const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      const preview: { className: string; studentNumber: string; name: string; password: string }[] = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;
        const className = String(row[0] ?? '').trim();
        const studentNumber = String(row[1] ?? '').trim();
        const name = String(row[2] ?? '').trim();
        const password = String(row[3] ?? '').trim();
        if (!className && !studentNumber && !name && !password) continue;
        preview.push({ className, studentNumber, name, password });
      }
      setImportPreview(preview);
    } catch (err) {
      console.error('解析 Excel 预览失败:', err);
      setImportPreview([]);
    }
  };

  // 执行导入
  const handleImport = async () => {
    if (!importFile) return;
    setImporting(true);
    try {
      const token = localStorage.getItem('edu_session') 
        ? JSON.parse(localStorage.getItem('edu_session') || '{}').access_token 
        : null;
      
      if (!token) {
        throw new Error('请先登录');
      }

      const formData = new FormData();
      formData.append('file', importFile);
      const res = await fetch('/api/students/import', {
        method: 'POST',
        headers: { 'x-session': token, 'x-operator': getOperatorName() },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || '导入失败');
        return;
      }
      setImportResults(data);
      fetchClasses();
      fetchStudents();
    } catch (err) {
      console.error('批量导入失败:', err);
      setFormError(err instanceof Error ? err.message : '导入失败，请重试');
    } finally {
      setImporting(false);
    }
  };

  // 下载导入模板
  const downloadTemplate = () => {
    const XLSX = require('xlsx');
    const wsData = [['班级', '学号', '姓名', '初始密码']];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    // 设置列宽
    ws['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '学生导入');
    XLSX.writeFile(wb, '学生导入模板.xlsx');
  };

  // 重置导入状态
  const resetImport = () => {
    setImportFile(null);
    setImportPreview([]);
    setImportResults(null);
    setFormError('');
  };

  // 新增学生
  const handleAdd = async () => {
    if (!formClassId || !formStudentNumber.trim() || !formName.trim()) {
      setFormError('请填写完整信息');
      return;
    }
    try {
      const token = localStorage.getItem('edu_session') 
        ? JSON.parse(localStorage.getItem('edu_session') || '{}').access_token 
        : null;
      
      if (!token) {
        throw new Error('请先登录');
      }

      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-session': token,
          'x-operator': getOperatorName()
        },
        body: JSON.stringify({
          class_id: formClassId,
          student_number: formStudentNumber.trim(),
          name: formName.trim()
        })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      
      setShowAdd(false);
      resetForm();
      fetchStudents();
    } catch (err) {
      console.error('新增学生失败:', err);
      setFormError(err instanceof Error ? err.message : '新增失败，请重试');
    }
  };

  // 编辑学生
  const handleEdit = async () => {
    if (!editingId || !formClassId || !formStudentNumber.trim() || !formName.trim()) {
      setFormError('请填写完整信息');
      return;
    }
    try {
      const token = localStorage.getItem('edu_session') 
        ? JSON.parse(localStorage.getItem('edu_session') || '{}').access_token 
        : null;
      
      if (!token) {
        throw new Error('请先登录');
      }

      const res = await fetch('/api/students', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-session': token,
          'x-operator': getOperatorName()
        },
        body: JSON.stringify({
          id: editingId,
          class_id: formClassId,
          student_number: formStudentNumber.trim(),
          name: formName.trim()
        })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      
      setShowEdit(false);
      resetForm();
      setEditingId(null);
      fetchStudents();
    } catch (err) {
      console.error('修改学生失败:', err);
      setFormError(err instanceof Error ? err.message : '修改失败，请重试');
    }
  };

  // 删除学生
  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      const token = localStorage.getItem('edu_session') 
        ? JSON.parse(localStorage.getItem('edu_session') || '{}').access_token 
        : null;
      
      if (!token) {
        throw new Error('请先登录');
      }

      const url = new URL('/api/students', window.location.origin);
      url.searchParams.set('id', deletingId);
      
      const res = await fetch(url.toString(), {
        method: 'DELETE',
        headers: { 
          'x-session': token,
          'x-operator': getOperatorName()
        }
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      
      setShowDelete(false);
      setDeletingId(null);
      fetchStudents();
    } catch (err) {
      console.error('删除学生失败:', err);
    }
  };

  // 打开编辑弹窗
  const openEdit = (student: StudentItem) => {
    setEditingId(student.id);
    setFormClassId(student.class_id);
    setFormStudentNumber(student.student_number);
    setFormName(student.name);
    setFormError('');
    setShowEdit(true);
  };

  // 打开查看弹窗
  const openView = async (student: StudentItem) => {
    setViewingStudent(student);
    setShowView(true);
    setAnalysisLoading(true);
    setViewingAnalysis(null);
    setHotQuestions([]);
    setAiSuggestions([]);
    try {
      setHotQuestionsLoading(true);
      const [analysisRes, hotRes, suggestionRes] = await Promise.all([
        fetch(`/api/students/analysis?student_id=${student.id}`),
        fetch(`/api/students/hot-questions?id_number=${student.student_number}`),
        fetch(`/api/students/ai-suggestion?student_id=${student.id}`),
      ]);
      if (analysisRes.ok) {
        const data = await analysisRes.json();
        setViewingAnalysis(data);
      }
      if (hotRes.ok) {
        const hotData = await hotRes.json();
        setHotQuestions(hotData.hot_questions || []);
      }
      if (suggestionRes.ok) {
        const sugData = await suggestionRes.json();
        setAiSuggestions(sugData.suggestions || []);
      }
    } finally {
      setAnalysisLoading(false);
      setHotQuestionsLoading(false);
    }
  };

  // 打开删除确认
  const openDelete = (id: string) => {
    setDeletingId(id);
    setShowDelete(true);
  };

  // 打开班级删除确认
  const openDeleteClass = (cls: ClassItem) => {
    setDeletingClassId(cls.id);
    setDeletingClassName(cls.name);
    setShowDeleteClass(true);
  };

  // 执行班级删除
  const handleDeleteClass = async () => {
    if (!deletingClassId) return;
    try {
      const token = localStorage.getItem('edu_session') 
        ? JSON.parse(localStorage.getItem('edu_session') || '{}').access_token 
        : null;
      
      if (!token) {
        throw new Error('请先登录');
      }

      const url = new URL('/api/classes', window.location.origin);
      url.searchParams.set('id', deletingClassId);
      
      const res = await fetch(url.toString(), {
        method: 'DELETE',
        headers: { 
          'x-session': token,
          'x-operator': getOperatorName()
        }
      });
      
      const result = await res.json();
      if (!res.ok) {
        alert(result.error || '删除班级失败');
        return;
      }
      
      if (selectedClassId === deletingClassId) {
        setSelectedClassId(null);
      }
      fetchClasses();
    } catch (err) {
      console.error('删除班级失败:', err);
      alert('删除班级失败');
    } finally {
      setShowDeleteClass(false);
      setDeletingClassId(null);
    }
  };

  return (
    <div className="flex h-full bg-white">
      {/* 左侧班级树 */}
      <div className="w-60 shrink-0 bg-white border-r border-gray-100 flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <FolderOpen className="size-4" />
            班级列表
          </h3>
        </div>
        <div className="flex-1 overflow-auto p-3 space-y-1">
          <button
            onClick={() => setSelectedClassId(null)}
            className={`flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all ${
              selectedClassId === null
                ? 'bg-[#1e3a5f] text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Users className="size-4" />
            全部
          </button>
          {classes.map((cls) => (
            <div
              key={cls.id}
              className={`group flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all cursor-pointer ${
                selectedClassId === cls.id
                  ? 'bg-[#1e3a5f] text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
              onClick={() => setSelectedClassId(cls.id)}
            >
              <span className="flex items-center gap-2.5 truncate">
                <Users className="size-4 shrink-0" />
                {cls.name}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); openDeleteClass(cls); }}
                className="shrink-0 rounded-lg p-1 opacity-0 transition-all hover:bg-red-500 hover:text-white group-hover:opacity-100"
                title="删除班级"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 右侧主内容 */}
      <div className="flex flex-1 flex-col">
        {/* 页面标题 */}
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1e3a5f]/10">
                <Users className="size-5 text-[#1e3a5f]" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">学生管理</h1>
                <p className="text-sm text-gray-500 mt-0.5">管理班级与学生信息</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => { resetForm(); setShowAdd(true); }} className="gap-2 bg-[#1e3a5f] text-white hover:bg-[#1e3a5f]/90">
                <Plus className="size-4" />
                新增学生
              </Button>
              <Button variant="outline" onClick={() => { resetImport(); setShowImport(true); }} className="gap-2 border-gray-200 text-gray-600 hover:bg-gray-50">
                <Upload className="size-4" />
                批量导入
              </Button>
            </div>
          </div>
        </div>

        {/* 工具栏 */}
        <div className="flex items-center justify-between bg-white px-6 py-3 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="搜索姓名或学号..."
              value={keyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="w-72 pl-9 bg-white border-gray-200"
            />
          </div>
          <span className="text-sm text-gray-500">共 {students.length} 名学生</span>
        </div>

        {/* 学生列表 */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-gray-400">
              <div className="h-6 w-6 animate-spin rounded-full border-3 border-[#1e3a5f] border-t-transparent" />
              <span className="ml-3">加载中...</span>
            </div>
          ) : students.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Users className="mb-3 size-16 opacity-20" />
              <p className="text-base">暂无学生数据</p>
              <p className="text-sm mt-1">点击"新增学生"或"批量导入"开始</p>
            </div>
          ) : (
            <div className="rounded-2xl bg-white shadow-sm overflow-hidden border border-gray-100">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#F5F7FA] hover:bg-[#F5F7FA]">
                    <TableHead className="w-[120px] text-gray-600 font-semibold">班级</TableHead>
                    <TableHead className="w-[120px] text-gray-600 font-semibold">学号</TableHead>
                    <TableHead className="w-[100px] text-gray-600 font-semibold">姓名</TableHead>
                    <TableHead className="w-[100px] text-gray-600 font-semibold">创建人员</TableHead>
                    <TableHead className="w-[160px] text-gray-600 font-semibold">创建时间</TableHead>
                    <TableHead className="w-[100px] text-gray-600 font-semibold">修改人员</TableHead>
                    <TableHead className="w-[160px] text-gray-600 font-semibold">修改时间</TableHead>
                    <TableHead className="w-[120px] text-center text-gray-600 font-semibold">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student) => (
                    <TableRow key={student.id} className="hover:bg-gray-50 border-gray-50">
                      <TableCell>
                        <span className="inline-flex items-center rounded-lg bg-[#1e3a5f]/5 px-2 py-0.5 text-xs font-medium text-[#1e3a5f]">
                          {student.classes?.name || '-'}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-gray-700">{student.student_number}</TableCell>
                      <TableCell className="font-medium text-gray-900">{student.name}</TableCell>
                      <TableCell className="text-gray-600">{student.created_by || '-'}</TableCell>
                      <TableCell className="text-gray-400">{formatDate(student.created_at)}</TableCell>
                      <TableCell className="text-gray-600">{student.updated_by || '-'}</TableCell>
                      <TableCell className="text-gray-400">{formatDate(student.updated_at)}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-gray-400 hover:text-[#1e3a5f] hover:bg-[#1e3a5f]/5"
                            onClick={() => openView(student)}
                            title="查看"
                          >
                            <Eye className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-gray-400 hover:text-[#1e3a5f] hover:bg-[#1e3a5f]/5"
                            onClick={() => openEdit(student)}
                            title="编辑"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-gray-400 hover:text-red-600 hover:bg-red-50"
                            onClick={() => openDelete(student.id)}
                            title="删除"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* 新增学生弹窗 */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1e3a5f]/10">
                <Plus className="size-4 text-[#1e3a5f]" />
              </div>
              新增学生
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label className="text-gray-700 font-medium">班级 <span className="text-red-500">*</span></Label>
              <Select value={formClassId} onValueChange={setFormClassId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="请选择班级" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-700 font-medium">学号 <span className="text-red-500">*</span></Label>
              <Input
                placeholder="请输入学号"
                value={formStudentNumber}
                onChange={(e) => setFormStudentNumber(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-700 font-medium">姓名 <span className="text-red-500">*</span></Label>
              <Input
                placeholder="请输入姓名"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            {formError && (
              <p className="text-sm text-red-500">{formError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAdd(false); resetForm(); }}>
              取消
            </Button>
            <Button onClick={handleAdd} className="bg-[#1e3a5f] hover:bg-[#2a5298]">确认</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑学生弹窗 */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1e3a5f]/10">
                <Pencil className="size-4 text-[#1e3a5f]" />
              </div>
              编辑学生
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label className="text-gray-700 font-medium">班级 <span className="text-red-500">*</span></Label>
              <Select value={formClassId} onValueChange={setFormClassId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="请选择班级" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-700 font-medium">学号 <span className="text-red-500">*</span></Label>
              <Input
                placeholder="请输入学号"
                value={formStudentNumber}
                onChange={(e) => setFormStudentNumber(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-700 font-medium">姓名 <span className="text-red-500">*</span></Label>
              <Input
                placeholder="请输入姓名"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            {formError && (
              <p className="text-sm text-red-500">{formError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEdit(false); resetForm(); setEditingId(null); }}>
              取消
            </Button>
            <Button onClick={handleEdit} className="bg-[#1e3a5f] hover:bg-[#2a5298]">保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 查看学生弹窗 */}
      <Dialog open={showView} onOpenChange={setShowView}>
        <DialogContent className="sm:max-w-[720px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1e3a5f]/10">
                <Eye className="size-4 text-[#1e3a5f]" />
              </div>
              学生详情
            </DialogTitle>
          </DialogHeader>
          {viewingStudent && (
            <div className="flex-1 overflow-auto space-y-4 py-1">
              {/* 基本信息 + 四指标 */}
              <div className="grid grid-cols-[auto_1fr] gap-4">
                {/* 左侧基本信息 */}
                <div className="rounded-2xl border border-gray-100 p-4 flex flex-col items-center justify-center gap-2 min-w-[140px]">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#1e3a5f] text-2xl font-bold text-white">
                    {viewingStudent.name.charAt(0)}
                  </div>
                  <div className="text-base font-bold text-gray-900">{viewingStudent.name}</div>
                  <div className="text-xs text-gray-500 font-mono">{viewingStudent.student_number}</div>
                  <div className="text-xs text-gray-400">{viewingStudent.classes?.name || '-'}</div>
                </div>
                {/* 右侧四指标 */}
                {analysisLoading ? (
                  <div className="flex items-center justify-center text-sm text-gray-400">加载中...</div>
                ) : viewingAnalysis ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-blue-50 p-4">
                      <div className="text-2xl font-extrabold text-blue-600">{viewingAnalysis.analysis.completion_rate}<span className="text-sm font-normal">%</span></div>
                      <div className="mt-1 text-xs text-blue-400">作业完成率</div>
                      <div className="mt-2 h-1.5 rounded-full bg-blue-100">
                        <div className="h-full rounded-full bg-blue-500" style={{width: `${Math.min(viewingAnalysis.analysis.completion_rate, 100)}%`}} />
                      </div>
                    </div>
                    <div className="rounded-xl bg-emerald-50 p-4">
                      <div className="text-2xl font-extrabold text-emerald-600">{viewingAnalysis.analysis.accuracy_rate}<span className="text-sm font-normal">%</span></div>
                      <div className="mt-1 text-xs text-emerald-400">测评正确率</div>
                      <div className="mt-2 h-1.5 rounded-full bg-emerald-100">
                        <div className="h-full rounded-full bg-emerald-500" style={{width: `${Math.min(viewingAnalysis.analysis.accuracy_rate, 100)}%`}} />
                      </div>
                    </div>
                    <div className="rounded-xl bg-amber-50 p-4">
                      <div className="text-2xl font-extrabold text-amber-600">{viewingAnalysis.analysis.class_rank}<span className="text-sm font-normal">/{viewingAnalysis.analysis.total_classmates}</span></div>
                      <div className="mt-1 text-xs text-amber-400">班级排名</div>
                    </div>
                    <div className="rounded-xl bg-purple-50 p-4">
                      <div className="text-2xl font-extrabold text-purple-600">{viewingAnalysis.analysis.submitted_assignments}<span className="text-sm font-normal">/{viewingAnalysis.analysis.total_assignments}</span></div>
                      <div className="mt-1 text-xs text-purple-400">已提交作业</div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center text-sm text-gray-400">暂无学情数据</div>
                )}
              </div>

              {/* 成绩趋势 + 热点提问 */}
              <div className="grid grid-cols-2 gap-4">
                {/* 成绩趋势 */}
                <div className="rounded-2xl border border-gray-100 p-4">
                  <div className="mb-3 text-sm font-semibold text-gray-700">历次成绩趋势</div>
                  {analysisLoading ? (
                    <div className="py-6 text-center text-xs text-gray-400">加载中...</div>
                  ) : viewingAnalysis && viewingAnalysis.score_trend.length > 0 ? (
                    <div className="flex items-end gap-1.5" style={{ height: 100 }}>
                      {viewingAnalysis.score_trend.map((item: any, idx: number) => {
                        const barHeight = Math.max(item.rate, 4);
                        const color = item.rate >= 60 ? '#10b981' : item.rate >= 40 ? '#f59e0b' : '#ef4444';
                        return (
                          <div key={idx} className="flex flex-1 flex-col items-center gap-1" title={`${item.assignment_name}: ${item.rate}%`}>
                            <div className="text-[10px] font-bold" style={{ color }}>{item.rate}%</div>
                            <div className="w-full rounded-t transition-all" style={{ height: `${barHeight}%`, background: color, minHeight: 4 }} />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-6 text-center text-xs text-gray-400">暂无成绩记录</div>
                  )}
                </div>

                {/* 热点提问 */}
                <div className="rounded-2xl border border-gray-100 p-4">
                  <div className="mb-3 text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                    <svg className="h-4 w-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /></svg>
                    热点提问
                  </div>
                  {hotQuestionsLoading ? (
                    <div className="py-4 text-center text-xs text-gray-400">加载中...</div>
                  ) : hotQuestions.length > 0 ? (
                    <div className="space-y-2">
                      {hotQuestions.map((q: any, idx: number) => {
                        const maxCount = Math.max(...hotQuestions.map((x: any) => x.count));
                        const pct = maxCount > 0 ? (q.count / maxCount) * 100 : 0;
                        return (
                          <div key={idx} className="flex items-center gap-2">
                            <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-orange-100 text-[10px] font-bold text-orange-600">{idx + 1}</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs text-gray-700 truncate">{q.knowledge_point}</div>
                              <div className="mt-0.5 h-1 rounded-full bg-orange-100">
                                <div className="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-500" style={{width: `${pct}%`}} />
                              </div>
                            </div>
                            <span className="text-xs font-semibold text-orange-500 flex-shrink-0">{q.count}次</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-4 text-center text-xs text-gray-400">暂无提问数据</div>
                  )}
                </div>
              </div>

              {/* AI学习建议 */}
              <div className="rounded-2xl border border-gray-100 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-indigo-500" />
                    <span className="text-sm font-semibold text-gray-700">AI学习建议</span>
                  </div>
                  <Button
                    size="sm"
                    onClick={async () => {
                      if (!viewingStudent) return;
                      setAiSuggestionLoading(true);
                      try {
                        const res = await fetch('/api/students/ai-suggestion', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            student_id: viewingStudent.id,
                            student_number: viewingStudent.student_number,
                          }),
                        });
                        if (res.ok) {
                          const data = await res.json();
                          if (data.suggestion) {
                            setAiSuggestions([data.suggestion]);
                          }
                        }
                      } catch (e) {
                        console.error('Failed to generate AI suggestion', e);
                      } finally {
                        setAiSuggestionLoading(false);
                      }
                    }}
                    disabled={aiSuggestionLoading}
                    className="h-7 bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3"
                  >
                    {aiSuggestionLoading ? (
                      <><Loader2 className="h-3 w-3 animate-spin mr-1" />生成中...</>
                    ) : (
                      <><Sparkles className="h-3 w-3 mr-1" />生成建议</>
                    )}
                  </Button>
                </div>
                {aiSuggestions.length > 0 ? (
                  <div className="rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                      <span className="text-xs font-medium text-indigo-600">
                        {new Date(aiSuggestions[0].created_at).toLocaleString('zh-CN')}
                      </span>
                    </div>
                    <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {aiSuggestions[0].content}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-200 py-5 text-center text-xs text-gray-400">
                    点击"生成建议"获取个性化学习建议
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowView(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗 */}
      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除该学生吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingId(null)}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white hover:bg-destructive/90">确认删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 班级删除确认弹窗 */}
      <AlertDialog open={showDeleteClass} onOpenChange={setShowDeleteClass}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除班级</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除班级「{deletingClassName}」吗？班级下有学生时无法删除，需先移除或转出学生。此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteClass} className="bg-destructive text-white hover:bg-destructive/90">确认删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 批量导入弹窗 */}
      <Dialog open={showImport} onOpenChange={(open) => { if (!open) resetImport(); setShowImport(open); }}>
        <DialogContent className="sm:max-w-[640px] max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1e3a5f]/10">
                <FileSpreadsheet className="size-4 text-[#1e3a5f]" />
              </div>
              批量导入学生
            </DialogTitle>
          </DialogHeader>

          {!importResults ? (
            <div className="flex-1 overflow-auto space-y-4 py-2">
              {/* 说明与模板下载 */}
              <div className="rounded-xl border border-dashed border-gray-300 p-4 space-y-2">
                <p className="text-sm font-semibold text-gray-800">导入说明</p>
                <ul className="text-sm text-gray-500 space-y-1 list-disc pl-4">
                  <li>Excel 第一行为表头，依次为：班级、学号、姓名、初始密码</li>
                  <li>班级不存在时将自动创建</li>
                  <li>学号重复的行将跳过</li>
                  <li>初始密码将用于学生登录账号</li>
                </ul>
                <Button variant="link" size="sm" className="gap-1 px-0 text-[#1e3a5f]" onClick={downloadTemplate}>
                  <Download className="size-3.5" />
                  下载导入模板
                </Button>
              </div>

              {/* 文件上传 */}
              <div className="space-y-2">
                <Label className="text-gray-700 font-medium">选择文件</Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileSelect}
                    className="flex-1"
                  />
                </div>
                {importFile && (
                  <p className="text-xs text-gray-400">
                    已选择：{importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              {/* 数据预览 */}
              {importPreview.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-gray-700 font-medium">数据预览（共 {importPreview.length} 条）</Label>
                  <div className="max-h-[240px] overflow-auto rounded-xl border border-gray-100">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-[#F5F7FA]">
                          <TableHead className="w-[50px] text-gray-600 font-semibold">序号</TableHead>
                          <TableHead className="text-gray-600 font-semibold">班级</TableHead>
                          <TableHead className="text-gray-600 font-semibold">学号</TableHead>
                          <TableHead className="text-gray-600 font-semibold">姓名</TableHead>
                          <TableHead className="text-gray-600 font-semibold">初始密码</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importPreview.slice(0, 50).map((row, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="text-gray-400">{idx + 1}</TableCell>
                            <TableCell>{row.className || <span className="text-red-500">空</span>}</TableCell>
                            <TableCell className="font-mono">{row.studentNumber || <span className="text-red-500">空</span>}</TableCell>
                            <TableCell>{row.name || <span className="text-red-500">空</span>}</TableCell>
                            <TableCell>{row.password ? '••••••' : <span className="text-red-500">空</span>}</TableCell>
                          </TableRow>
                        ))}
                        {importPreview.length > 50 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-gray-400">
                              ... 还有 {importPreview.length - 50} 条数据
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {formError && (
                <p className="text-sm text-red-500">{formError}</p>
              )}
            </div>
          ) : (
            /* 导入结果 */
            <div className="flex-1 overflow-auto space-y-4 py-2">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-gray-100 p-4 text-center">
                  <p className="text-2xl font-bold text-gray-800">{importResults.total}</p>
                  <p className="text-xs text-gray-500 mt-1">总计</p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-4 text-center">
                  <p className="text-2xl font-bold text-emerald-600">{importResults.successCount}</p>
                  <p className="text-xs text-gray-500 mt-1">成功</p>
                </div>
                <div className="rounded-xl bg-red-50 p-4 text-center">
                  <p className="text-2xl font-bold text-red-500">{importResults.errorCount}</p>
                  <p className="text-xs text-gray-500 mt-1">失败</p>
                </div>
              </div>

              {importResults.results.length > 0 && (
                <div className="max-h-[300px] overflow-auto rounded-xl border border-gray-100">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-[#F5F7FA]">
                        <TableHead className="w-[50px] text-gray-600 font-semibold">行号</TableHead>
                        <TableHead className="text-gray-600 font-semibold">班级</TableHead>
                        <TableHead className="text-gray-600 font-semibold">学号</TableHead>
                        <TableHead className="text-gray-600 font-semibold">姓名</TableHead>
                        <TableHead className="text-gray-600 font-semibold">状态</TableHead>
                        <TableHead className="text-gray-600 font-semibold">说明</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importResults.results.map((r, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-gray-400">{r.row}</TableCell>
                          <TableCell>{r.className}</TableCell>
                          <TableCell className="font-mono">{r.studentNumber}</TableCell>
                          <TableCell>{r.name}</TableCell>
                          <TableCell>
                            {r.status === 'success' ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600">
                                <CheckCircle2 className="size-3.5" /> 成功
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-red-500">
                                <XCircle className="size-3.5" /> 失败
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-gray-400">{r.message}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {!importResults ? (
              <>
                <Button variant="outline" onClick={() => { resetImport(); setShowImport(false); }}>取消</Button>
                <Button onClick={handleImport} disabled={!importFile || importing || importPreview.length === 0} className="bg-[#1e3a5f] hover:bg-[#2a5298]">
                  {importing ? '导入中...' : '开始导入'}
                </Button>
              </>
            ) : (
              <Button onClick={() => { resetImport(); setShowImport(false); }} className="bg-[#1e3a5f] hover:bg-[#2a5298]">完成</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
