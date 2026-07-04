'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Upload, Download, Plus, Pencil, Trash2, KeyRound, User, BookOpen, Settings } from 'lucide-react';
import * as XLSX from 'xlsx';

interface CourseItem {
  id: string;
  chapter_name: string;
  knowledge_name: string;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string | null;
}

interface ImportPreviewRow {
  chapterName: string;
  knowledgeName: string;
}

export default function SettingsPage() {
  const { user } = useAuth();

  // 密码修改
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 课程管理
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [courseDialogOpen, setCourseDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<CourseItem | null>(null);
  const [courseForm, setCourseForm] = useState({ chapter_name: '', knowledge_name: '' });
  const [courseFormError, setCourseFormError] = useState('');
  const [deleteCourseId, setDeleteCourseId] = useState<string | null>(null);
  const [deleteCourseName, setDeleteCourseName] = useState('');

  // 课程导入
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreviewRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ total: number; successCount: number; errorCount: number } | null>(null);

  // 格式化时间
  const formatTime = (isoStr: string | null) => {
    if (!isoStr) return '-';
    const d = new Date(isoStr);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  // 获取当前操作人名称
  const operatorName = user?.name || '';

  // 获取课程列表
  const fetchCourses = useCallback(async () => {
    try {
      const res = await fetch('/api/courses');
      if (res.ok) {
        const data = await res.json();
        setCourses(data);
      }
    } catch (err) {
      console.error('获取课程列表失败:', err);
    } finally {
      setCoursesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  // 修改密码
  const handlePasswordChange = async () => {
    setPasswordMsg(null);
    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordMsg({ type: 'error', text: '请填写所有密码字段' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: '新密码长度不能少于6位' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: '两次输入的新密码不一致' });
      return;
    }

    setPasswordLoading(true);
    try {
      const storedUser = JSON.parse(localStorage.getItem('edu_user') || '{}');
      const userId = storedUser?.id;
      if (!userId) return;

      const res = await fetch('/api/auth/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, oldPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setPasswordMsg({ type: 'success', text: '密码修改成功' });
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordMsg({ type: 'error', text: data.error || '密码修改失败' });
      }
    } catch {
      setPasswordMsg({ type: 'error', text: '网络错误' });
    } finally {
      setPasswordLoading(false);
    }
  };

  // 课程表单提交
  const handleCourseSubmit = async () => {
    setCourseFormError('');
    if (!courseForm.chapter_name.trim() || !courseForm.knowledge_name.trim()) {
      setCourseFormError('章节名称和知识点名称不能为空');
      return;
    }

    try {
      const url = editingCourse ? '/api/courses' : '/api/courses';
      const method = editingCourse ? 'PUT' : 'POST';
      const body = editingCourse
        ? { id: editingCourse.id, ...courseForm }
        : courseForm;

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-operator': operatorName,
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setCourseDialogOpen(false);
        setEditingCourse(null);
        setCourseForm({ chapter_name: '', knowledge_name: '' });
        fetchCourses();
      } else {
        const data = await res.json();
        setCourseFormError(data.error || '操作失败');
      }
    } catch {
      setCourseFormError('网络错误');
    }
  };

  // 删除课程
  const handleDeleteCourse = async () => {
    if (!deleteCourseId) return;
    try {
      const res = await fetch(`/api/courses?id=${deleteCourseId}`, {
        method: 'DELETE',
        headers: { 'x-operator': operatorName },
      });
      if (res.ok) {
        fetchCourses();
      }
    } catch (err) {
      console.error('删除课程失败:', err);
    } finally {
      setDeleteCourseId(null);
    }
  };

  // 下载导入模板
  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['章节名称', '知识点名称'],
      ['示例章节', '示例知识点'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '课程信息');
    XLSX.writeFile(wb, '课程信息导入模板.xlsx');
  };

  // 处理文件上传预览
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return;
    const sheet = workbook.Sheets[sheetName];
    const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    const preview: ImportPreviewRow[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      const chapterName = String(row[0] ?? '').trim();
      const knowledgeName = String(row[1] ?? '').trim();
      if (!chapterName && !knowledgeName) continue;
      preview.push({ chapterName, knowledgeName });
    }

    setImportPreview(preview);
    setImportResult(null);

    // 重置 input 以允许重新选择同一文件
    e.target.value = '';
  };

  // 执行导入
  const handleImportConfirm = async () => {
    if (importPreview.length === 0) return;
    setImporting(true);
    try {
      // 由于上面重置了 input，需要用 preview 数据构建 Excel 再上传
      const fileInput = document.getElementById('course-import-input') as HTMLInputElement;
      const file = fileInput?.files?.[0];

      // 由于上面重置了 input，需要用 preview 数据构建 Excel 再上传
      const ws = XLSX.utils.aoa_to_sheet([
        ['章节名称', '知识点名称'],
        ...importPreview.map(r => [r.chapterName, r.knowledgeName]),
      ]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '课程信息');
      const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbOut], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const formData = new FormData();
      formData.append('file', blob, '课程信息.xlsx');

      const res = await fetch('/api/courses/import', {
        method: 'POST',
        headers: { 'x-operator': operatorName },
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setImportResult({
          total: data.total,
          successCount: data.successCount,
          errorCount: data.errorCount,
        });
        fetchCourses();
      } else {
        setImportResult({ total: importPreview.length, successCount: 0, errorCount: importPreview.length });
      }
    } catch {
      setImportResult({ total: importPreview.length, successCount: 0, errorCount: importPreview.length });
    } finally {
      setImporting(false);
    }
  };

  // 按章节分组
  const groupedCourses = courses.reduce<Record<string, CourseItem[]>>((acc, course) => {
    const key = course.chapter_name;
    if (!acc[key]) acc[key] = [];
    acc[key].push(course);
    return acc;
  }, {});

  return (
    <div className="h-full overflow-auto bg-white">
      <Tabs defaultValue="account" className="h-full">
        <div className="px-6 pt-5 pb-0 border-b border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1e3a5f]/10">
              <Settings className="size-5 text-[#1e3a5f]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">系统设置</h1>
              <p className="text-sm text-gray-500 mt-0.5">账号与课程管理</p>
            </div>
          </div>
          <TabsList className="bg-transparent h-auto p-0 gap-0">
            <TabsTrigger
              value="account"
              className="rounded-none border-0 border-b-2 border-transparent px-5 pb-3 pt-2 text-sm text-gray-400 shadow-none transition-all data-[state=active]:border-b-2 data-[state=active]:border-[#1e3a5f] data-[state=active]:bg-transparent data-[state=active]:text-[#1e3a5f] data-[state=active]:font-semibold data-[state=active]:shadow-[0_2px_8px_rgba(30,58,95,0.15)]"
            >
              <User className="mr-1.5 size-4" />
              账号管理
            </TabsTrigger>
            <TabsTrigger
              value="course"
              className="rounded-none border-0 border-b-2 border-transparent px-5 pb-3 pt-2 text-sm text-gray-400 shadow-none transition-all data-[state=active]:border-b-2 data-[state=active]:border-[#1e3a5f] data-[state=active]:bg-transparent data-[state=active]:text-[#1e3a5f] data-[state=active]:font-semibold data-[state=active]:shadow-[0_2px_8px_rgba(30,58,95,0.15)]"
            >
              <BookOpen className="mr-1.5 size-4" />
              课程管理
            </TabsTrigger>
          </TabsList>
        </div>

        {/* 账号管理 */}
        <TabsContent value="account" className="p-6 m-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 基本信息 */}
            <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1e3a5f]/10">
                    <User className="size-3.5 text-[#1e3a5f]" />
                  </div>
                  基本信息
                </h3>
                <p className="text-sm text-gray-500 mt-1">当前登录账号的基本信息</p>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-500 w-16">姓名</span>
                    <span className="text-sm font-semibold text-gray-800">{user?.name || '-'}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-500 w-16">工号</span>
                    <span className="text-sm font-semibold text-gray-800">{user?.employee_id || '-'}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-500 w-16">手机号</span>
                    <span className="text-sm font-semibold text-gray-800">{user?.phone ? user.phone.slice(0, 3) + '****' + user.phone.slice(-4) : '-'}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-500 w-16">角色</span>
                    <span className="inline-flex items-center rounded-lg bg-[#1e3a5f]/10 px-2.5 py-0.5 text-xs font-semibold text-[#1e3a5f]">
                      {user?.role === 'teacher' ? '教师' : '学生'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 修改密码 */}
            <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1e3a5f]/10">
                    <KeyRound className="size-3.5 text-[#1e3a5f]" />
                  </div>
                  修改密码
                </h3>
                <p className="text-sm text-gray-500 mt-1">修改当前账号的登录密码</p>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="oldPassword" className="text-gray-700 font-medium">旧密码</Label>
                    <Input
                      id="oldPassword"
                      type="password"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      placeholder="请输入旧密码"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword" className="text-gray-700 font-medium">新密码</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="请输入新密码（6位以上）"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-gray-700 font-medium">确认新密码</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="请再次输入新密码"
                    />
                  </div>
                  {passwordMsg && (
                    <p className={`text-sm ${passwordMsg.type === 'success' ? 'text-emerald-600' : 'text-red-500'}`}>
                      {passwordMsg.text}
                    </p>
                  )}
                  <Button
                    onClick={handlePasswordChange}
                    disabled={passwordLoading}
                    className="bg-[#1e3a5f] hover:bg-[#2a5298]"
                  >
                    <KeyRound className="mr-2 size-4" />
                    {passwordLoading ? '修改中...' : '修改密码'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 课程管理 */}
        <TabsContent value="course" className="p-6 m-0">
          <div className="space-y-4">
            {/* 工具栏 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => {
                    setEditingCourse(null);
                    setCourseForm({ chapter_name: '', knowledge_name: '' });
                    setCourseFormError('');
                    setCourseDialogOpen(true);
                  }}
                  className="bg-[#1e3a5f] hover:bg-[#2a5298]"
                >
                  <Plus className="mr-2 size-4" />
                  新增知识点
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setImportPreview([]);
                    setImportResult(null);
                    setImportDialogOpen(true);
                  }}
                >
                  <Upload className="mr-2 size-4" />
                  批量导入
                </Button>
                <Button variant="outline" onClick={downloadTemplate}>
                  <Download className="mr-2 size-4" />
                  下载模板
                </Button>
              </div>
              <span className="text-sm text-gray-500">
                共 {Object.keys(groupedCourses).length} 个章节，{courses.length} 个知识点
              </span>
            </div>

            {/* 课程列表 - 按章节分组 */}
            {coursesLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex items-center gap-2 text-gray-400">
                  <div className="size-2 animate-pulse rounded-full bg-[#1e3a5f]" />
                  <div className="size-2 animate-pulse rounded-full bg-[#1e3a5f] [animation-delay:0.2s]" />
                  <div className="size-2 animate-pulse rounded-full bg-[#1e3a5f] [animation-delay:0.4s]" />
                  <span className="ml-2 text-sm">加载中...</span>
                </div>
              </div>
            ) : courses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <BookOpen className="mb-4 size-16 opacity-20" />
                <p className="text-sm">暂无课程数据，请新增或导入</p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedCourses).map(([chapter, items]) => (
                  <div key={chapter} className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100">
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-semibold text-gray-800">{chapter}</h3>
                        <span className="text-xs text-gray-400">{items.length} 个知识点</span>
                      </div>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-[60px] text-gray-600 font-semibold">序号</TableHead>
                          <TableHead className="text-gray-600 font-semibold">知识点名称</TableHead>
                          <TableHead className="text-gray-600 font-semibold">创建人员</TableHead>
                          <TableHead className="text-gray-600 font-semibold">创建时间</TableHead>
                          <TableHead className="text-gray-600 font-semibold">修改人员</TableHead>
                          <TableHead className="text-gray-600 font-semibold">修改时间</TableHead>
                          <TableHead className="w-[100px] text-right text-gray-600 font-semibold">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item, idx) => (
                          <TableRow key={item.id} className="border-gray-50 hover:bg-gray-50">
                            <TableCell className="text-gray-400">{idx + 1}</TableCell>
                            <TableCell className="font-medium text-gray-800">{item.knowledge_name}</TableCell>
                            <TableCell className="text-gray-500">{item.created_by || '-'}</TableCell>
                            <TableCell className="text-gray-400">{formatTime(item.created_at)}</TableCell>
                            <TableCell className="text-gray-500">{item.updated_by || '-'}</TableCell>
                            <TableCell className="text-gray-400">{formatTime(item.updated_at)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 text-gray-400 hover:text-[#1e3a5f] hover:bg-[#1e3a5f]/5"
                                  onClick={() => {
                                    setEditingCourse(item);
                                    setCourseForm({
                                      chapter_name: item.chapter_name,
                                      knowledge_name: item.knowledge_name,
                                    });
                                    setCourseFormError('');
                                    setCourseDialogOpen(true);
                                  }}
                                >
                                  <Pencil className="size-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 text-gray-400 hover:text-red-600 hover:bg-red-50"
                                  onClick={() => {
                                    setDeleteCourseId(item.id);
                                    setDeleteCourseName(`${item.chapter_name} - ${item.knowledge_name}`);
                                  }}
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
                ))}
              </div>
            )}
          </div>

          {/* 新增/编辑知识点 Dialog */}
          <Dialog open={courseDialogOpen} onOpenChange={setCourseDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1e3a5f]/10">
                    {editingCourse ? <Pencil className="size-4 text-[#1e3a5f]" /> : <Plus className="size-4 text-[#1e3a5f]" />}
                  </div>
                  {editingCourse ? '编辑知识点' : '新增知识点'}
                </DialogTitle>
                <DialogDescription>
                  {editingCourse ? '修改章节和知识点信息' : '填写章节名称和知识点名称'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-5 py-2">
                <div className="space-y-2">
                  <Label htmlFor="chapter_name" className="text-gray-700 font-medium">章节名称</Label>
                  <Input
                    id="chapter_name"
                    value={courseForm.chapter_name}
                    onChange={(e) => setCourseForm({ ...courseForm, chapter_name: e.target.value })}
                    placeholder="请输入章节名称"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="knowledge_name" className="text-gray-700 font-medium">知识点名称</Label>
                  <Input
                    id="knowledge_name"
                    value={courseForm.knowledge_name}
                    onChange={(e) => setCourseForm({ ...courseForm, knowledge_name: e.target.value })}
                    placeholder="请输入知识点名称"
                  />
                </div>
                {courseFormError && (
                  <p className="text-sm text-red-500">{courseFormError}</p>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCourseDialogOpen(false)}>取消</Button>
                <Button
                  onClick={handleCourseSubmit}
                  className="bg-[#1e3a5f] hover:bg-[#2a5298]"
                >
                  {editingCourse ? '保存' : '新增'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* 删除确认 AlertDialog */}
          <AlertDialog open={!!deleteCourseId} onOpenChange={(open) => { if (!open) setDeleteCourseId(null); }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认删除</AlertDialogTitle>
                <AlertDialogDescription>
                  确定要删除知识点「{deleteCourseName}」吗？此操作不可撤销。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteCourse} className="bg-destructive text-white hover:bg-destructive/90">
                  删除
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* 批量导入 Dialog */}
          <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1e3a5f]/10">
                    <Upload className="size-4 text-[#1e3a5f]" />
                  </div>
                  批量导入课程信息
                </DialogTitle>
                <DialogDescription>
                  上传《课程信息.xlsx》文件，第一行为表头：章节名称、知识点名称
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="flex items-center gap-3">
                  <Input
                    id="course-import-input"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleImportFile}
                    className="flex-1"
                  />
                </div>

                {/* 预览 */}
                {importPreview.length > 0 && !importResult && (
                  <div className="rounded-xl border border-gray-100 max-h-60 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="w-[60px] text-gray-600 font-semibold">序号</TableHead>
                          <TableHead className="text-gray-600 font-semibold">章节名称</TableHead>
                          <TableHead className="text-gray-600 font-semibold">知识点名称</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importPreview.slice(0, 50).map((row, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="text-gray-400">{idx + 1}</TableCell>
                            <TableCell>{row.chapterName}</TableCell>
                            <TableCell>{row.knowledgeName}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {importPreview.length > 50 && (
                      <p className="py-2 text-center text-xs text-gray-400">
                        仅显示前 50 条，共 {importPreview.length} 条
                      </p>
                    )}
                  </div>
                )}

                {/* 导入结果 */}
                {importResult && (
                  <div className="rounded-xl bg-gray-50 p-4 space-y-2">
                    <p className="text-sm font-semibold text-gray-800">导入完成</p>
                    <div className="flex gap-4 text-sm">
                      <span className="text-gray-600">总计：{importResult.total}</span>
                      <span className="text-emerald-600">成功：{importResult.successCount}</span>
                      <span className="text-red-500">失败：{importResult.errorCount}</span>
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
                  {importResult ? '关闭' : '取消'}
                </Button>
                {!importResult && (
                  <Button
                    onClick={handleImportConfirm}
                    disabled={importing || importPreview.length === 0}
                    className="bg-[#1e3a5f] hover:bg-[#2a5298]"
                  >
                    <Upload className="mr-2 size-4" />
                    {importing ? '导入中...' : `确认导入（${importPreview.length} 条）`}
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}
