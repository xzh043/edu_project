'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Trophy, BarChart3, BookOpen, CheckCircle2, XCircle,
  Target, Award, TrendingUp
} from 'lucide-react';

interface BasicInfo {
  name: string;
  student_number: string;
  class_name: string;
}

interface Stats {
  rank: number;
  total_students: number;
  total_submissions: number;
  avg_score: number;
  highest_score: number;
  total_score: number;
  total_max_score: number;
}

interface RecentItem {
  assignment_id: string;
  assignment_name: string;
  type: string;
  total_score: number;
  max_score: number;
  submitted_at: string | null;
  graded_at: string | null;
}

interface WrongAnswer {
  question_id: string;
  title: string;
  type: number;
  options: { key: string; text: string }[];
  student_answer: string;
  answer: string;
  analysis: string;
  assignment_name: string;
  assignment_type: string;
  submitted_at: string | null;
}

interface ProfileData {
  basic_info: BasicInfo;
  stats: Stats;
  recent_performance: RecentItem[];
  wrong_answers: WrongAnswer[];
}

export default function ProfilePage() {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'wrong'>('overview');

  const fetchData = useCallback(async () => {
    const u = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('edu_user') || 'null') : null;
    if (!u?.student_id && !u?.id) return;
    try {
      const params = new URLSearchParams();
      if (u.student_id) params.set('student_number', u.student_id);
      else params.set('student_id', u.id);

      const res = await fetch(`/api/student/profile?${params}`);
      if (res.ok) {
        const d = await res.json();
        setData(d);
      }
    } catch (e) {
      console.error('获取画像失败:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-120px)] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1e3a5f] border-t-transparent" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-[calc(100vh-120px)] flex-col items-center justify-center px-6">
        <XCircle className="mb-3 h-12 w-12 text-gray-300" />
        <p className="text-sm text-muted-foreground">暂无画像数据</p>
      </div>
    );
  }

  const { basic_info: info, stats, recent_performance: recent, wrong_answers: wrongs } = data;
  const scoreRate = stats.total_max_score > 0 ? (stats.total_score / stats.total_max_score) * 100 : 0;
  const surname = info.name?.charAt(0) || '?';

  return (
    <div className="px-4 pb-24">
      {/* 基本信息卡片 */}
      <div className="mt-4 rounded-2xl bg-gradient-to-br from-[#1e3a5f] to-[#2d5a8e] p-5 text-white">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white/20 text-2xl font-bold">
            {surname}
          </div>
          <div className="flex-1 flex flex-col">
            <span className="text-xl font-bold">{info.name}</span>
            <span className="mt-1 text-sm opacity-80">{info.class_name}</span>
            <span className="mt-0.5 text-sm opacity-60">{info.student_number}</span>
          </div>
          <div className="flex flex-col items-center shrink-0">
            <div className="flex items-baseline gap-1">
              <Trophy className="h-5 w-5 text-yellow-300" />
              <span className="text-2xl font-bold">{stats.rank}</span>
            </div>
            <span className="text-[11px] opacity-60">/ {stats.total_students}人</span>
          </div>
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="mt-4 flex gap-1 rounded-xl bg-muted p-1">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-all ${
            activeTab === 'overview'
              ? 'bg-white text-[#1e3a5f] shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <BarChart3 className="h-4 w-4" />
          总览
        </button>
        <button
          onClick={() => setActiveTab('wrong')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-all ${
            activeTab === 'wrong'
              ? 'bg-white text-[#1e3a5f] shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <XCircle className="h-4 w-4" />
          错题本
          {wrongs.length > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-100 px-1.5 text-xs text-red-600">
              {wrongs.length}
            </span>
          )}
        </button>
      </div>

      {/* 总览 Tab */}
      {activeTab === 'overview' && (
        <>
          {/* 统计卡片 */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                </div>
                <span className="text-xs text-gray-400">平均分</span>
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-[#1a1a2e]">{stats.avg_score}</span>
                <span className="text-xs text-gray-400">分</span>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50">
                  <Target className="h-5 w-5 text-emerald-600" />
                </div>
                <span className="text-xs text-gray-400">最高得分率</span>
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-[#1a1a2e]">{stats.highest_score}</span>
                <span className="text-xs text-gray-400">%</span>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50">
                  <BookOpen className="h-5 w-5 text-purple-600" />
                </div>
                <span className="text-xs text-gray-400">提交次数</span>
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-[#1a1a2e]">{stats.total_submissions}</span>
                <span className="text-xs text-gray-400">次</span>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50">
                  <Award className="h-5 w-5 text-amber-600" />
                </div>
                <span className="text-xs text-gray-400">累计得分</span>
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-[#1a1a2e]">{stats.total_score}</span>
                <span className="text-xs text-gray-400">/ {stats.total_max_score}</span>
              </div>
            </div>
          </div>

          {/* 综合得分率进度 */}
          <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-[#1a1a2e]">综合得分率</span>
              <span className="text-sm font-bold text-[#1e3a5f]">{scoreRate.toFixed(1)}%</span>
            </div>
            <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  scoreRate >= 60 ? 'bg-gradient-to-r from-[#1e3a5f] to-[#4a8fd4]' : 'bg-red-400'
                }`}
                style={{ width: `${Math.min(scoreRate, 100)}%` }}
              />
            </div>
          </div>

          {/* 近期表现 */}
          <div className="mt-4">
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-[#1e3a5f]" />
              <span className="text-sm font-semibold text-[#1a1a2e]">近期表现</span>
              <span className="text-[11px] text-gray-400">最近5次作业</span>
            </div>

            {recent.length === 0 ? (
              <div className="rounded-2xl bg-white py-8 text-center shadow-sm">
                <p className="text-sm text-muted-foreground">暂无作业记录</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recent.map((item, idx) => {
                  const rate = item.max_score > 0 ? (item.total_score / item.max_score) * 100 : 0;
                  const isPassed = rate >= 60;
                  return (
                    <div key={item.assignment_id + idx} className="rounded-2xl bg-white p-3.5 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0 pr-3">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                              item.type === 'homework' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {item.type === 'homework' ? '课后作业' : '课堂测验'}
                            </span>
                            <h4 className="truncate text-[13px] font-medium text-[#1a1a2e]">{item.assignment_name}</h4>
                          </div>
                        </div>
                        <div className="flex items-baseline gap-0.5 shrink-0">
                          <span className={`text-lg font-bold ${isPassed ? 'text-[#1e3a5f]' : 'text-red-500'}`}>
                            {item.total_score}
                          </span>
                          <span className="text-[11px] text-gray-400">/{item.max_score}</span>
                        </div>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                        <div
                          className={`h-full rounded-full ${
                            isPassed ? 'bg-gradient-to-r from-[#1e3a5f] to-[#4a8fd4]' : 'bg-red-400'
                          }`}
                          style={{ width: `${Math.min(rate, 100)}%` }}
                        />
                      </div>
                      {item.graded_at && (
                        <p className="mt-1.5 text-[10px] text-gray-400">
                          {new Date(item.graded_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* 错题本 Tab */}
      {activeTab === 'wrong' && (
        <>
          {wrongs.length === 0 ? (
            <div className="mt-8 flex flex-col items-center justify-center py-16">
              <CheckCircle2 className="mb-3 h-14 w-14 text-green-300" />
              <p className="text-sm text-muted-foreground">暂无错题，继续保持！</p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {wrongs.map((w, idx) => (
                <div key={`${w.question_id}-${idx}`} className="rounded-2xl border border-red-100 bg-white p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
                      w.type === 2 ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {w.type === 2 ? '判断题' : '选择题'}
                    </span>
                    <span className="text-[11px] text-gray-400">{w.assignment_name}</span>
                  </div>
                  <p className="mb-3 text-sm leading-relaxed text-[#1a1a2e]">{w.title}</p>

                  {/* 选项 */}
                  <div className="space-y-1.5">
                    {w.options?.map((opt) => {
                      const isStudentAnswer = w.student_answer === opt.key;
                      const isCorrectAnswer = w.answer === opt.key;
                      return (
                        <div
                          key={opt.key}
                          className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[13px] ${
                            isCorrectAnswer ? 'border-green-300 bg-green-50'
                              : isStudentAnswer ? 'border-red-300 bg-red-50'
                              : 'border-transparent bg-gray-50'
                          }`}
                        >
                          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ${
                            isCorrectAnswer ? 'bg-green-500 text-white'
                              : isStudentAnswer ? 'bg-red-500 text-white'
                              : 'bg-gray-200 text-gray-500'
                          }`}>
                            {opt.key}
                          </span>
                          <span className={isCorrectAnswer ? 'font-medium text-green-700' : isStudentAnswer ? 'text-red-700' : 'text-gray-600'}>
                            {opt.text}
                          </span>
                          {isCorrectAnswer && <span className="ml-auto text-[10px] text-green-600">正确答案</span>}
                          {isStudentAnswer && !isCorrectAnswer && <span className="ml-auto text-[10px] text-red-500">你的答案</span>}
                        </div>
                      );
                    })}
                  </div>

                  {w.analysis && (
                    <div className="mt-3 rounded-lg bg-blue-50 p-2.5">
                      <p className="text-[11px] font-medium text-blue-700">解析</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-blue-600">{w.analysis}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
