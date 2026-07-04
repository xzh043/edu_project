'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  FileText,
  BookOpen,
  XCircle,
  User,
  Calendar,
  Clock,
  ListChecks,
  Users,
  BarChart3,
  Trophy,
  TrendingUp,
  CheckCircle2,
  Loader2,
  Sparkles,
  RefreshCw,
  ChevronDown,
} from 'lucide-react';

interface Question {
  id: string;
  type: number;
  title: string;
  options?: { key: string; text: string }[];
  answer: string;
  analysis?: string;
  chapter?: string;
  knowledge_point?: string;
  category?: string;
  class_name?: string;
  student_number?: string;
  student_name?: string;
  created_at?: string;
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
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  generating: { label: '生成中', color: 'amber' },
  generated: { label: '待发布', color: 'blue' },
  published: { label: '已发布', color: 'emerald' },
  archived: { label: '已归档', color: 'gray' },
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

interface AssignmentDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: Assignment | null;
}

export function AssignmentDetailDialog({
  open,
  onOpenChange,
  assignment,
}: AssignmentDetailDialogProps) {
  const [detailQuestions, setDetailQuestions] = useState<Question[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<'info' | 'questions' | 'wrong'>('info');
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

  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleTypeExpand = (type: string) => {
    const newSet = new Set(expandedTypes);
    if (newSet.has(type)) {
      newSet.delete(type);
    } else {
      newSet.add(type);
    }
    setExpandedTypes(newSet);
  };

  const toggleGroupExpand = (groupKey: string) => {
    const newSet = new Set(expandedGroups);
    if (newSet.has(groupKey)) {
      newSet.delete(groupKey);
    } else {
      newSet.add(groupKey);
    }
    setExpandedGroups(newSet);
  };

  const fetchData = useCallback(async () => {
    if (!assignment) return;
    
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
    
    if (assignment.status === 'published') {
      try {
        const res = await fetch(`/api/assignments/stats?assignment_id=${assignment.id}`);
        if (res.ok) {
          const data = await res.json();
          setDetailStats(data);
        }
      } catch {
        // ignore
      } finally {
        setDetailStatsLoading(false);
      }
    }
  }, [assignment]);

  useEffect(() => {
    if (open && assignment) {
      setDetailTab('info');
      setExpandedTypes(new Set());
      setExpandedGroups(new Set());
      fetchData();
    }
  }, [open, assignment, fetchData]);

  if (!assignment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[75vw] max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
        <div className="shrink-0 bg-gradient-to-r from-[#1e3a5f] to-[#2a5298] px-8 py-5">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-2xl font-bold text-white tracking-tight">{assignment.name}</DialogTitle>
              <p className="mt-1.5 text-sm text-blue-200 truncate">
                {(assignment.chapters || []).join('、') || '未设置章节'}
              </p>
            </div>
            <div className="flex items-center gap-2 ml-4 shrink-0">
              <Badge className="bg-white/20 text-white border-0 text-xs backdrop-blur">
                {assignment.type === 'quiz' ? '课堂测验' : '课后作业'}
              </Badge>
              {(() => {
                const s = STATUS_MAP[assignment.status] || STATUS_MAP.generating;
                return (
                  <Badge className={`${assignment.status === 'published' ? 'bg-emerald-400/20 text-emerald-200 border-0 text-xs' : 'bg-white/20 text-white border-0 text-xs'}`}>
                    {assignment.status === 'published' ? '已发布' : s.label}
                  </Badge>
                );
              })()}
            </div>
          </div>

          <div className="mt-3 flex items-center gap-5 text-xs text-blue-200/80">
            <span className="flex items-center gap-1"><User className="size-3" />{assignment.created_by}</span>
            <span className="flex items-center gap-1"><Calendar className="size-3" />{formatDate(assignment.created_at)}</span>
            {assignment.deadline && (
              <span className="flex items-center gap-1"><Clock className="size-3" />截止 {formatDate(assignment.deadline)}</span>
            )}
            <span className="flex items-center gap-1"><ListChecks className="size-3" />{assignment.xzt_cnt}选择 / {assignment.pdt_cnt}判断</span>
          </div>

          <div className="mt-4 flex gap-1.5">
            {[
              { key: 'info', label: '基本详情', icon: FileText },
              { key: 'questions', label: '作业题目', icon: BookOpen, count: detailQuestions.length },
              ...(assignment.status === 'published' ? [{ key: 'wrong', label: '错题排行', icon: XCircle, count: detailStats?.wrong_ranking?.length || 0 }] : []),
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

        <div className="flex-1 overflow-y-auto bg-[#F5F7FA] p-6">
          {detailTab === 'info' && (
            <>
              <div className="space-y-6">
                {assignment.status === 'published' ? (
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
                        const radius = 52;
                        const stroke = 8;
                        const circumference = 2 * Math.PI * radius;
                        const offset = circumference - (completionPct / 100) * circumference;

                        return (
                          <div key={cls.class_name} className="rounded-2xl bg-white shadow-[0_4px_12px_rgba(0,0,0,0.05)] overflow-hidden">
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
                                  {assignment.deadline && (
                                    <div className="mt-3 text-center">
                                      <span className="text-[10px] text-gray-400">截止日期</span>
                                      <p className="text-xs font-medium text-gray-600">{formatDate(assignment.deadline)}</p>
                                    </div>
                                  )}
                                </div>

                                <div className="flex-1 min-w-0 space-y-5">
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
                  <div className="rounded-2xl bg-white shadow-[0_4px_12px_rgba(0,0,0,0.05)] p-6">
                    <div className="grid grid-cols-2 gap-5">
                      <div>
                        <span className="text-xs text-gray-400 uppercase tracking-wider">所属章节</span>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {(assignment.chapters || []).map((ch, i) => (
                            <Badge key={i} variant="outline" className="text-xs border-gray-200">{ch}</Badge>
                          ))}
                          {(!assignment.chapters || assignment.chapters.length === 0) && <span className="text-sm text-gray-300">-</span>}
                        </div>
                      </div>
                      <div>
                        <span className="text-xs text-gray-400 uppercase tracking-wider">所属知识点</span>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {(assignment.knowledge_points || []).map((kp, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">{kp}</Badge>
                          ))}
                          {(!assignment.knowledge_points || assignment.knowledge_points.length === 0) && <span className="text-sm text-gray-300">-</span>}
                        </div>
                      </div>
                      <div>
                        <span className="text-xs text-gray-400 uppercase tracking-wider">题目要求</span>
                        <p className="mt-2 text-sm font-medium text-gray-700">选择题 {assignment.xzt_cnt} 题 / 判断题 {assignment.pdt_cnt} 题</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-400 uppercase tracking-wider">截止时间</span>
                        <p className="mt-2 text-sm font-medium text-gray-700">{assignment.deadline ? formatDate(assignment.deadline) : '-'}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {assignment.status === 'published' && (
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
                        setAssignmentAiLoading(true);
                        try {
                          const res = await fetch('/api/assignments/ai-suggestion', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ assignment_id: assignment.id }),
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

          {detailTab === 'questions' && (
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
                    {assignment.status === 'generating' ? '题目正在生成中...' : '暂无题目'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
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
                                  {q.options?.map((opt) => (
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

                  {(() => {
                    const classQuestions = detailQuestions.filter(q => q.category && (q.category === 'class_assignment' || q.category.startsWith('class_assignment-') || q.category.includes('班级共性作业')));
                    if (classQuestions.length === 0) return null;
                    const typeKey = 'class';
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
                                            {q.options?.map((opt) => (
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

                  {(() => {
                    const personalQuestions = detailQuestions.filter(q => q.category && (q.category === 'personal_assignment' || q.category.startsWith('personal_assignment-') || q.category.includes('个性化作业')));
                    if (personalQuestions.length === 0) return null;
                    const typeKey = 'personal';
                    const isExpanded = expandedTypes.has(typeKey);
                    const personalMap = new Map<string, { name: string; questions: Question[] }>();
                    personalQuestions.forEach(q => {
                      let studentId = q.student_number;
                      if (!studentId && q.category?.includes('-')) studentId = q.category.split('-')[1];
                      studentId = studentId || '全部学生';
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
                                            {q.options?.map((opt) => (
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

          {detailTab === 'wrong' && assignment.status === 'published' && (
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
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${
                        idx === 0 ? 'bg-red-100 text-red-600 ring-2 ring-red-200' :
                        idx === 1 ? 'bg-amber-100 text-amber-600 ring-2 ring-amber-200' :
                        idx === 2 ? 'bg-orange-100 text-orange-600 ring-2 ring-orange-200' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={w.type === 1 ? 'bg-purple-100 text-purple-700 text-[10px] border-0' : 'bg-orange-100 text-orange-700 text-[10px] border-0'}>
                            {w.type === 1 ? '选择题' : '判断题'}
                          </Badge>
                          <span className="text-xs text-red-500 font-medium">
                            错误率: {w.error_rate}% ({w.error_count}/{w.total_count})
                          </span>
                        </div>
                        <p className="text-sm text-gray-800">{w.title}</p>
                        <p className="mt-2 text-xs text-gray-500">
                          <span className="font-medium">正确答案：</span>{w.answer}
                        </p>
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
  );
}