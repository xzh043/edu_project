'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Trophy, BarChart3, BookOpen, CheckCircle2, XCircle,
  Target, Award, TrendingUp, ChevronDown, User, Flame
} from 'lucide-react';

interface BasicInfo {
  name: string;
  student_number: string;
  class_name: string;
}

interface Analysis {
  completion_rate: number;
  accuracy_rate: number;
  class_rank: number;
  total_classmates: number;
  submitted_assignments: number;
  total_assignments: number;
}

interface ScoreTrendItem {
  assignment_name: string;
  rate: number;
}

interface HotQuestion {
  knowledge_point: string;
  count: number;
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
  chapters: string[];
  knowledge_points: string[];
}

interface ProfileData {
  basic_info: BasicInfo;
  stats: {
    rank: number;
    total_students: number;
    total_submissions: number;
    avg_score: number;
    highest_score: number;
    total_score: number;
    total_max_score: number;
  };
  recent_performance: RecentItem[];
  wrong_answers: WrongAnswer[];
}

export default function ProfilePage() {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'wrong'>('overview');
  const [chapterFilter, setChapterFilter] = useState<string>('');
  const [knowledgeFilter, setKnowledgeFilter] = useState<string>('');
  
  // 新增：学生分析数据
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [scoreTrend, setScoreTrend] = useState<ScoreTrendItem[]>([]);
  const [hotQuestions, setHotQuestions] = useState<HotQuestion[]>([]);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('edu_user') || 'null') : null;

  const fetchData = useCallback(async () => {
    const u = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('edu_user') || 'null') : null;
    if (!u?.student_id && !u?.id) return;
    
    setLoading(true);
    setAnalysisLoading(true);
    
    try {
      // 1. 获取基本画像数据
      const params = new URLSearchParams();
      if (u.student_id) params.set('student_number', u.student_id);
      else params.set('student_id', u.id);

      const res = await fetch(`/api/student/profile?${params}`);
      if (res.ok) {
        const d = await res.json();
        setData(d);
      }

      // 2. 获取学生分析数据（使用教师端API）
      // 首先需要获取 students 表的 id 和班级信息
      const studentNumber = u.student_id || '';
      if (studentNumber) {
        const studentRes = await fetch(`/api/students?keyword=${studentNumber}`);
        if (studentRes.ok) {
          const studentsData = await studentRes.json();
          if (studentsData && studentsData.length > 0) {
            const studentId = studentsData[0].id;
            const className = studentsData[0].classes?.name || '';
            
            // 获取学生分析数据、热点提问、AI建议
            // 注意：ai_suggestions 表使用 student_number 字段存储，所以传递学号而不是 studentId
            const [analysisRes, hotRes, suggestionRes] = await Promise.all([
              fetch(`/api/students/analysis?student_id=${studentId}`),
              fetch(`/api/students/hot-questions?id_number=${studentNumber}&class=${encodeURIComponent(className)}&chapter=&type=`),
              fetch(`/api/students/ai-suggestion?student_number=${studentNumber}`), // 使用学号而不是 studentId
            ]);
            
            if (analysisRes.ok) {
              const analysisData = await analysisRes.json();
              setAnalysis(analysisData.analysis);
              setScoreTrend(analysisData.score_trend || []);
            }
            
            if (hotRes.ok) {
              const hotData = await hotRes.json();
              console.log('Hot questions data:', hotData);
              setHotQuestions(hotData.hot_questions || []);
            }
            
            if (suggestionRes.ok) {
              const suggestionData = await suggestionRes.json();
              console.log('AI suggestion data:', suggestionData);
              // suggestions 是数组，取第一个
              if (suggestionData.suggestions && suggestionData.suggestions.length > 0) {
                setAiSuggestion(suggestionData.suggestions[0].content || null);
              } else {
                setAiSuggestion(null);
              }
            }
          }
        }
      }
    } catch (e) {
      console.error('获取画像失败:', e);
    } finally {
      setLoading(false);
      setAnalysisLoading(false);
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

  // 获取所有章节和知识点列表（用于筛选）
  const allChapters = Array.from(new Set(wrongs.filter(w => w.chapters && w.chapters.length > 0).flatMap(w => w.chapters))).sort();
  const allKnowledgePoints = Array.from(new Set(wrongs.filter(w => w.knowledge_points && w.knowledge_points.length > 0).flatMap(w => w.knowledge_points))).sort();

  // 根据筛选条件过滤错题
  const filteredWrongs = wrongs.filter(w => {
    if (chapterFilter && (!w.chapters || !w.chapters.includes(chapterFilter))) return false;
    if (knowledgeFilter && (!w.knowledge_points || !w.knowledge_points.includes(knowledgeFilter))) return false;
    return true;
  });

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
              <span className="text-2xl font-bold">{analysis?.class_rank || stats.rank}</span>
            </div>
            <span className="text-[11px] opacity-60">/ {analysis?.total_classmates || stats.total_students}人</span>
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
          个人画像
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
          {/* 四指标 - 使用教师端样式 */}
          <div className="mt-4">
            {analysisLoading ? (
              <div className="flex items-center justify-center text-sm text-gray-400 bg-white rounded-2xl border border-gray-100 p-6">加载中...</div>
            ) : analysis ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-blue-50 p-4 shadow-sm">
                  <div className="text-2xl font-extrabold text-blue-600">{analysis.completion_rate}<span className="text-sm font-normal">%</span></div>
                  <div className="mt-1 text-xs text-blue-400">作业完成率</div>
                  <div className="mt-2 h-1.5 rounded-full bg-blue-100">
                    <div className="h-full rounded-full bg-blue-500" style={{width: `${Math.min(analysis.completion_rate, 100)}%`}} />
                  </div>
                </div>
                <div className="rounded-xl bg-emerald-50 p-4 shadow-sm">
                  <div className="text-2xl font-extrabold text-emerald-600">{analysis.accuracy_rate}<span className="text-sm font-normal">%</span></div>
                  <div className="mt-1 text-xs text-emerald-400">测评正确率</div>
                  <div className="mt-2 h-1.5 rounded-full bg-emerald-100">
                    <div className="h-full rounded-full bg-emerald-500" style={{width: `${Math.min(analysis.accuracy_rate, 100)}%`}} />
                  </div>
                </div>
                <div className="rounded-xl bg-amber-50 p-4 shadow-sm">
                  <div className="text-2xl font-extrabold text-amber-600">{analysis.class_rank}<span className="text-sm font-normal">/{analysis.total_classmates}</span></div>
                  <div className="mt-1 text-xs text-amber-400">班级排名</div>
                </div>
                <div className="rounded-xl bg-purple-50 p-4 shadow-sm">
                  <div className="text-2xl font-extrabold text-purple-600">{analysis.submitted_assignments}<span className="text-sm font-normal">/{analysis.total_assignments}</span></div>
                  <div className="mt-1 text-xs text-purple-400">已提交作业</div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center text-sm text-gray-400 bg-white rounded-2xl border border-gray-100 p-6">暂无学情数据</div>
            )}
          </div>

          {/* 成绩趋势 + 热点提问 */}
          <div className="mt-4 grid grid-cols-2 gap-4">
            {/* 成绩趋势 */}
            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="mb-3 text-sm font-semibold text-gray-700">历次成绩趋势</div>
              {analysisLoading ? (
                <div className="py-6 text-center text-xs text-gray-400">加载中...</div>
              ) : scoreTrend.length > 0 ? (
                <div className="flex items-end gap-1.5" style={{ height: 100 }}>
                  {scoreTrend.map((item, idx) => {
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
            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="mb-3 text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                <Flame className="h-4 w-4 text-orange-500" />
                热点提问
              </div>
              {analysisLoading ? (
                <div className="py-4 text-center text-xs text-gray-400">加载中...</div>
              ) : hotQuestions.length > 0 ? (
                <div className="space-y-2">
                  {hotQuestions.slice(0, 5).map((q, idx) => {
                    const maxCount = Math.max(...hotQuestions.map(x => x.count));
                    const pct = maxCount > 0 ? (q.count / maxCount) * 100 : 0;
                    return (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-orange-100 text-[10px] font-bold text-orange-600">{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-gray-700 truncate">{q.knowledge_point}</div>
                          <div className="mt-0.5 h-1 rounded-full bg-orange-100">
                            <div className="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-500" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                        <span className="text-[10px] text-gray-400 flex-shrink-0">{q.count}次</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-4 text-center text-xs text-gray-400">暂无热点提问</div>
              )}
            </div>
          </div>

          {/* AI 学习建议 */}
          <div className="mt-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="mb-3 text-sm font-semibold text-gray-700 flex items-center gap-1.5">
              <svg className="h-4 w-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.95-.083-1.896-.548-2.903a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.95-.083-1.896-.548-2.903z" /></svg>
              AI学习建议
            </div>
            {analysisLoading ? (
              <div className="py-4 text-center text-xs text-gray-400">加载中...</div>
            ) : aiSuggestion ? (
              <div className="text-xs text-gray-700 leading-relaxed">{aiSuggestion}</div>
            ) : (
              <div className="py-4 text-center text-xs text-gray-400">暂无AI建议</div>
            )}
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
          {/* 筛选器 */}
          <div className="mt-4 flex items-center gap-2">
            <div className="relative">
              <select
                value={chapterFilter}
                onChange={(e) => setChapterFilter(e.target.value)}
                className="appearance-none h-8 px-3 pr-8 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-blue-300"
              >
                <option value="">全部章节</option>
                {allChapters.map(ch => (
                  <option key={ch} value={ch}>{ch}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>

            <div className="relative">
              <select
                value={knowledgeFilter}
                onChange={(e) => setKnowledgeFilter(e.target.value)}
                className="appearance-none h-8 px-3 pr-8 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-blue-300 max-w-[150px]"
              >
                <option value="">全部知识点</option>
                {allKnowledgePoints.map(kp => (
                  <option key={kp} value={kp}>{kp}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>

            <span className="text-xs text-muted-foreground">
              共 {filteredWrongs.length} 题错题
            </span>
          </div>

          {filteredWrongs.length === 0 ? (
            <div className="mt-8 flex flex-col items-center justify-center py-16">
              <CheckCircle2 className="mb-3 h-14 w-14 text-green-300" />
              <p className="text-sm text-muted-foreground">
                {chapterFilter || knowledgeFilter ? '暂无该筛选条件的错题' : '暂无错题，继续保持！'}
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {filteredWrongs.map((w, idx) => (
                <div key={`${w.question_id}-${idx}`} className="rounded-2xl border border-red-100 bg-white p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
                      w.type === 2 ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {w.type === 2 ? '判断题' : '选择题'}
                    </span>
                    {w.chapters && w.chapters.length > 0 && (
                      <span className="rounded-md px-1.5 py-0.5 text-[11px] font-medium bg-gray-100 text-gray-700">
                        {w.chapters[0]}
                      </span>
                    )}
                    {w.knowledge_points && w.knowledge_points.length > 0 && (
                      <span className="rounded-md px-1.5 py-0.5 text-[11px] font-medium bg-green-50 text-green-700">
                        {w.knowledge_points[0]}
                      </span>
                    )}
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