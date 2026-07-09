'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ClipboardList,
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  Loader2,
  Upload,
  X,
  ChevronDown,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Send,
  FileText,
  Users,
  Trophy,
  TrendingUp,
  BarChart3,
  BookOpen,
  Calendar,
  ListChecks,
  User,
  Sparkles,
  RefreshCw,
  QrCode,
} from 'lucide-react';
import { QRCode } from '@/components/qr-code';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CourseItem {
  id: string;
  chapter_name: string;
  knowledge_name: string;
}

interface Assignment {
  id: string;
  name: string;
  type: string;
  chapters: string[];
  knowledge_points: string[];
  xzt_cnt: number;
  pdt_cnt: number;
  ppt_file_url: string | null;
  ppt_file_id: string | null;
  deadline: string | null;
  status: string;
  publish_time: string | null;
  created_by: string;
  created_at: string;
  updated_by: string | null;
  updated_at: string | null;
  teacher_status: string;
  class_status: string;
  class_total: number;
  class_completed: number;
  personal_status: string;
  personal_total: number;
  personal_completed: number;
  completion_rate?: number;
  avg_score?: number;
  requirements?: string | null;
  class_ids?: string[] | null;
}

interface Question {
  id: string;
  assignment_id: string;
  question_id: number;
  type: number;
  title: string;
  options: { key: string; text: string }[];
  answer: string;
  analysis: string;
  sort_order: number;
  category: string;
  class_name?: string;
  student_number?: string;
  student_name?: string;
}

