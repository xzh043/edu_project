'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, CheckCircle2, Clock, ChevronRight, BookOpen, Scan, ChevronDown } from 'lucide-react';

interface StudentAssignment {
  assignment_id: string;
  name: string;
  type: string;
  chapters: string[];
  knowledge_points: string[];
  xzt_cnt: number;
  pdt_cnt: number;
  deadline: string | null;
  publish_time: string | null;
  created_by: string;
  created_at: string;
  requirements: string | null; // 作业要求
  submission_id: string | null;
  submission_status: string | null;
  total_score: number | null;
  max_score: number | null;
  submitted_at: string | null;
  graded_at: string | null;
}

export default function TasksPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');
  const [pendingList, setPendingList] = useState<StudentAssignment[]>([]);
  const [completedList, setCompletedList] = useState<StudentAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>(''); // 类型筛选

  const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('edu_user') || 'null') : null;

  const fetchPending = useCallback(async () => {
    const u = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('edu_user') || 'null') : null;
    if (!u?.student_id && !u?.id) return;
    try {
      const params = new URLSearchParams();
      if (u.student_id) params.set('student_number', u.student_id);
      else params.set('student_id', u.id);
      const res = await fetch(`/api/student/assignments?${params}`);
      if (res.ok) {
        const data = await res.json();
        // API returns all published assignments; filter pending (no submission) and completed (has submission)
        setPendingList(data.filter((a: StudentAssignment) => !a.submission_status));
        setCompletedList(data.filter((a: StudentAssignment) => !!a.submission_status));
      }
    } catch (e) {
      console.error('获取待完成作业失败:', e);
    }
  }, []);

  const fetchCompleted = useCallback(async () => {
    // Already handled in fetchPending
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchPending(), fetchCompleted()]);
      setLoading(false);
    };
    load();
  }, [fetchPending, fetchCompleted]);

  const getAssignmentType = (type: string) => {
    return type === 'homework' ? '课后作业' : '课堂测验';
  };

  const getTypeBadgeColor = (type: string) => {
    return type === 'homework' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700';
  };

  const formatDeadline = (deadline: string | null) => {
    if (!deadline) return '无截止时间';
    const d = new Date(deadline);
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    if (diff < 0) return '已截止';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟后截止`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时后截止`;
    return `${d.getMonth() + 1}月${d.getDate()}日截止`;
  };

  const isOverdue = (deadline: string | null) => {
    if (!deadline) return false;
    return new Date(deadline).getTime() < Date.now();
  };

  // 根据筛选条件过滤列表
  const filteredPendingList = typeFilter
    ? pendingList.filter(a => a.type === typeFilter)
    : pendingList;

  const filteredCompletedList = typeFilter
    ? completedList.filter(a => a.type === typeFilter)
    : completedList;

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-120px)] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1e3a5f] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="px-4 py-4 pb-24">

      {/* Tab 切换和筛选 */}
      <div className="mb-4 space-y-3">
        {/* 第一行：Tab切换 + 扫码按钮 */}
        <div className="flex items-center justify-between">
          <div className="flex-1 flex gap-1 rounded-xl bg-muted p-1">
            <button
              onClick={() => setActiveTab('pending')}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-all ${
                activeTab === 'pending'
                  ? 'bg-white text-[#1e3a5f] shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Clock className="h-4 w-4" />
              待完成
              {filteredPendingList.length > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#1e3a5f] px-1.5 text-xs text-white">
                  {filteredPendingList.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-all ${
                activeTab === 'completed'
                  ? 'bg-white text-[#1e3a5f] shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <CheckCircle2 className="h-4 w-4" />
              已完成
              {filteredCompletedList.length > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-green-100 px-1.5 text-xs text-green-700">
                  {filteredCompletedList.length}
                </span>
              )}
            </button>
          </div>
          <button
            onClick={() => router.push('/student/dashboard/tasks/scan')}
            className="ml-3 flex items-center gap-1.5 rounded-xl bg-[#1e3a5f] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1e3a5f]/90"
          >
            <Scan className="h-4 w-4" />
            扫码
          </button>
        </div>

        {/* 第二行：类型筛选 */}
        <div className="flex items-center justify-between">
          <div className="relative">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="appearance-none h-8 px-3 pr-8 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-blue-300"
            >
              <option value="">全部类型</option>
              <option value="quiz">课堂测验</option>
              <option value="homework">课后作业</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
          <span className="text-xs text-muted-foreground">
            共 {activeTab === 'pending' ? filteredPendingList.length : filteredCompletedList.length} 个作业
          </span>
        </div>
      </div>

      {/* 待完成列表 */}
      {activeTab === 'pending' && (
        <div className="space-y-3">
          {filteredPendingList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CheckCircle2 className="mb-3 h-12 w-12 text-green-300" />
              <p className="text-sm text-muted-foreground">
                {typeFilter ? '暂无该类型的待完成作业' : '暂无待完成作业'}
              </p>
            </div>
          ) : (
            filteredPendingList.map((assignment) => (
              <div
                key={assignment.assignment_id}
                className="rounded-xl border border-border/50 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="mb-2 flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ${getTypeBadgeColor(assignment.type)}`}>
                        {getAssignmentType(assignment.type)}
                      </span>
                      <h3 className="text-sm font-semibold text-[#1a1a2e] line-clamp-1">{assignment.name}</h3>
                    </div>
                    {assignment.chapters && assignment.chapters.length > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                        <BookOpen className="mr-1 inline h-3 w-3" />
                        {assignment.chapters.join('、')}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mb-2 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{assignment.xzt_cnt}道选择题</span>
                  <span className="text-border">|</span>
                  <span>{assignment.pdt_cnt}道判断题</span>
                  <span className="text-border">|</span>
                  <span className={isOverdue(assignment.deadline) ? 'text-red-500 font-medium' : ''}>
                    {formatDeadline(assignment.deadline)}
                  </span>
                </div>

                {assignment.requirements && (
                  <div className="mb-2 text-xs text-gray-500">
                    <span className="font-medium text-gray-600">作业要求：</span>
                    {assignment.requirements}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    发布于 {new Date(assignment.publish_time || assignment.created_at).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => router.push(`/student/dashboard/tasks/${assignment.assignment_id}`)}
                    className="flex items-center gap-1 rounded-lg bg-[#1e3a5f] px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#1e3a5f]/90"
                  >
                    开始作答
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 已完成列表 */}
      {activeTab === 'completed' && (
        <div className="space-y-3">
          {filteredCompletedList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="mb-3 h-12 w-12 text-gray-300" />
              <p className="text-sm text-muted-foreground">
                {typeFilter ? '暂无该类型的已完成作业' : '暂无已完成作业'}
              </p>
            </div>
          ) : (
            filteredCompletedList.map((a) => {
              const scoreRatio = (a.total_score || 0) / (a.max_score || 1);
              const isPassed = scoreRatio >= 0.6;
              return (
                <div
                  key={a.assignment_id}
                  className="rounded-2xl bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                >
                  {/* 上部：作业名称 + 分数 */}
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ${getTypeBadgeColor(a.type)}`}>
                          {getAssignmentType(a.type)}
                        </span>
                        <h3 className="text-[15px] font-semibold text-[#1a1a2e] line-clamp-1">{a.name}</h3>
                      </div>
                      {a.requirements && (
                        <div className="mt-1 text-xs text-gray-500 line-clamp-1">
                          <span className="font-medium text-gray-600">作业要求：</span>
                          {a.requirements}
                        </div>
                      )}
                    </div>
                    {a.submission_status === 'graded' && (
                      <div className="flex flex-col items-center shrink-0">
                        <div className="flex items-baseline gap-0.5">
                          <span className={`text-2xl font-bold ${isPassed ? 'text-[#1e3a5f]' : 'text-red-500'}`}>
                            {a.total_score}
                          </span>
                          <span className="text-xs text-muted-foreground">/ {a.max_score}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 中部：进度条 + 状态 */}
                  {a.submission_status === 'graded' && (
                    <div className="mt-3">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isPassed ? 'bg-gradient-to-r from-[#1e3a5f] to-[#4a8fd4]' : 'bg-red-400'
                          }`}
                          style={{ width: `${Math.min(scoreRatio * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* 下部：状态 + 时间 + 按钮 */}
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        a.submission_status === 'graded'
                          ? 'bg-emerald-50 text-emerald-600'
                          : 'bg-amber-50 text-amber-600'
                      }`}>
                        {a.submission_status === 'graded' ? (
                          <><CheckCircle2 className="h-3 w-3" />已批改</>
                        ) : (
                          <><Clock className="h-3 w-3" />待批改</>
                        )}
                      </span>
                      {a.submitted_at && (
                        <span className="text-[11px] text-gray-400">
                          {new Date(a.submitted_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => router.push(`/student/dashboard/tasks/${a.assignment_id}/result?submission_id=${a.submission_id}`)}
                      className="inline-flex items-center gap-0.5 rounded-lg bg-[#1e3a5f] px-3.5 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-[#1e3a5f]/90 active:scale-[0.97]"
                    >
                      查看详情
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