// QuestionGroup with extended subLabel info
interface QuestionGroup {
  type: 'teacher' | 'class' | 'personal';
  label: string;
  subLabel?: string; // 班级名或学号
  subLabelExtra?: string; // 学生姓名（仅个性化作业）
  questions: Question[];
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  generating: { label: '正在生成', color: 'bg-yellow-100 text-yellow-800', icon: Loader2 },
  completed: { label: '已生成', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  published: { label: '已发布', color: 'bg-blue-100 text-blue-800', icon: Send },
  failed: { label: '生成失败', color: 'bg-red-100 text-red-800', icon: XCircle },
};

function groupQuestionsByCategory(questions: Question[]): QuestionGroup[] {
  const groups: QuestionGroup[] = [];

  // 1. 老师下发作业 - category 为空或为 'teacher_assignment' 或包含 '下发作业'
  const teacherQuestions = questions.filter(q =>
    !q.category ||
    q.category === '' ||
    q.category === 'teacher_assignment' ||
    q.category.includes('下发作业') ||
    q.category.includes('老师下发作业')
  );
  if (teacherQuestions.length > 0) {
    groups.push({ type: 'teacher', label: '老师下发作业', questions: teacherQuestions });
  }

  // 2. 班级共性作业 - category 为 'class_assignment' 或包含 '班级共性作业'
  const classQuestions = questions.filter(q =>
    q.category && (q.category === 'class_assignment' || q.category.startsWith('class_assignment-') || q.category.includes('班级共性作业'))
  );
  const classMap = new Map<string, Question[]>();
  classQuestions.forEach(q => {
    let className = q.class_name;
    if (!className && q.category?.startsWith('class_assignment-')) {
      className = q.category.split('-')[1];
    }
    if (!className && q.category?.includes('-')) {
      className = q.category.split('-')[1];
    }
    className = className || '全部班级';
    if (!classMap.has(className)) classMap.set(className, []);
    classMap.get(className)!.push(q);
  });
  classMap.forEach((qs, className) => {
    groups.push({ type: 'class', label: '班级共性作业', subLabel: className, questions: qs });
  });

  // 3. 个性化作业 - category 为 'personal_assignment' 或包含 '个性化作业'
  const personalQuestions = questions.filter(q =>
    q.category && (q.category === 'personal_assignment' || q.category.startsWith('personal_assignment-') || q.category.includes('个性化作业'))
  );
  const personalMap = new Map<string, { name: string; questions: Question[] }>();
  personalQuestions.forEach(q => {
    let studentId = q.student_number;
    if (!studentId && q.category?.startsWith('personal_assignment-')) {
      studentId = q.category.split('-')[1];
    }
    if (!studentId && q.category?.includes('-')) {
      studentId = q.category.split('-')[1];
    }
    studentId = studentId || '';
    const studentName = q.student_name || '';
    if (!personalMap.has(studentId)) personalMap.set(studentId, { name: studentName, questions: [] });
    personalMap.get(studentId)!.questions.push(q);
    if (studentName && !personalMap.get(studentId)!.name) {
      personalMap.get(studentId)!.name = studentName;
    }
  });
  personalMap.forEach((data, studentId) => {
    groups.push({
      type: 'personal',
      label: '个性化作业',
      subLabel: studentId,
      subLabelExtra: data.name,
      questions: data.questions,
    });
  });

  // 如果没有任何分组但有问题，归入老师下发作业
  if (groups.length === 0 && questions.length > 0) {
    groups.push({ type: 'teacher', label: '老师下发作业', questions: questions });
  }

  return groups;
}

// 从 category 字符串中提取班级名或学号
function extractFromCategory(category: string | undefined, prefix: string): string | undefined {
  if (!category) return undefined;
  if (category.includes('-')) {
    return category.split('-').pop();
  }
  if (category !== prefix && category !== `${prefix}作业`) {
    return category;
  }
  return undefined;
}

function getOperatorName(): string {
  try {
    const userStr = localStorage.getItem('edu_user');
    if (userStr) {
      const user = JSON.parse(userStr);
      const name = user.name || 'system';
      return encodeURIComponent(name);
    }
  } catch {}
  return 'system';
}

export default function AssessmentsPage() {
  const router = useRouter();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('quiz');
  const [keyword, setKeyword] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // 章节和知识点筛选
  const [chapterFilter, setChapterFilter] = useState('');
  const [knowledgeFilter, setKnowledgeFilter] = useState('');

  // Create dialog
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    type: 'quiz',
    chapters: [] as string[],
    knowledge_points: [] as string[],
    xzt_cnt: 5,
    pdt_cnt: 5,
    deadline: '',
    file: null as File | null,
    requirements: '', // 作业要求
    class_ids: [] as string[], // 关联班级ID
  });
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [chapterList, setChapterList] = useState<string[]>([]);
  const [knowledgeByChapter, setKnowledgeByChapter] = useState<Record<string, string[]>>({});
  const [availableKnowledge, setAvailableKnowledge] = useState<string[]>([]);

  // 班级和学生列表（用于新增题目）
  const [classList, setClassList] = useState<Array<{ id: string; name: string }>>([]);
  const [studentList, setStudentList] = useState<Array<{ student_number: string; name: string }>>([]);

  // Edit dialog
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState<Assignment | null>(null);

  // Questions dialog
  const [showQuestions, setShowQuestions] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [showQuestionEdit, setShowQuestionEdit] = useState(false);
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [currentAssignment, setCurrentAssignment] = useState<Assignment | null>(null);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<Assignment | null>(null);

  // Publish dialog
  const [publishTarget, setPublishTarget] = useState<Assignment | null>(null);

  // Detail dialog
  const [showDetail, setShowDetail] = useState(false);
  const [detailAssignment, setDetailAssignment] = useState<Assignment | null>(null);
  const [detailQuestions, setDetailQuestions] = useState<Question[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<'info' | 'questions' | 'wrong'>('info');

  // QR Code dialog
  const [showQRCode, setShowQRCode] = useState(false);
  const [qrAssignment, setQrAssignment] = useState<Assignment | null>(null);

  // 多级折叠状态
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set()); // 展开的作业类型
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set()); // 展开的班级/学生组

  // 切换作业类型折叠
  const toggleTypeExpand = (type: string) => {
    const newSet = new Set(expandedTypes);
    if (newSet.has(type)) {
      newSet.delete(type);
    } else {
      newSet.add(type);
    }
    setExpandedTypes(newSet);
  };

  // 切换班级/学生组折叠
  const toggleGroupExpand = (groupKey: string) => {
    const newSet = new Set(expandedGroups);
    if (newSet.has(groupKey)) {
      newSet.delete(groupKey);
    } else {
      newSet.add(groupKey);
    }
    setExpandedGroups(newSet);
  };
  const [detailStats, setDetailStats] = useState<{
    class_stats: Array<{
      class_name: string;
      total_students: number;
      submitted_count: number;
      completion_rate: number;
      avg_score: number;
      max_score: number;
      pass_rate: number;
      score_distribution: number[];
    }>;
    wrong_ranking: Array<{
      question_id: string;
      question_number: number;
      type: number;
      title: string;
      answer: string;
      error_count: number;
      total_count: number;
      error_rate: number;
    }>;
  } | null>(null);
  const [detailStatsLoading, setDetailStatsLoading] = useState(false);
  const [assignmentAiSuggestion, setAssignmentAiSuggestion] = useState<{ content: string; created_at: string } | null>(null);
  const [assignmentAiLoading, setAssignmentAiLoading] = useState(false);
  const [aiSuggestionLoading, setAiSuggestionLoading] = useState(false);

  const fetchAssignments = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const params = new URLSearchParams({ type: activeTab });
      if (keyword) params.set('keyword', keyword);
      const res = await fetch(`/api/assignments?${params}`);
      const data = await res.json();
      setAssignments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('获取作业列表失败:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [activeTab, keyword]);

  const fetchCourses = useCallback(async () => {
    try {
      const res = await fetch('/api/courses');
      const data = await res.json();
      const courseList = Array.isArray(data) ? data : [];
      setCourses(courseList);

      // Build chapter list and knowledge map
      const chapterSet = new Set<string>();
      const kMap: Record<string, Set<string>> = {};
      courseList.forEach((c: CourseItem) => {
        chapterSet.add(c.chapter_name);
        if (!kMap[c.chapter_name]) kMap[c.chapter_name] = new Set();
        kMap[c.chapter_name].add(c.knowledge_name);
      });
      setChapterList(Array.from(chapterSet));
      setKnowledgeByChapter(
        Object.fromEntries(Object.entries(kMap).map(([k, v]) => [k, Array.from(v)]))
      );
    } catch (err) {
      console.error('获取课程列表失败:', err);
    }
  }, []);

  const fetchClasses = useCallback(async () => {
    try {
      const res = await fetch('/api/classes');
      const data = await res.json();
      const classes = Array.isArray(data) ? data.map((c: any) => ({ id: c.id, name: c.name })) : [];
      setClassList(classes);
    } catch (err) {
      console.error('获取班级列表失败:', err);
    }
  }, []);

  const fetchStudents = useCallback(async () => {
    try {
      const res = await fetch('/api/students');
      const data = await res.json();
      const students = Array.isArray(data) ? data.map((s: any) => ({ student_number: s.student_number, name: s.name })) : [];
      setStudentList(students);
    } catch (err) {
      console.error('获取学生列表失败:', err);
    }
  }, []);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  // Auto-refresh when there are generating assignments
  useEffect(() => {
    const hasGenerating = assignments.some((a) =>
      a.status === 'generating' ||
      a.teacher_status === 'generating' ||
      a.class_status === 'generating' ||
      a.personal_status === 'generating' ||
      a.teacher_status === 'pending' ||
      a.class_status === 'pending' ||
      a.personal_status === 'pending'
    );
    if (!hasGenerating) return;
    const timer = setInterval(() => { fetchAssignments(false); }, 3000);
    return () => clearInterval(timer);
  }, [assignments, fetchAssignments]);

  // Keep polling for generating assignments after creation
  useEffect(() => {
    if (showCreate || creating) return;
    const hasGenerating = assignments.some((a) =>
      a.status === 'generating' ||
      a.teacher_status === 'generating' ||
      a.class_status === 'generating' ||
      a.personal_status === 'generating' ||
      a.teacher_status === 'pending' ||
      a.class_status === 'pending' ||
      a.personal_status === 'pending'
    );
    if (!hasGenerating) return;
    const timer = setInterval(() => { fetchAssignments(false); }, 3000);
    return () => clearInterval(timer);
  }, [showCreate, creating, assignments, fetchAssignments]);

  useEffect(() => {
    fetchCourses();
    fetchClasses();
    fetchStudents();
  }, [fetchCourses, fetchClasses, fetchStudents]);

  // Update available knowledge points when chapters change
  useEffect(() => {
    const kps = new Set<string>();
    createForm.chapters.forEach((ch) => {
      (knowledgeByChapter[ch] || []).forEach((kp) => kps.add(kp));
    });
    setAvailableKnowledge(Array.from(kps));
    // Remove knowledge points that are no longer valid
    setCreateForm((prev) => ({
      ...prev,
      knowledge_points: prev.knowledge_points.filter((kp) => kps.has(kp)),
    }));
  }, [createForm.chapters, knowledgeByChapter]);

  const handleCreate = async () => {
    if (!createForm.name) return alert('请填写作业名称');
    if (!createForm.file) return alert('请上传课程资料');
    if (createForm.xzt_cnt <= 0 && createForm.pdt_cnt <= 0) return alert('选择题或判断题至少一种要有题目');
    if (createForm.class_ids.length === 0) return alert('请勾选关联班级');

    setCreating(true);
    try {
      // Step 1: Upload file to Coze
      const formData = new FormData();
      formData.append('file', createForm.file);
      const uploadRes = await fetch('/api/coze/upload', { method: 'POST', body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok || !uploadData.file_id) {
        throw new Error(uploadData.error || '文件上传失败');
      }
      const file_id = uploadData.file_id;

      // Step 2: Create assignment
      const operator = getOperatorName();
      const assignRes = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-operator': operator },
        body: JSON.stringify({
          name: createForm.name,
          type: createForm.type,
          chapters: createForm.chapters,
          knowledge_points: createForm.knowledge_points,
          xzt_cnt: createForm.xzt_cnt,
          pdt_cnt: createForm.pdt_cnt,
          ppt_file_url: createForm.file?.name || '',
          ppt_file_id: file_id,
          deadline: createForm.deadline || null,
          requirements: createForm.requirements || null, // 作业要求
          class_ids: createForm.class_ids.length > 0 ? createForm.class_ids : null, // 关联班级
        }),
      });
      const assignData = await assignRes.json();
      if (!assignRes.ok) {
        throw new Error(assignData.error || '创建作业失败');
      }

      // Step 3: Run workflows - three separate async calls
      const workflowBase = {
        assignment_id: assignData.id,
        file_id,
        xzt_cnt: createForm.xzt_cnt,
        pdt_cnt: createForm.pdt_cnt,
        knowledge_points: createForm.knowledge_points,
        class_ids: createForm.class_ids.length > 0 ? createForm.class_ids : null, // 传递勾选的班级ID
      };

      // Fire all three workflow calls in parallel
      ['teacher', 'class', 'personal'].forEach((wfType) => {
        fetch('/api/coze/workflow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...workflowBase, type: wfType }),
        }).then(async (res) => {
          const result = await res.json();
          if (res.ok) {
            console.log(`${wfType} workflow completed:`, result);
          } else {
            console.error(`${wfType} workflow failed:`, result);
          }
          fetchAssignments();
        }).catch((err) => {
          console.error(`${wfType} workflow error:`, err);
          fetchAssignments();
        });
      });

      setShowCreate(false);
      setCreateForm({
        name: '',
        type: 'quiz',
        chapters: [],
        knowledge_points: [],
        xzt_cnt: 5,
        pdt_cnt: 5,
        deadline: '',
        file: null,
        requirements: '',
        class_ids: [],
      });
      fetchAssignments();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '创建失败');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (assignment: Assignment) => {
    try {
      const res = await fetch(`/api/assignments?id=${assignment.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || '删除失败');
        return;
      }
      setDeleteTarget(null);
      fetchAssignments();
    } catch {
      alert('删除失败');
    }
  };

  const handleEdit = async () => {
    if (!editForm) return;
    try {
      const operator = getOperatorName();
      const res = await fetch('/api/assignments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-operator': operator },
        body: JSON.stringify({
          id: editForm.id,
          name: editForm.name,
          type: editForm.type,
          chapters: editForm.chapters,
          knowledge_points: editForm.knowledge_points,
          xzt_cnt: editForm.xzt_cnt,
          pdt_cnt: editForm.pdt_cnt,
          deadline: editForm.deadline,
          requirements: editForm.requirements || null,
          class_ids: (editForm.class_ids && editForm.class_ids.length > 0) ? editForm.class_ids : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || '修改失败');
        return;
      }
      setShowEdit(false);
      setEditForm(null);
      fetchAssignments();
    } catch {
      alert('修改失败');
    }
  };

  const handleViewDetail = async (assignment: Assignment) => {
    setDetailAssignment(assignment);
    setShowDetail(true);
    setDetailTab('info');
    setDetailLoading(true);
    setDetailStatsLoading(true);
    setDetailStats(null);
    try {
      const res = await fetch(`/api/questions?assignment_id=${assignment.id}`);
      const data = await res.json();
      setDetailQuestions(Array.isArray(data) ? data : []);
    } catch {
      setDetailQuestions([]);
    } finally {
      setDetailLoading(false);
    }
    // Fetch stats (only for published assignments)
    if (assignment.status === 'published') {
      try {
        const res = await fetch(`/api/assignments/stats?assignment_id=${assignment.id}`);
        if (res.ok) {
          const data = await res.json();
          setDetailStats(data);
        }
      } catch {
        // ignore stats error
      } finally {
        setDetailStatsLoading(false);
      }
    } else {
      setDetailStatsLoading(false);
    }
    // Fetch AI suggestion
    try {
      const res = await fetch(`/api/assignments/ai-suggestion?assignment_id=${assignment.id}`);
      if (res.ok) {
        const data = await res.json();
        setAssignmentAiSuggestion(data.suggestion || null);
      }
    } catch {
      // ignore
    }
  };

  const handlePublish = async (assignment: Assignment, unpublish = false) => {
    try {
      const operator = getOperatorName();
      const res = await fetch('/api/assignments/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-operator': operator },
        body: JSON.stringify({ id: assignment.id, unpublish }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || (unpublish ? '取消发布失败' : '发布失败'));
        return;
      }
      setPublishTarget(null);
      fetchAssignments();
    } catch {
      alert(unpublish ? '取消发布失败' : '发布失败');
    }
  };

  const fetchQuestions = async (assignmentId: string) => {
    setQuestionsLoading(true);
    try {
      const res = await fetch(`/api/questions?assignment_id=${assignmentId}`);
      const data = await res.json();
      setQuestions(Array.isArray(data) ? data : []);
    } catch {
      setQuestions([]);
    } finally {
      setQuestionsLoading(false);
    }
  };

  const handleViewQuestions = (assignment: Assignment) => {
    setSelectedIds(new Set([assignment.id]));
    setCurrentAssignment(assignment);
    fetchQuestions(assignment.id);
    setShowQuestions(true);
  };

  const handleSaveQuestion = async (question: Partial<Question>, isNew: boolean) => {
    try {
      const url = isNew ? '/api/questions' : '/api/questions';
      const method = isNew ? 'POST' : 'PUT';
      const body = isNew
        ? {
            assignment_id: selectedIds.values().next().value,
            question_id: question.question_id || 0,
            type: question.type || 1,
            title: question.title,
            options: question.options || [],
            answer: question.answer,
            analysis: question.analysis || '',
            sort_order: question.sort_order || 0,
            category: question.category || '',
            class_name: question.class_name || '',
            student_number: question.student_number || '',
            student_name: question.student_name || '',
          }
        : {
            id: question.id,
            question_id: question.question_id,
            type: question.type,
            title: question.title,
            options: question.options,
            answer: question.answer,
            analysis: question.analysis,
            sort_order: question.sort_order,
            category: question.category,
            class_name: question.class_name,
            student_number: question.student_number,
            student_name: question.student_name,
          };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || '保存失败');
        return;
      }
      setShowQuestionEdit(false);
      setShowAddQuestion(false);
      setEditingQuestion(null);
      fetchQuestions(selectedIds.values().next().value as string);
    } catch {
      alert('保存失败');
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    try {
      const res = await fetch(`/api/questions?id=${questionId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || '删除失败');
        return;
      }
      fetchQuestions(selectedIds.values().next().value as string);
    } catch {
      alert('删除失败');
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const canEdit = (a: Assignment) => a.status !== 'published';
  const canDelete = (a: Assignment) => a.status !== 'published';
  const canViewQuestions = (a: Assignment) => a.status === 'completed' || a.status === 'published';

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1e3a5f]/10">
              <ClipboardList className="size-5 text-[#1e3a5f]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">测评作业</h1>
              <p className="text-sm text-gray-500 mt-0.5">课堂测验与课后作业管理</p>
            </div>
          </div>
          <Button onClick={() => setShowCreate(true)} className="gap-2 bg-[#1e3a5f] text-white hover:bg-[#1e3a5f]/90">
            <Plus className="size-4" />
            新建
          </Button>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="flex items-center justify-between bg-white px-6 py-3 border-b border-gray-100">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-[#F5F7FA]">
            <TabsTrigger value="quiz">课堂测验</TabsTrigger>
            <TabsTrigger value="homework">课后作业</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          {/* 章节筛选 */}
          <Select value={chapterFilter} onValueChange={(value) => {
            setChapterFilter(value === 'all' ? '' : value);
            setKnowledgeFilter(''); // 切换章节时清空知识点筛选
          }}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="全部章节" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部章节</SelectItem>
              {chapterList.map((chapter) => (
                <SelectItem key={chapter} value={chapter}>{chapter}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* 知识点筛选 */}
          <Select value={knowledgeFilter} onValueChange={(value) => setKnowledgeFilter(value === 'all' ? '' : value)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="全部知识点" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部知识点</SelectItem>
              {(chapterFilter ? knowledgeByChapter[chapterFilter] || [] : chapterList.flatMap(ch => knowledgeByChapter[ch] || [])).map((kp) => (
                <SelectItem key={kp} value={kp}>{kp}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* 搜索框 */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-4 text-gray-400" />
            <Input
              placeholder="搜索作业名称..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-64 pl-8 bg-[#F5F7FA] border-gray-200"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-6">
        <Card className="rounded-2xl border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-[#F5F7FA]">
                <th className="px-4 py-3 text-left font-semibold text-gray-600">
                <Checkbox
                  checked={assignments.length > 0 && selectedIds.size === assignments.length}
                  onCheckedChange={(checked) => {
                    if (checked) setSelectedIds(new Set(assignments.map((a) => a.id)));
                    else setSelectedIds(new Set());
                  }}
                />
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">作业名称</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">关联班级</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">所属章节</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">所属知识点</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">生成状态</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">完成率</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">平均分</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">发布状态</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">创建时间</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">创建人</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">发布时间</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody>
            {/* 筛选逻辑 */}
            {(() => {
              const filteredAssignments = assignments.filter(a => {
                if (chapterFilter && !a.chapters.includes(chapterFilter)) return false;
                if (knowledgeFilter && !a.knowledge_points.includes(knowledgeFilter)) return false;
                return true;
              });

              return loading ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-[var(--muted-foreground)]">
                    <Loader2 className="mx-auto mb-2 size-6 animate-spin" />
                    加载中...
                  </td>
                </tr>
              ) : filteredAssignments.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-[var(--muted-foreground)]">
                    {chapterFilter || knowledgeFilter ? '暂无符合筛选条件的作业' : '暂无作业数据'}
                  </td>
                </tr>
              ) : (
                filteredAssignments.map((a) => {
                  const statusInfo = STATUS_MAP[a.status] || STATUS_MAP.generating;
                  const StatusIcon = statusInfo.icon;
                  return (
                    <tr key={a.id} className="border-b border-gray-50 hover:bg-[#F5F7FA]/60">
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={selectedIds.has(a.id)}
                          onCheckedChange={() => toggleSelect(a.id)}
                        />
                    </td>
                    <td className="px-4 py-3 font-medium">{a.name}</td>
                    <td className="px-4 py-3">
                      <div className="flex max-w-[120px] flex-wrap gap-1">
                        {(!a.class_ids || a.class_ids.length === 0) ? (
                          <Badge variant="outline" className="text-xs bg-gray-50">
                            无关联班级
                          </Badge>
                        ) : (
                          <>
                            {a.class_ids.slice(0, 2).map((classId) => {
                              const classInfo = classList.find(c => c.id === classId);
                              return (
                                <Badge key={classId} variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                  {classInfo?.name || classId}
                                </Badge>
                              );
                            })}
                            {a.class_ids.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{a.class_ids.length - 2}
                              </Badge>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex max-w-[120px] flex-wrap gap-1">
                        {(a.chapters || []).slice(0, 2).map((ch) => (
                          <Badge key={ch} variant="outline" className="text-xs">
                            {ch}
                          </Badge>
                        ))}
                        {(a.chapters || []).length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{a.chapters.length - 2}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex max-w-[120px] flex-wrap gap-1">
                        {(a.knowledge_points || []).slice(0, 2).map((kp) => (
                          <Badge key={kp} variant="secondary" className="text-xs">
                            {kp}
                          </Badge>
                        ))}
                        {(a.knowledge_points || []).length > 2 && (
                          <Badge variant="secondary" className="text-xs">
                            +{a.knowledge_points.length - 2}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`${STATUS_MAP[a.status === 'published' ? 'completed' : a.status]?.color || STATUS_MAP.generating.color} gap-1`}>
                        {(() => {
                          const s = a.status === 'published' ? 'completed' : a.status;
                          const info = STATUS_MAP[s] || STATUS_MAP.generating;
                          const Icon = info.icon;
                          return <>
                            <Icon className={`size-3 ${s === 'generating' ? 'animate-spin' : ''}`} />
                            {info.label}
                          </>;
                        })()}
                      </Badge>
                      {a.status !== 'published' && (a.teacher_status || a.class_status || a.personal_status) && (
                        <div className="mt-1 space-y-0.5">
                          <div className="flex items-center gap-1 text-[10px]">
                            {a.teacher_status === 'completed' ? (
                              <CheckCircle2 className="size-3 text-green-500" />
                            ) : a.teacher_status === 'failed' ? (
                              <XCircle className="size-3 text-red-500" />
                            ) : a.teacher_status === 'generating' ? (
                              <Loader2 className="size-3 animate-spin text-yellow-500" />
                            ) : null}
                            <span className={a.teacher_status === 'completed' ? 'text-green-600' : a.teacher_status === 'failed' ? 'text-red-500' : 'text-yellow-600'}>
                              下发作业{a.teacher_status === 'completed' ? '完成' : a.teacher_status === 'failed' ? '失败' : '生成中'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px]">
                            {a.class_status === 'completed' ? (
                              <CheckCircle2 className="size-3 text-green-500" />
                            ) : a.class_status === 'failed' ? (
                              <XCircle className="size-3 text-red-500" />
                            ) : a.class_status === 'generating' ? (
                              <Loader2 className="size-3 animate-spin text-yellow-500" />
                            ) : null}
                            <span className={a.class_status === 'completed' ? 'text-green-600' : a.class_status === 'failed' ? 'text-red-500' : 'text-yellow-600'}>
                              班级作业{a.class_status === 'completed' ? '完成' : a.class_status === 'failed' ? '失败' : `${a.class_completed || 0}/${a.class_total || 0}`}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px]">
                            {a.personal_status === 'completed' ? (
                              <CheckCircle2 className="size-3 text-green-500" />
                            ) : a.personal_status === 'failed' ? (
                              <XCircle className="size-3 text-red-500" />
                            ) : a.personal_status === 'generating' ? (
                              <Loader2 className="size-3 animate-spin text-yellow-500" />
                            ) : null}
                            <span className={a.personal_status === 'completed' ? 'text-green-600' : a.personal_status === 'failed' ? 'text-red-500' : 'text-yellow-600'}>
                              个性化作业{a.personal_status === 'completed' ? '完成' : a.personal_status === 'failed' ? '失败' : `${a.personal_completed || 0}/${a.personal_total || 0}`}
                            </span>
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {a.status === 'published' && a.completion_rate !== undefined ? (
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100">
                            <div
                              className="h-full rounded-full bg-[#1e3a5f]"
                              style={{ width: `${a.completion_rate}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-700">{a.completion_rate}%</span>
                        </div>
                      ) : (
                        <span className="text-[var(--muted-foreground)]">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {a.status === 'published' && a.avg_score !== undefined ? (
                        <span className="text-sm font-medium text-gray-700">{a.avg_score}</span>
                      ) : (
                        <span className="text-[var(--muted-foreground)]">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {a.status === 'published' ? (
                        <Badge className="bg-blue-100 text-blue-800">已发布</Badge>
                      ) : (
                        <Badge variant="outline">未发布</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--muted-foreground)]">
                      {formatDate(a.created_at)}
                    </td>
                    <td className="px-4 py-3">{a.created_by}</td>
                    <td className="px-4 py-3 text-[var(--muted-foreground)]">
                      {formatDate(a.publish_time)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetail(a)}
                          title="查看详情"
                          className="text-gray-400 hover:text-[#1e3a5f] hover:bg-[#1e3a5f]/5"
                        >
                          <FileText className="size-4" />
                        </Button>
                        {canViewQuestions(a) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewQuestions(a)}
                            title="查看题目"
                            className="text-gray-400 hover:text-[#1e3a5f] hover:bg-[#1e3a5f]/5"
                          >
                            <Eye className="size-4" />
                          </Button>
                        )}
                        {a.status === 'published' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setQrAssignment(a);
                              setShowQRCode(true);
                            }}
                            title="作业二维码"
                            className="text-gray-400 hover:text-[#1e3a5f] hover:bg-[#1e3a5f]/5"
                          >
                            <QrCode className="size-4" />
                          </Button>
                        )}
                        {canEdit(a) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditForm(a);
                              setShowEdit(true);
                            }}
                            title="编辑"
                            className="text-gray-400 hover:text-[#1e3a5f] hover:bg-[#1e3a5f]/5"
                          >
                            <Edit className="size-4" />
                          </Button>
                        )}
                        {canDelete(a) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget(a)}
                            title="删除"
                            className="text-gray-400 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            );
          })()}
          </tbody>
        </table>
      </Card>
      </div>

      {/* View Questions Button (for selected completed assignments) */}
      {selectedIds.size > 0 &&
        assignments
          .filter((a) => selectedIds.has(a.id))
          .every((a) => a.status === 'completed' || a.status === 'published') && (
          <div className="flex items-center gap-2 px-6 pb-4">
            <Button
              variant="outline"
              onClick={() => {
                const firstId = selectedIds.values().next().value;
                const firstAssignment = assignments.find(a => a.id === firstId);
                if (firstAssignment) setCurrentAssignment(firstAssignment);
                fetchQuestions(firstId as string);
                setShowQuestions(true);
              }}
              className="border-[#1e3a5f] text-[#1e3a5f] hover:bg-[#1e3a5f]/5"
            >
              <Eye className="mr-1 size-4" />
              查看题目 ({selectedIds.size})
            </Button>
            {assignments
              .filter((a) => selectedIds.has(a.id))
              .some((a) => a.status === 'completed') && (
              <Button
                onClick={() => {
                  const toPublish = assignments.find(
                    (a) => selectedIds.has(a.id) && a.status === 'completed'
                  );
                  if (toPublish) setPublishTarget(toPublish);
                }}
              >
                <Send className="mr-1 size-4" />
                发布
              </Button>
            )}
            {assignments
              .filter((a) => selectedIds.has(a.id))
              .some((a) => a.status === 'published') && (
              <Button
                variant="outline"
                onClick={() => {
                  const toUnpublish = assignments.find(
                    (a) => selectedIds.has(a.id) && a.status === 'published'
                  );
                  if (toUnpublish) handlePublish(toUnpublish, true);
                }}
              >
                <XCircle className="mr-1 size-4" />
                取消发布
              </Button>
            )}
          </div>
        )}

      {/* ========= Create Assignment Dialog ========= */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>新建</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* 第一行：作业类型 */}
            <div className="space-y-2.5">
              <Label>作业类型</Label>
              <Select
                value={createForm.type}
                onValueChange={(v) => setCreateForm((p) => ({ ...p, type: v }))}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="quiz">课堂测验</SelectItem>
                  <SelectItem value="homework">课后作业</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 第二行：作业名称 */}
            <div className="space-y-2.5">
              <Label>作业名称</Label>
              <Input
                value={createForm.name}
                onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="请输入作业名称"
                className="h-10"
              />
            </div>

            {/* 第三行：关联班级 */}
            <div className="space-y-2.5">
              <Label>关联班级</Label>
              <div className="max-h-28 overflow-y-auto rounded-md border p-2.5">
                {classList.length === 0 ? (
                  <p className="text-sm text-[var(--muted-foreground)]">暂无班级数据</p>
                ) : (
                  classList.map((c) => (
                    <label key={c.id} className="flex items-center gap-2.5 py-1.5">
                      <Checkbox
                        className="scale-105"
                        checked={createForm.class_ids.includes(c.id)}
                        onCheckedChange={(checked) => {
                          setCreateForm((p) => ({
                            ...p,
                            class_ids: checked
                              ? [...p.class_ids, c.id]
                              : p.class_ids.filter((id) => id !== c.id),
                          }));
                        }}
                      />
                      <span className="text-sm">{c.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            {/* 第四行：上传课程资料 + 截止时间 */}
            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-2.5">
                <Label>上传课程资料</Label>
                <Input
                  type="file"
                  accept=".ppt,.pptx,.pdf,.doc,.docx"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setCreateForm((p) => ({ ...p, file }));
                  }}
                  className="h-10"
                />
              </div>
              <div className="space-y-2.5">
                <Label>截止时间</Label>
                <Input
                  type="datetime-local"
                  value={createForm.deadline}
                  onChange={(e) => setCreateForm((p) => ({ ...p, deadline: e.target.value }))}
                  className="h-10"
                />
              </div>
            </div>

            {/* 第五行：所属章节 + 所属知识点 */}
            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-2.5">
                <Label>所属章节（可多选）</Label>
                <div className="max-h-28 overflow-y-auto rounded-md border p-2.5">
                  {chapterList.length === 0 ? (
                    <p className="text-sm text-[var(--muted-foreground)]">请先在设置中添加课程知识点</p>
                  ) : (
                    chapterList.map((ch) => (
                      <label key={ch} className="flex items-center gap-2.5 py-1.5">
                        <Checkbox
                          className="scale-105"
                          checked={createForm.chapters.includes(ch)}
                          onCheckedChange={(checked) => {
                            setCreateForm((p) => ({
                              ...p,
                              chapters: checked
                                ? [...p.chapters, ch]
                                : p.chapters.filter((c) => c !== ch),
                            }));
                          }}
                        />
                        <span className="text-sm">{ch}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
              <div className="space-y-2.5">
                <Label>所属知识点（可多选）</Label>
                <div className="max-h-28 overflow-y-auto rounded-md border p-2.5">
                  {availableKnowledge.length === 0 ? (
                    <p className="text-sm text-[var(--muted-foreground)]">请先选择章节</p>
                  ) : (
                    availableKnowledge.map((kp) => (
                      <label key={kp} className="flex items-center gap-2.5 py-1.5">
                        <Checkbox
                          className="scale-105"
                          checked={createForm.knowledge_points.includes(kp)}
                          onCheckedChange={(checked) => {
                            setCreateForm((p) => ({
                              ...p,
                              knowledge_points: checked
                                ? [...p.knowledge_points, kp]
                                : p.knowledge_points.filter((k) => k !== kp),
                            }));
                          }}
                        />
                        <span className="text-sm">{kp}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* 第六行：选择题题数 + 判断题题数 */}
            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-2.5">
                <Label>选择题题数</Label>
                <Input
                  type="number"
                  min={0}
                  value={createForm.xzt_cnt}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, xzt_cnt: parseInt(e.target.value) || 0 }))
                  }
                  className="h-10"
                />
              </div>
              <div className="space-y-2.5">
                <Label>判断题题数</Label>
                <Input
                  type="number"
                  min={0}
                  value={createForm.pdt_cnt}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, pdt_cnt: parseInt(e.target.value) || 0 }))
                  }
                  className="h-10"
                />
              </div>
            </div>

            {/* 第七行：作业要求 */}
            <div className="space-y-2.5">
              <Label>作业要求</Label>
              <Textarea
                value={createForm.requirements}
                onChange={(e) => setCreateForm((p) => ({ ...p, requirements: e.target.value }))}
                placeholder="例如：基础题目占60%，应用题目占40%"
                rows={2.5}
                className="min-h-[60px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              取消
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 className="mr-1 size-4 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========= Edit Assignment Dialog ========= */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>修改作业</DialogTitle>
          </DialogHeader>
          {editForm && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>作业名称</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>选择题题数</Label>
                  <Input
                    type="number"
                    min={0}
                    value={editForm.xzt_cnt}
                    onChange={(e) =>
                      setEditForm({ ...editForm, xzt_cnt: parseInt(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>判断题题数</Label>
                  <Input
                    type="number"
                    min={0}
                    value={editForm.pdt_cnt}
                    onChange={(e) =>
                      setEditForm({ ...editForm, pdt_cnt: parseInt(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>截止时间</Label>
                <Input
                  type="datetime-local"
                  value={editForm.deadline ? editForm.deadline.substring(0, 16) : ''}
                  onChange={(e) => setEditForm({ ...editForm, deadline: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>作业要求</Label>
                <Textarea
                  value={editForm.requirements || ''}
                  onChange={(e) => setEditForm({ ...editForm, requirements: e.target.value })}
                  placeholder="例如：基础题目占60%，应用题目占40%"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>关联班级</Label>
                <div className="max-h-32 overflow-y-auto rounded-md border p-2">
                  {classList.length === 0 ? (
                    <p className="text-sm text-[var(--muted-foreground)]">暂无班级数据</p>
                  ) : (
                    classList.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 py-1">
                        <Checkbox
                          checked={(editForm.class_ids || []).includes(c.id)}
                          onCheckedChange={(checked) => {
                            const currentClassIds = editForm.class_ids || [];
                            setEditForm({
                              ...editForm,
                              class_ids: checked
                                ? [...currentClassIds, c.id]
                                : currentClassIds.filter((id) => id !== c.id),
                            });
                          }}
                        />
                        <span className="text-sm">{c.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>
              取消
            </Button>
            <Button onClick={handleEdit}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========= Delete Confirmation ========= */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除作业「{deleteTarget?.name}」吗？此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && handleDelete(deleteTarget)}>
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ========= Publish Confirmation ========= */}
      <AlertDialog open={!!publishTarget} onOpenChange={() => setPublishTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认发布</AlertDialogTitle>
            <AlertDialogDescription>
              确定要发布作业「{publishTarget?.name}」吗？发布后作业将不可修改和删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => publishTarget && handlePublish(publishTarget)}>
              发布
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ========= Detail Dialog ========= */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="sm:max-w-[75vw] max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
          {/* ====== 顶部标题区 — 深蓝渐变 ====== */}
          <div className="shrink-0 bg-gradient-to-r from-[#1e3a5f] to-[#2a5298] px-8 py-5">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-2xl font-bold text-white tracking-tight">{detailAssignment?.name}</DialogTitle>
                {detailAssignment && (
                  <p className="mt-1.5 text-sm text-blue-200 truncate">
                    {(detailAssignment.chapters || []).join('、') || '未设置章节'}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 ml-4 shrink-0">
                {detailAssignment && (
                  <>
                    <Badge className={detailAssignment.type === 'quiz' ? 'bg-white/20 text-white border-0 text-xs backdrop-blur' : 'bg-white/20 text-white border-0 text-xs backdrop-blur'}>
                      {detailAssignment.type === 'quiz' ? '课堂测验' : '课后作业'}
                    </Badge>
                    {(() => {
                      const s = STATUS_MAP[detailAssignment.status] || STATUS_MAP.generating;
                      return (
                        <Badge className={`${detailAssignment.status === 'published' ? 'bg-emerald-400/20 text-emerald-200 border-0 text-xs' : 'bg-white/20 text-white border-0 text-xs'}`}>
                          {detailAssignment.status === 'published' ? '已发布' : s.label}
                        </Badge>
                      );
                    })()}
                  </>
                )}
              </div>
            </div>

            {/* 元信息条 */}
            {detailAssignment && (
              <div className="mt-3 flex items-center gap-5 text-xs text-blue-200/80">
                <span className="flex items-center gap-1"><User className="size-3" />{detailAssignment.created_by}</span>
                <span className="flex items-center gap-1"><Calendar className="size-3" />{formatDate(detailAssignment.created_at)}</span>
                {detailAssignment.deadline && (
                  <span className="flex items-center gap-1"><Clock className="size-3" />截止 {formatDate(detailAssignment.deadline)}</span>
                )}
                <span className="flex items-center gap-1"><ListChecks className="size-3" />{detailAssignment.xzt_cnt}选择 / {detailAssignment.pdt_cnt}判断</span>
              </div>
            )}

            {/* 关联班级和作业要求 */}
            {detailAssignment && (detailAssignment.class_ids || detailAssignment.requirements) && (
              <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-blue-200/80">
                {detailAssignment.class_ids && detailAssignment.class_ids.length > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Users className="size-3" />
                    <span className="text-blue-300">关联班级：</span>
                    <span className="text-white font-medium">
                      {detailAssignment.class_ids.map(classId => {
                        const classInfo = classList.find(c => c.id === classId);
                        return classInfo?.name || classId;
                      }).join('、')}
                    </span>
                  </span>
                )}
                {!detailAssignment.class_ids || detailAssignment.class_ids.length === 0 && (
                  <span className="flex items-center gap-1.5">
                    <Users className="size-3" />
                    <span className="text-blue-300">关联班级：</span>
                    <span className="text-white font-medium"></span>
                  </span>
                )}
                {detailAssignment.requirements && (
                  <span className="flex items-center gap-1.5 max-w-[400px]">
                    <FileText className="size-3" />
                    <span className="text-blue-300">作业要求：</span>
                    <span className="text-white font-medium truncate">{detailAssignment.requirements}</span>
                  </span>
                )}
              </div>
            )}

            {/* 页签 — 胶囊式 */}
            <div className="mt-4 flex gap-1.5">
              {[
                { key: 'info', label: '基本详情', icon: FileText },
                { key: 'questions', label: '作业题目', icon: BookOpen, count: detailQuestions.length },
                ...(detailAssignment?.status === 'published' ? [{ key: 'wrong', label: '错题排行', icon: XCircle, count: detailStats?.wrong_ranking?.length || 0 }] : []),
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setDetailTab(tab.key as 'info' | 'questions' | 'wrong')}
                  className={`flex items-center gap-1.5 rounded-full px-5 py-1.5 text-sm font-medium transition-all ${
                    detailTab === tab.key
                      ? 'bg-white text-[#1e3a5f] shadow-lg shadow-black/10'
                      : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                  }`}
                >
                  <tab.icon className="size-3.5" />
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className={`ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                      detailTab === tab.key ? 'bg-[#1e3a5f]/10 text-[#1e3a5f]' : 'bg-white/20 text-white'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* ====== 内容区 — 浅灰底 ====== */}
          <div className="flex-1 overflow-y-auto bg-[#F5F7FA] p-6">
            {/* ---- 基本详情 Tab ---- */}
            {detailAssignment && detailTab === 'info' && (
              <>
              <div className="space-y-6">
                {/* 已发布 — Dashboard 布局 */}
                {detailAssignment.status === 'published' ? (
                  detailStatsLoading ? (
                    <div className="flex items-center justify-center py-20">
                      <Loader2 className="size-6 animate-spin text-gray-400" />
                    </div>
                  ) : !detailStats || detailStats.class_stats.length === 0 ? (
                    <div className="rounded-2xl bg-white shadow-[0_4px_12px_rgba(0,0,0,0.05)] py-20 text-center">
                      <Users className="mx-auto mb-4 size-14 text-gray-200" />
                      <p className="text-sm text-gray-400">暂无学生提交记录</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {detailStats.class_stats.map((cls) => {
                        const totalStudents = cls.total_students;
                        const submitted = cls.submitted_count;
                        const completionPct = cls.completion_rate;
                        // SVG 圆环进度条参数
                        const radius = 52;
                        const stroke = 8;
                        const circumference = 2 * Math.PI * radius;
                        const offset = circumference - (completionPct / 100) * circumference;

                        return (
                          <div key={cls.class_name} className="rounded-2xl bg-white shadow-[0_4px_12px_rgba(0,0,0,0.05)] overflow-hidden">
                            {/* 班级标题栏 */}
                            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                              <div className="flex items-center gap-2.5">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1e3a5f]/10">
                                  <Users className="size-4 text-[#1e3a5f]" />
                                </div>
                                <h4 className="text-base font-bold text-[#1a1a2e]">{cls.class_name}</h4>
                                <span className="text-xs text-gray-400">|</span>
                                <span className="text-sm text-gray-500">{submitted} / {totalStudents} 人已提交</span>
                              </div>
                            </div>

                            <div className="p-6">
                              <div className="flex gap-6">
                                {/* 左侧 — 圆环进度 + 截止时间 */}
                                <div className="flex flex-col items-center justify-center w-[180px] shrink-0">
                                  <div className="relative">
                                    <svg width="140" height="140" className="-rotate-90">
                                      <circle cx="70" cy="70" r={radius} fill="none" stroke="#F0F0F0" strokeWidth={stroke} />
                                      <circle
                                        cx="70" cy="70" r={radius} fill="none"
                                        stroke={completionPct >= 80 ? '#10b981' : completionPct >= 50 ? '#3b82f6' : completionPct >= 20 ? '#f59e0b' : '#ef4444'}
                                        strokeWidth={stroke}
                                        strokeLinecap="round"
                                        strokeDasharray={circumference}
                                        strokeDashoffset={offset}
                                        className="transition-all duration-700"
                                      />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                      <span className="text-3xl font-extrabold text-[#1a1a2e]">{completionPct}%</span>
                                      <span className="text-[10px] text-gray-400 mt-0.5">完成率</span>
                                    </div>
                                  </div>
                                  {detailAssignment.deadline && (
                                    <div className="mt-3 text-center">
                                      <span className="text-[10px] text-gray-400">截止日期</span>
                                      <p className="text-xs font-medium text-gray-600">{formatDate(detailAssignment.deadline)}</p>
                                    </div>
                                  )}
                                </div>

                                {/* 右侧 — KPI + 分布图 */}
                                <div className="flex-1 min-w-0 space-y-5">
                                  {/* KPI 卡片 */}
                                  <div className="grid grid-cols-4 gap-3">
                                    {[
                                      { label: '平均分', value: cls.avg_score, icon: BarChart3, bg: 'from-blue-50 to-blue-100/40', iconColor: 'text-blue-500', valueColor: 'text-blue-700' },
                                      { label: '最高分', value: cls.max_score, icon: Trophy, bg: 'from-amber-50 to-amber-100/40', iconColor: 'text-amber-500', valueColor: 'text-amber-700' },
                                      { label: '及格率', value: `${cls.pass_rate}%`, icon: TrendingUp, bg: 'from-emerald-50 to-emerald-100/40', iconColor: 'text-emerald-500', valueColor: 'text-emerald-700' },
                                      { label: '完成率', value: `${cls.completion_rate}%`, icon: CheckCircle2, bg: 'from-violet-50 to-violet-100/40', iconColor: 'text-violet-500', valueColor: 'text-violet-700' },
                                    ].map((kpi) => (
                                      <div key={kpi.label} className={`rounded-xl bg-gradient-to-br ${kpi.bg} p-4`}>
                                        <div className="flex items-center gap-1.5">
                                          <kpi.icon className={`size-4 ${kpi.iconColor}`} />
                                          <span className="text-[11px] font-medium text-gray-500">{kpi.label}</span>
                                        </div>
                                        <p className={`mt-2 text-2xl font-extrabold ${kpi.valueColor}`}>{kpi.value}</p>
                                      </div>
                                    ))}
                                  </div>

                                  {/* 得分分布柱状图 */}
                                  <div>
                                    <p className="mb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">得分分布</p>
                                    <div className="flex items-stretch gap-2 h-28">
                                      {[
                                        { label: '0-20', count: cls.score_distribution[0] },
                                        { label: '20-40', count: cls.score_distribution[1] },
                                        { label: '40-60', count: cls.score_distribution[2] },
                                        { label: '60-80', count: cls.score_distribution[3] },
                                        { label: '80-100', count: cls.score_distribution[4] },
                                      ].map((seg, i) => {
                                        const maxCount = Math.max(...cls.score_distribution, 1);
                                        const height = seg.count > 0 ? (seg.count / maxCount) * 100 : 0;
                                        const colors = [
                                          'from-red-400 to-red-300',
                                          'from-orange-400 to-orange-300',
                                          'from-amber-400 to-amber-300',
                                          'from-blue-400 to-blue-300',
                                          'from-emerald-400 to-emerald-300',
                                        ];
                                        return (
                                          <div key={seg.label} className="flex flex-1 flex-col items-center h-full">
                                            <span className="text-[10px] font-bold text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                              {seg.count}人
                                            </span>
                                            <div className="w-full flex-1 flex items-end">
                                              <div
                                                className={`w-full rounded-t-md bg-gradient-to-t ${colors[i]} transition-all duration-300 hover:opacity-80`}
                                                style={{ height: seg.count > 0 ? `${Math.max(height, 12)}%` : '4px', minHeight: seg.count > 0 ? '8px' : '0' }}
                                              />
                                            </div>
                                            <span className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0">{seg.label}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : (
                  /* 非发布状态 — 紧凑信息卡 */
                  <div className="rounded-2xl bg-white shadow-[0_4px_12px_rgba(0,0,0,0.05)] p-6">
                    <div className="grid grid-cols-2 gap-5">
                      <div>
                        <span className="text-xs text-gray-400 uppercase tracking-wider">所属章节</span>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {(detailAssignment.chapters || []).map((ch, i) => (
                            <Badge key={i} variant="outline" className="text-xs border-gray-200">{ch}</Badge>
                          ))}
                          {(!detailAssignment.chapters || detailAssignment.chapters.length === 0) && <span className="text-sm text-gray-300">-</span>}
                        </div>
                      </div>
                      <div>
                        <span className="text-xs text-gray-400 uppercase tracking-wider">所属知识点</span>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {(detailAssignment.knowledge_points || []).map((kp, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">{kp}</Badge>
                          ))}
                          {(!detailAssignment.knowledge_points || detailAssignment.knowledge_points.length === 0) && <span className="text-sm text-gray-300">-</span>}
                        </div>
                      </div>
                      <div>
                        <span className="text-xs text-gray-400 uppercase tracking-wider">题目要求</span>
                        <p className="mt-2 text-sm font-medium text-gray-700">选择题 {detailAssignment.xzt_cnt} 题 / 判断题 {detailAssignment.pdt_cnt} 题</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-400 uppercase tracking-wider">截止时间</span>
                        <p className="mt-2 text-sm font-medium text-gray-700">{detailAssignment.deadline ? formatDate(detailAssignment.deadline) : '-'}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {/* ---- AI教学建议 ---- */}
              {detailAssignment && detailAssignment.status === 'published' && (
                <div className="mt-5 rounded-2xl bg-white shadow-[0_4px_12px_rgba(0,0,0,0.05)] p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50">
                        <Sparkles className="h-4 w-4 text-purple-600" />
                      </div>
                      <h3 className="text-sm font-semibold text-gray-800">AI教学建议</h3>
                    </div>
                    <Button
                      size="sm"
                      onClick={async () => {
                        if (!detailAssignment) return;
                        setAssignmentAiLoading(true);
                        try {
                          const res = await fetch('/api/assignments/ai-suggestion', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ assignment_id: detailAssignment.id }),
                          });
                          const data = await res.json();
                          if (data.suggestion) {
                            setAssignmentAiSuggestion(data.suggestion);
                          }
                        } catch (e) {
                          console.error('Failed to generate AI suggestion', e);
                        } finally {
                          setAssignmentAiLoading(false);
                        }
                      }}
                      disabled={assignmentAiLoading}
                      className="h-7 text-xs gap-1 bg-purple-600 hover:bg-purple-700"
                    >
                      {assignmentAiLoading ? (
                        <><Loader2 className="h-3 w-3 animate-spin" />生成中...</>
                      ) : assignmentAiSuggestion ? (
                        <><RefreshCw className="h-3 w-3" />重新生成</>
                      ) : (
                        <><Sparkles className="h-3 w-3" />生成建议</>
                      )}
                    </Button>
                  </div>
                  {assignmentAiLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
                      <span className="ml-2 text-sm text-gray-400">AI正在分析错题并生成建议...</span>
                    </div>
                  ) : assignmentAiSuggestion ? (
                    <div className="rounded-xl bg-purple-50/50 border border-purple-100 p-4">
                      <p className="text-xs text-gray-400 mb-2">生成时间：{new Date(assignmentAiSuggestion.created_at).toLocaleString('zh-CN')}</p>
                      <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{assignmentAiSuggestion.content}</div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 text-center py-4">点击"生成建议"按钮，AI将分析错题情况并给出教学建议</p>
                  )}
                </div>
              )}
            </>
            )}

            {/* ---- 作业题目 Tab ---- */}
            {detailAssignment && detailTab === 'questions' && (
              <div>
                <div className="mb-5 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <BookOpen className="size-4" />
                    作业题目
                    {!detailLoading && (
                      <span className="font-normal text-gray-400">共 {detailQuestions.length} 题</span>
                    )}
                  </h3>
                </div>
                {detailLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="size-6 animate-spin text-gray-400" />
                  </div>
                ) : detailQuestions.length === 0 ? (
                  <div className="rounded-2xl bg-white shadow-[0_4px_12px_rgba(0,0,0,0.05)] py-16 text-center">
                    <BookOpen className="mx-auto mb-4 size-14 text-gray-200" />
                    <p className="text-sm text-gray-400">
                      {detailAssignment.status === 'generating' ? '题目正在生成中...' : '暂无题目'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* 第一级：3类作业 */}
                    {/* 1. 老师下发作业 */}
                    {(() => {
                      const teacherQuestions = detailQuestions.filter(q =>
                        !q.category || q.category === '' || q.category === 'teacher_assignment' || q.category.includes('下发作业') || q.category.includes('老师下发作业')
                      );
                      if (teacherQuestions.length === 0) return null;
                      const typeKey = 'teacher';
                      const isExpanded = expandedTypes.has(typeKey);
                      return (
                        <div key={typeKey} className="rounded-xl bg-gradient-to-r from-blue-50 to-blue-100 border-l-4 border-blue-500">
                          <button
                            onClick={() => toggleTypeExpand(typeKey)}
                            className="w-full p-4 flex items-center justify-between hover:bg-blue-100/50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500">
                                <FileText className="size-5 text-white" />
                              </div>
                              <div>
                                <h4 className="text-lg font-bold text-gray-900">老师下发作业</h4>
                                <p className="text-sm text-blue-600">{teacherQuestions.length} 题</p>
                              </div>
                            </div>
                            <ChevronDown className={`size-5 text-blue-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>
                          {isExpanded && (
                            <div className="px-4 pb-4 grid grid-cols-2 gap-4">
                              {teacherQuestions.map((q, idx) => (
                                <div key={q.id} className="rounded-2xl bg-white shadow-[0_4px_12px_rgba(0,0,0,0.05)] p-5 transition-shadow hover:shadow-md">
                                  <div className="flex items-center gap-2 mb-3">
                                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1e3a5f] text-xs font-bold text-white">{idx + 1}</span>
                                    <Badge className={q.type === 1 ? 'bg-purple-100 text-purple-700 text-[10px] border-0' : 'bg-orange-100 text-orange-700 text-[10px] border-0'}>
                                      {q.type === 1 ? '选择题' : '判断题'}
                                    </Badge>
                                  </div>
                                  <p className="mb-4 text-sm font-medium leading-relaxed text-[#1a1a2e]">{q.title}</p>
                                  <div className="grid grid-cols-2 gap-2">
                                    {q.options.map((opt) => (
                                      <div key={opt.key} className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm ${opt.key === q.answer ? 'border-emerald-200 bg-emerald-50 text-emerald-800 font-medium' : 'border-gray-100 bg-gray-50/50 text-gray-600'}`}>
                                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ${opt.key === q.answer ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'}`}>{opt.key}</span>
                                        <span className="truncate">{opt.text}</span>
                                      </div>
                                    ))}
                                  </div>
                                  {q.analysis && (
                                    <div className="mt-3 rounded-xl bg-sky-50 px-4 py-2.5">
                                      <span className="text-[10px] font-bold text-sky-600 uppercase tracking-wider">解析</span>
                                      <p className="mt-1 text-xs leading-relaxed text-sky-700">{q.analysis}</p>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* 2. 班级共性作业 */}
                    {(() => {
                      const classQuestions = detailQuestions.filter(q => q.category && (q.category === 'class_assignment' || q.category.startsWith('class_assignment-') || q.category.includes('班级共性作业')));
                      if (classQuestions.length === 0) return null;
                      const typeKey = 'class';
                      const isExpanded = expandedTypes.has(typeKey);
                      // 按 class_name 分组
                      const classMap = new Map<string, Question[]>();
                      classQuestions.forEach(q => {
                        let className = q.class_name;
                        if (!className && q.category?.includes('-')) className = q.category.split('-')[1];
                        className = className || '全部班级';
                        if (!classMap.has(className)) classMap.set(className, []);
                        classMap.get(className)!.push(q);
                      });
                      return (
                        <div key={typeKey} className="rounded-xl bg-gradient-to-r from-green-50 to-green-100 border-l-4 border-green-500">
                          <button
                            onClick={() => toggleTypeExpand(typeKey)}
                            className="w-full p-4 flex items-center justify-between hover:bg-green-100/50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500">
                                <Users className="size-5 text-white" />
                              </div>
                              <div>
                                <h4 className="text-lg font-bold text-gray-900">班级共性作业</h4>
                                <p className="text-sm text-green-600">{classQuestions.length} 题 · {classMap.size} 个班级</p>
                              </div>
                            </div>
                            <ChevronDown className={`size-5 text-green-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>
                          {isExpanded && (
                            <div className="px-4 pb-4 space-y-2">
                              {Array.from(classMap.entries()).map(([className, questions]) => {
                                const groupKey = `class-${className}`;
                                const isGroupExpanded = expandedGroups.has(groupKey);
                                return (
                                  <div key={className} className="rounded-lg bg-white/80 border border-green-200">
                                    <button
                                      onClick={() => toggleGroupExpand(groupKey)}
                                      className="w-full p-3 flex items-center justify-between hover:bg-green-50/50 transition-colors"
                                    >
                                      <div className="flex items-center gap-2">
                                        <Users className="size-4 text-green-600" />
                                        <span className="font-semibold text-gray-800">班级：{className}</span>
                                        <Badge className="bg-green-100 text-green-700 text-xs border-0">{questions.length} 题</Badge>
                                      </div>
                                      <ChevronDown className={`size-4 text-green-600 transition-transform ${isGroupExpanded ? 'rotate-180' : ''}`} />
                                    </button>
                                    {isGroupExpanded && (
                                      <div className="p-3 pt-0 grid grid-cols-2 gap-3">
                                        {questions.map((q, idx) => (
                                          <div key={q.id} className="rounded-xl bg-white shadow p-4">
                                            <div className="flex items-center gap-2 mb-2">
                                              <span className="flex h-6 w-6 items-center justify-center rounded bg-[#1e3a5f] text-xs font-bold text-white">{idx + 1}</span>
                                              <Badge className={q.type === 1 ? 'bg-purple-100 text-purple-700 text-[10px] border-0' : 'bg-orange-100 text-orange-700 text-[10px] border-0'}>
                                                {q.type === 1 ? '选择题' : '判断题'}
                                              </Badge>
                                            </div>
                                            <p className="mb-3 text-sm font-medium text-[#1a1a2e]">{q.title}</p>
                                            <div className="grid grid-cols-2 gap-2">
                                              {q.options.map((opt) => (
                                                <div key={opt.key} className={`flex items-center gap-2 rounded border px-2 py-2 text-xs ${opt.key === q.answer ? 'border-emerald-200 bg-emerald-50 text-emerald-800 font-medium' : 'border-gray-100 bg-gray-50/50 text-gray-600'}`}>
                                                  <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] ${opt.key === q.answer ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'}`}>{opt.key}</span>
                                                  <span className="truncate">{opt.text}</span>
                                                </div>
                                              ))}
                                            </div>
                                            {q.analysis && (
                                              <div className="mt-2 rounded bg-sky-50 px-3 py-2">
                                                <p className="text-xs text-sky-700">{q.analysis}</p>
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* 3. 个性化作业 */}
                    {(() => {
                      const personalQuestions = detailQuestions.filter(q => q.category && (q.category === 'personal_assignment' || q.category.startsWith('personal_assignment-') || q.category.includes('个性化作业')));
                      if (personalQuestions.length === 0) return null;
                      const typeKey = 'personal';
                      const isExpanded = expandedTypes.has(typeKey);
                      // 按 student_number 分组
                      const personalMap = new Map<string, { name: string; questions: Question[] }>();
                      personalQuestions.forEach(q => {
                        let studentId = q.student_number;
                        if (!studentId && q.category?.includes('-')) studentId = q.category.split('-')[1];
                        studentId = studentId || '';
                        const studentName = q.student_name || '';
                        if (!personalMap.has(studentId)) personalMap.set(studentId, { name: studentName, questions: [] });
                        personalMap.get(studentId)!.questions.push(q);
                        if (studentName && !personalMap.get(studentId)!.name) personalMap.get(studentId)!.name = studentName;
                      });
                      return (
                        <div key={typeKey} className="rounded-xl bg-gradient-to-r from-purple-50 to-purple-100 border-l-4 border-purple-500">
                          <button
                            onClick={() => toggleTypeExpand(typeKey)}
                            className="w-full p-4 flex items-center justify-between hover:bg-purple-100/50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500">
                                <User className="size-5 text-white" />
                              </div>
                              <div>
                                <h4 className="text-lg font-bold text-gray-900">个性化作业</h4>
                                <p className="text-sm text-purple-600">{personalQuestions.length} 题 · {personalMap.size} 个学生</p>
                              </div>
                            </div>
                            <ChevronDown className={`size-5 text-purple-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>
                          {isExpanded && (
                            <div className="px-4 pb-4 space-y-2">
                              {Array.from(personalMap.entries()).map(([studentId, data]) => {
                                const groupKey = `personal-${studentId}`;
                                const isGroupExpanded = expandedGroups.has(groupKey);
                                return (
                                  <div key={studentId} className="rounded-lg bg-white/80 border border-purple-200">
                                    <button
                                      onClick={() => toggleGroupExpand(groupKey)}
                                      className="w-full p-3 flex items-center justify-between hover:bg-purple-50/50 transition-colors"
                                    >
                                      <div className="flex items-center gap-2">
                                        <User className="size-4 text-purple-600" />
                                        <span className="font-semibold text-gray-800">学号：{studentId}</span>
                                        {data.name && <span className="text-xs text-purple-600">({data.name})</span>}
                                        <Badge className="bg-purple-100 text-purple-700 text-xs border-0">{data.questions.length} 题</Badge>
                                      </div>
                                      <ChevronDown className={`size-4 text-purple-600 transition-transform ${isGroupExpanded ? 'rotate-180' : ''}`} />
                                    </button>
                                    {isGroupExpanded && (
                                      <div className="p-3 pt-0 grid grid-cols-2 gap-3">
                                        {data.questions.map((q, idx) => (
                                          <div key={q.id} className="rounded-xl bg-white shadow p-4">
                                            <div className="flex items-center gap-2 mb-2">
                                              <span className="flex h-6 w-6 items-center justify-center rounded bg-[#1e3a5f] text-xs font-bold text-white">{idx + 1}</span>
                                              <Badge className={q.type === 1 ? 'bg-purple-100 text-purple-700 text-[10px] border-0' : 'bg-orange-100 text-orange-700 text-[10px] border-0'}>
                                                {q.type === 1 ? '选择题' : '判断题'}
                                              </Badge>
                                            </div>
                                            <p className="mb-3 text-sm font-medium text-[#1a1a2e]">{q.title}</p>
                                            <div className="grid grid-cols-2 gap-2">
                                              {q.options.map((opt) => (
                                                <div key={opt.key} className={`flex items-center gap-2 rounded border px-2 py-2 text-xs ${opt.key === q.answer ? 'border-emerald-200 bg-emerald-50 text-emerald-800 font-medium' : 'border-gray-100 bg-gray-50/50 text-gray-600'}`}>
                                                  <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] ${opt.key === q.answer ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'}`}>{opt.key}</span>
                                                  <span className="truncate">{opt.text}</span>
                                                </div>
                                              ))}
                                            </div>
                                            {q.analysis && (
                                              <div className="mt-2 rounded bg-sky-50 px-3 py-2">
                                                <p className="text-xs text-sky-700">{q.analysis}</p>
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* ---- 错题排行 Tab ---- */}
            {detailAssignment && detailTab === 'wrong' && (
              detailStatsLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="size-6 animate-spin text-gray-400" />
                </div>
              ) : !detailStats || detailStats.wrong_ranking.length === 0 ? (
                <div className="rounded-2xl bg-white shadow-[0_4px_12px_rgba(0,0,0,0.05)] py-20 text-center">
                  <CheckCircle2 className="mx-auto mb-4 size-14 text-emerald-200" />
                  <p className="text-sm text-gray-400">全部正确，暂无错题</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {detailStats.wrong_ranking.map((w, idx) => (
                    <div key={w.question_id} className="rounded-2xl bg-white shadow-[0_4px_12px_rgba(0,0,0,0.05)] p-5 transition-shadow hover:shadow-md">
                      <div className="flex items-start gap-4">
                        {/* 排名 */}
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${
                          idx === 0 ? 'bg-red-100 text-red-600 ring-2 ring-red-200'
                            : idx === 1 ? 'bg-orange-100 text-orange-600 ring-2 ring-orange-200'
                            : idx === 2 ? 'bg-amber-100 text-amber-600 ring-2 ring-amber-200'
                            : 'bg-gray-100 text-gray-400'
                        }`}>
                          {idx + 1}
                        </div>
                        {/* 题目信息 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <Badge className={w.type === 1 ? 'bg-purple-100 text-purple-700 text-[10px] border-0' : 'bg-orange-100 text-orange-700 text-[10px] border-0'}>
                              {w.type === 1 ? '选择题' : '判断题'}
                            </Badge>
                            <span className="text-xs text-gray-400">第 {w.question_number} 题</span>
                          </div>
                          <p className="text-sm font-medium text-[#1a1a2e] line-clamp-2">{w.title}</p>
                          <div className="mt-2.5 flex items-center gap-5 text-xs">
                            <span className="text-gray-400">正确答案：<span className="font-bold text-emerald-600">{w.answer}</span></span>
                            <span className="text-gray-400">
                              错误：<span className="font-bold text-red-500">{w.error_count}</span>/{w.total_count} 人
                            </span>
                          </div>
                          {/* 错误率进度条 */}
                          <div className="mt-2.5 flex items-center gap-2.5">
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  w.error_rate >= 60 ? 'bg-gradient-to-r from-red-500 to-red-400' : w.error_rate >= 30 ? 'bg-gradient-to-r from-orange-500 to-orange-400' : 'bg-gradient-to-r from-amber-500 to-amber-400'
                                }`}
                                style={{ width: `${Math.min(w.error_rate, 100)}%` }}
                              />
                            </div>
                            <span className={`text-xs font-extrabold ${
                              w.error_rate >= 60 ? 'text-red-600' : w.error_rate >= 30 ? 'text-orange-600' : 'text-amber-600'
                            }`}>
                              {w.error_rate}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ========= Questions Dialog ========= */}
      <Dialog open={showQuestions} onOpenChange={setShowQuestions}>
        <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>查看题目</DialogTitle>
          </DialogHeader>
          {questionsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-[var(--primary)]" />
            </div>
          ) : questions.length === 0 ? (
            <p className="py-8 text-center text-[var(--muted-foreground)]">暂无题目</p>
          ) : (
            <div className="space-y-3">
              {/* 第一级：3类作业 */}
              {/* 1. 老师下发作业 */}
              {(() => {
                const teacherQuestions = questions.filter(q =>
                  !q.category || q.category === '' || q.category === 'teacher_assignment' || q.category.includes('下发作业') || q.category.includes('老师下发作业')
                );
                if (teacherQuestions.length === 0) return null;
                const typeKey = 'teacher-questions';
                const isExpanded = expandedTypes.has(typeKey);
                return (
                  <div key={typeKey} className="rounded-xl bg-gradient-to-r from-blue-50 to-blue-100 border-l-4 border-blue-500">
                    <button onClick={() => toggleTypeExpand(typeKey)} className="w-full p-4 flex items-center justify-between hover:bg-blue-100/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500"><FileText className="size-5 text-white" /></div>
                        <div>
                          <h4 className="text-lg font-bold text-gray-900">老师下发作业</h4>
                          <p className="text-sm text-blue-600">{teacherQuestions.length} 题</p>
                        </div>
                      </div>
                      <ChevronDown className={`size-5 text-blue-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-3">
                        {teacherQuestions.map((q, idx) => (
                          <Card key={q.id} className="p-4">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="outline" className="text-xs">{q.type === 1 ? '单选题' : '判断题'}</Badge>
                                  <span className="text-xs text-gray-400">第 {idx + 1} 题</span>
                                </div>
                                <div className="mb-1 text-sm font-medium">{q.title}</div>
                                <div className="ml-6 space-y-1">
                                  {q.options?.map((opt) => (
                                    <div key={opt.key} className={`text-sm ${opt.key === q.answer ? 'font-medium text-green-600' : 'text-gray-500'}`}>
                                      {opt.key}. {opt.text}
                                    </div>
                                  ))}
                                </div>
                                {q.analysis && <div className="mt-2 text-xs text-gray-500">解析：{q.analysis}</div>}
                              </div>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="sm" disabled={currentAssignment?.status === 'published'} onClick={() => { setEditingQuestion(q); setShowQuestionEdit(true); }}><Edit className="size-3" /></Button>
                                <Button variant="ghost" size="sm" disabled={currentAssignment?.status === 'published'} onClick={() => handleDeleteQuestion(q.id)}><Trash2 className="size-3 text-red-500" /></Button>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* 2. 班级共性作业 */}
              {(() => {
                const classQuestions = questions.filter(q => q.category && (q.category === 'class_assignment' || q.category.startsWith('class_assignment-') || q.category.includes('班级共性作业')));
                if (classQuestions.length === 0) return null;
                const typeKey = 'class-questions';
                const isExpanded = expandedTypes.has(typeKey);
                const classMap = new Map<string, Question[]>();
                classQuestions.forEach(q => {
                  let className = q.class_name;
                  if (!className && q.category?.includes('-')) className = q.category.split('-')[1];
                  className = className || '全部班级';
                  if (!classMap.has(className)) classMap.set(className, []);
                  classMap.get(className)!.push(q);
                });
                return (
                  <div key={typeKey} className="rounded-xl bg-gradient-to-r from-green-50 to-green-100 border-l-4 border-green-500">
                    <button onClick={() => toggleTypeExpand(typeKey)} className="w-full p-4 flex items-center justify-between hover:bg-green-100/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500"><Users className="size-5 text-white" /></div>
                        <div>
                          <h4 className="text-lg font-bold text-gray-900">班级共性作业</h4>
                          <p className="text-sm text-green-600">{classQuestions.length} 题 · {classMap.size} 个班级</p>
                        </div>
                      </div>
                      <ChevronDown className={`size-5 text-green-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-2">
                        {Array.from(classMap.entries()).map(([className, qs]) => {
                          const groupKey = `class-q-${className}`;
                          const isGroupExpanded = expandedGroups.has(groupKey);
                          return (
                            <div key={className} className="rounded-lg bg-white/80 border border-green-200">
                              <button onClick={() => toggleGroupExpand(groupKey)} className="w-full p-3 flex items-center justify-between hover:bg-green-50/50 transition-colors">
                                <div className="flex items-center gap-2">
                                  <Users className="size-4 text-green-600" />
                                  <span className="font-semibold text-gray-800">班级：{className}</span>
                                  <Badge className="bg-green-100 text-green-700 text-xs border-0">{qs.length} 题</Badge>
                                </div>
                                <ChevronDown className={`size-4 text-green-600 transition-transform ${isGroupExpanded ? 'rotate-180' : ''}`} />
                              </button>
                              {isGroupExpanded && (
                                <div className="p-3 pt-0 space-y-2">
                                  {qs.map((q, idx) => (
                                    <Card key={q.id} className="p-3">
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2 mb-1">
                                            <Badge variant="outline" className="text-xs">{q.type === 1 ? '单选题' : '判断题'}</Badge>
                                            <span className="text-xs text-gray-400">第 {idx + 1} 题</span>
                                          </div>
                                          <div className="text-sm font-medium">{q.title}</div>
                                          <div className="ml-4 mt-1 space-y-1">
                                            {q.options?.map((opt) => (
                                              <div key={opt.key} className={`text-xs ${opt.key === q.answer ? 'font-medium text-green-600' : 'text-gray-500'}`}>
                                                {opt.key}. {opt.text}
                                              </div>
                                            ))}
                                          </div>
                                          {q.analysis && <div className="mt-1 text-xs text-gray-500">解析：{q.analysis}</div>}
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <Button variant="ghost" size="sm" disabled={currentAssignment?.status === 'published'} onClick={() => { setEditingQuestion(q); setShowQuestionEdit(true); }}><Edit className="size-3" /></Button>
                                          <Button variant="ghost" size="sm" disabled={currentAssignment?.status === 'published'} onClick={() => handleDeleteQuestion(q.id)}><Trash2 className="size-3 text-red-500" /></Button>
                                        </div>
                                      </div>
                                    </Card>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* 3. 个性化作业 */}
              {(() => {
                const personalQuestions = questions.filter(q => q.category && (q.category === 'personal_assignment' || q.category.startsWith('personal_assignment-') || q.category.includes('个性化作业')));
                if (personalQuestions.length === 0) return null;
                const typeKey = 'personal-questions';
                const isExpanded = expandedTypes.has(typeKey);
                const personalMap = new Map<string, { name: string; questions: Question[] }>();
                personalQuestions.forEach(q => {
                  let studentId = q.student_number;
                  if (!studentId && q.category?.includes('-')) studentId = q.category.split('-')[1];
                  studentId = studentId || '';
                  const studentName = q.student_name || '';
                  if (!personalMap.has(studentId)) personalMap.set(studentId, { name: studentName, questions: [] });
                  personalMap.get(studentId)!.questions.push(q);
                  if (studentName && !personalMap.get(studentId)!.name) personalMap.get(studentId)!.name = studentName;
                });
                return (
                  <div key={typeKey} className="rounded-xl bg-gradient-to-r from-purple-50 to-purple-100 border-l-4 border-purple-500">
                    <button onClick={() => toggleTypeExpand(typeKey)} className="w-full p-4 flex items-center justify-between hover:bg-purple-100/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500"><User className="size-5 text-white" /></div>
                        <div>
                          <h4 className="text-lg font-bold text-gray-900">个性化作业</h4>
                          <p className="text-sm text-purple-600">{personalQuestions.length} 题 · {personalMap.size} 个学生</p>
                        </div>
                      </div>
                      <ChevronDown className={`size-5 text-purple-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-2">
                        {Array.from(personalMap.entries()).map(([studentId, data]) => {
                          const groupKey = `personal-q-${studentId}`;
                          const isGroupExpanded = expandedGroups.has(groupKey);
                          return (
                            <div key={studentId} className="rounded-lg bg-white/80 border border-purple-200">
                              <button onClick={() => toggleGroupExpand(groupKey)} className="w-full p-3 flex items-center justify-between hover:bg-purple-50/50 transition-colors">
                                <div className="flex items-center gap-2">
                                  <User className="size-4 text-purple-600" />
                                  <span className="font-semibold text-gray-800">学号：{studentId}</span>
                                  {data.name && <span className="text-xs text-purple-600">({data.name})</span>}
                                  <Badge className="bg-purple-100 text-purple-700 text-xs border-0">{data.questions.length} 题</Badge>
                                </div>
                                <ChevronDown className={`size-4 text-purple-600 transition-transform ${isGroupExpanded ? 'rotate-180' : ''}`} />
                              </button>
                              {isGroupExpanded && (
                                <div className="p-3 pt-0 space-y-2">
                                  {data.questions.map((q, idx) => (
                                    <Card key={q.id} className="p-3">
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2 mb-1">
                                            <Badge variant="outline" className="text-xs">{q.type === 1 ? '单选题' : '判断题'}</Badge>
                                            <span className="text-xs text-gray-400">第 {idx + 1} 题</span>
                                          </div>
                                          <div className="text-sm font-medium">{q.title}</div>
                                          <div className="ml-4 mt-1 space-y-1">
                                            {q.options?.map((opt) => (
                                              <div key={opt.key} className={`text-xs ${opt.key === q.answer ? 'font-medium text-green-600' : 'text-gray-500'}`}>
                                                {opt.key}. {opt.text}
                                              </div>
                                            ))}
                                          </div>
                                          {q.analysis && <div className="mt-1 text-xs text-gray-500">解析：{q.analysis}</div>}
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <Button variant="ghost" size="sm" disabled={currentAssignment?.status === 'published'} onClick={() => { setEditingQuestion(q); setShowQuestionEdit(true); }}><Edit className="size-3" /></Button>
                                          <Button variant="ghost" size="sm" disabled={currentAssignment?.status === 'published'} onClick={() => handleDeleteQuestion(q.id)}><Trash2 className="size-3 text-red-500" /></Button>
                                        </div>
                                      </div>
                                    </Card>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={currentAssignment?.status === 'published'} onClick={() => { setShowAddQuestion(true); }}>
              <Plus className="mr-1 size-4" />
              新增题目
            </Button>
            <Button variant="outline" onClick={() => setShowQuestions(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========= Edit/Add Question Dialog ========= */}
      <Dialog
        open={showQuestionEdit || showAddQuestion}
        onOpenChange={(open) => {
          if (!open) {
            setShowQuestionEdit(false);
            setShowAddQuestion(false);
            setEditingQuestion(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{showAddQuestion ? '新增题目' : '编辑题目'}</DialogTitle>
          </DialogHeader>
          <QuestionForm
            question={editingQuestion}
            isNew={showAddQuestion}
            onSave={handleSaveQuestion}
            onCancel={() => {
              setShowQuestionEdit(false);
              setShowAddQuestion(false);
              setEditingQuestion(null);
            }}
            classList={classList}
            studentList={studentList}
          />
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={showQRCode} onOpenChange={setShowQRCode}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">作业二维码</DialogTitle>
          </DialogHeader>
          {qrAssignment && (
            <div className="flex flex-col items-center py-4">
              <div className="p-4 bg-gray-50 rounded-xl mb-4">
                <QRCode 
                  value={`${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000'}/student/dashboard/tasks/${qrAssignment.id}`} 
                  size={200} 
                />
              </div>
              <p className="text-sm text-gray-500 text-center mb-3">
                学生登录系统后，扫码可直接进入该作业作答页面
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Question form component
function QuestionForm({
  question,
  isNew,
  onSave,
  onCancel,
  classList,
  studentList,
}: {
  question: Question | null;
  isNew: boolean;
  onSave: (q: Partial<Question>, isNew: boolean) => void;
  onCancel: () => void;
  classList: Array<{ id: string; name: string }>;
  studentList: Array<{ student_number: string; name: string }>;
}) {
  const [type, setType] = useState(question?.type || 1);
  const [title, setTitle] = useState(question?.title || '');
  const [options, setOptions] = useState<{ key: string; text: string }[]>(
    question?.options && (question.options as { key: string; text: string }[]).length > 0
      ? (question.options as { key: string; text: string }[])
      : (question?.type || 1) === 2
        ? [{ key: 'A', text: '正确' }, { key: 'B', text: '错误' }]
        : [{ key: 'A', text: '' }, { key: 'B', text: '' }, { key: 'C', text: '' }, { key: 'D', text: '' }]
  );
  const [answer, setAnswer] = useState(question?.answer || '');
  const [analysis, setAnalysis] = useState(question?.analysis || '');
  const [category, setCategory] = useState(question?.category || 'teacher_assignment');
  const [selectedClass, setSelectedClass] = useState(question?.class_name || '');
  const [selectedStudentNumber, setSelectedStudentNumber] = useState(question?.student_number || '');
  const [selectedStudentName, setSelectedStudentName] = useState(question?.student_name || '');

  // When editing a different question, reload all fields
  useEffect(() => {
    if (question) {
      setType(question.type);
      setTitle(question.title);
      const opts = question.options as { key: string; text: string }[];
      setOptions(opts && opts.length > 0
        ? opts
        : question.type === 2
          ? [{ key: 'A', text: '正确' }, { key: 'B', text: '错误' }]
          : [{ key: 'A', text: '' }, { key: 'B', text: '' }, { key: 'C', text: '' }, { key: 'D', text: '' }]
      );
      setAnswer(question.answer);
      setAnalysis(question.analysis || '');
      setCategory(question.category || 'teacher_assignment');
      setSelectedClass(question.class_name || '');
      setSelectedStudentNumber(question.student_number || '');
      setSelectedStudentName(question.student_name || '');
    } else {
      setType(1);
      setTitle('');
      setOptions([{ key: 'A', text: '' }, { key: 'B', text: '' }, { key: 'C', text: '' }, { key: 'D', text: '' }]);
      setAnswer('');
      setAnalysis('');
      setCategory('老师下发作业');
      setSelectedClass('');
      setSelectedStudentNumber('');
      setSelectedStudentName('');
    }
  }, [question]);

  useEffect(() => {
    if (type === 2 && !question) {
      setOptions([{ key: 'A', text: '正确' }, { key: 'B', text: '错误' }]);
    } else if (type === 1 && !question) {
      setOptions([
        { key: 'A', text: '' },
        { key: 'B', text: '' },
        { key: 'C', text: '' },
        { key: 'D', text: '' },
      ]);
      setAnswer('');
    }
  }, [type, question]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>题目类型</Label>
        <Select value={String(type)} onValueChange={(v) => setType(parseInt(v))}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">单选题</SelectItem>
            <SelectItem value="2">判断题</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isNew && (
        <div className="space-y-2">
          <Label>作业类型</Label>
          <Select value={category} onValueChange={(v) => {
            setCategory(v);
            setSelectedClass('');
            setSelectedStudentNumber('');
            setSelectedStudentName('');
          }}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="teacher_assignment">老师下发作业</SelectItem>
              <SelectItem value="class_assignment">班级共性作业</SelectItem>
              <SelectItem value="personal_assignment">个性化作业</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {isNew && category === 'class_assignment' && (
        <div className="space-y-2">
          <Label>所属班级</Label>
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger>
              <SelectValue placeholder="选择班级" />
            </SelectTrigger>
            <SelectContent>
              {classList.map((cls) => (
                <SelectItem key={cls.id} value={cls.name}>{cls.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {isNew && category === 'personal_assignment' && (
        <div className="space-y-2">
          <Label>所属学生</Label>
          <Select value={selectedStudentNumber} onValueChange={(v) => {
            setSelectedStudentNumber(v);
            const student = studentList.find(s => s.student_number === v);
            setSelectedStudentName(student?.name || '');
          }}>
            <SelectTrigger>
              <SelectValue placeholder="选择学生" />
            </SelectTrigger>
            <SelectContent>
              {studentList.map((s) => (
                <SelectItem key={s.student_number} value={s.student_number}>
                  {s.student_number} ({s.name})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label>题目</Label>
        <Textarea value={title} onChange={(e) => setTitle(e.target.value)} rows={3} />
      </div>

      <div className="space-y-2">
        <Label>选项</Label>
        <div className="space-y-2">
          {options.map((opt, idx) => (
            <div key={opt.key} className="flex items-center gap-2">
              <span className="w-6 text-sm font-medium">{opt.key}.</span>
              {type === 2 ? (
                <span className="text-sm">{opt.text}</span>
              ) : (
                <Input
                  value={opt.text}
                  onChange={(e) => {
                    const newOpts = [...options];
                    newOpts[idx] = { ...newOpts[idx], text: e.target.value };
                    setOptions(newOpts);
                  }}
                  placeholder={`选项${opt.key}`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>正确答案</Label>
        {type === 2 ? (
          <Select value={answer} onValueChange={setAnswer}>
            <SelectTrigger>
              <SelectValue placeholder="选择答案" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="A">A. 正确</SelectItem>
              <SelectItem value="B">B. 错误</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <Select value={answer} onValueChange={setAnswer}>
            <SelectTrigger>
              <SelectValue placeholder="选择答案" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="A">A</SelectItem>
              <SelectItem value="B">B</SelectItem>
              <SelectItem value="C">C</SelectItem>
              <SelectItem value="D">D</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="space-y-2">
        <Label>解析</Label>
        <Textarea value={analysis} onChange={(e) => setAnalysis(e.target.value)} rows={2} />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button
          onClick={() => {
            let finalCategory = isNew ? category : question?.category;
            if (isNew && category === 'class_assignment' && selectedClass) {
              finalCategory = `class_assignment-${selectedClass}`;
            }
            if (isNew && category === 'personal_assignment' && selectedStudentNumber) {
              finalCategory = `personal_assignment-${selectedStudentNumber}`;
            }
            onSave(
              {
                ...question,
                type,
                title,
                options,
                answer,
                analysis,
                sort_order: question?.sort_order || 0,
                category: finalCategory,
                class_name: isNew ? selectedClass : question?.class_name,
                student_number: isNew ? selectedStudentNumber : question?.student_number,
                student_name: isNew ? selectedStudentName : question?.student_name,
              },
              isNew
            );
          }}
          disabled={!title || !answer || (isNew && category === 'class_assignment' && !selectedClass) || (isNew && category === 'personal_assignment' && !selectedStudentNumber)}
        >
          保存
        </Button>
      </div>
    </div>
  );
}
