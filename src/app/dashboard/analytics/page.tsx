'use client';

import { useEffect, useState } from 'react';
import {
  BarChart3, TrendingUp, Users, BookOpen, PieChart as PieChartIcon,
  ChevronDown, Award, Loader2, AlertCircle,
} from 'lucide-react';
import { AssignmentDetailDialog } from '@/components/assignment-detail-dialog';

interface SummaryData {
  chapters: string[];
  classes: string[];
  chapter_accuracy: { chapter: string; accuracy_rate: number; correct: number; total: number }[];
  assignment_stats: {
    id: string; name: string; type: string; chapters: string[];
    total_students: number; completed_count: number; completion_rate: number; avg_score_rate: number;
  }[];
  student_rankings: {
    student_id: string; student_number: string; name: string; class_name: string;
    total_score: number; max_score: number; score_rate: number; submission_count: number;
  }[];
}

interface DistributionData {
  chapter: string;
  distribution: { knowledge_point: string; count: number }[];
  error?: string;
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

const PIE_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
];

export default function AnalyticsPage() {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'combined' | 'ranking'>('combined');

  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [distribution, setDistribution] = useState<DistributionData | null>(null);
  const [distLoading, setDistLoading] = useState(false);

  const [showDetail, setShowDetail] = useState(false);
  const [detailAssignment, setDetailAssignment] = useState<Assignment | null>(null);

  useEffect(() => {
    fetch('/api/analysis/summary')
      .then(res => res.json())
      .then(d => {
        setData(d);
        setSelectedChapter('');
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedChapter === null) return;
    setDistLoading(true);
    setDistribution(null);
    const params = new URLSearchParams();
    if (selectedChapter) params.set('chapter', selectedChapter);
    if (selectedClass) params.set('class', selectedClass);
    const qs = params.toString();
    fetch(`/api/analysis/chapter-distribution${qs ? '?' + qs : ''}`)
      .then(res => res.json())
      .then(d => setDistribution(d))
      .catch(console.error)
      .finally(() => setDistLoading(false));
  }, [selectedChapter, selectedClass]);

  const handleAssignmentClick = async (assignmentId: string) => {
    try {
      const res = await fetch(`/api/assignments?id=${assignmentId}`);
      const assignments = await res.json();
      if (Array.isArray(assignments) && assignments.length > 0) {
        setDetailAssignment(assignments[0]);
        setShowDetail(true);
      }
    } catch (err) {
      console.error('获取作业详情失败:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!data) return null;

  const tabs = [
    { key: 'combined' as const, label: '班级整体与作业完成', icon: BarChart3 },
    { key: 'ranking' as const, label: '学生排名', icon: Users },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-blue-50 flex items-center justify-center">
            <BarChart3 className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">数据分析</h1>
            <p className="text-xs text-gray-500">班级学情分析与数据统计</p>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'combined' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center">
                      <PieChartIcon className="h-4 w-4 text-amber-600" />
                    </div>
                    <h3 className="font-semibold text-gray-900">知识点提问分布</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <select
                        value={selectedClass}
                        onChange={e => setSelectedClass(e.target.value)}
                        className="appearance-none bg-gray-50 border border-gray-200 rounded-lg pl-3 pr-8 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">全部班级</option>
                        {data.classes?.map((cls: string) => (
                          <option key={cls} value={cls}>{cls}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    </div>
                    <div className="relative">
                      <select
                        value={selectedChapter ?? ''}
                        onChange={e => setSelectedChapter(e.target.value)}
                        className="appearance-none bg-gray-50 border border-gray-200 rounded-lg pl-3 pr-8 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">全部章节</option>
                        {data.chapters.map(ch => (
                          <option key={ch} value={ch}>{ch}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {distLoading ? (
                  <div className="flex items-center justify-center h-48">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                  </div>
                ) : distribution && distribution.distribution.length > 0 ? (
                  <div className="flex items-center gap-6">
                    <div className="flex-shrink-0">
                      <PieChart data={distribution.distribution} />
                    </div>
                    <div className="flex-1 space-y-2 max-h-52 overflow-auto">
                      {distribution.distribution.map((d, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <span
                            className="h-3 w-3 rounded-sm flex-shrink-0"
                            style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                          />
                          <span className="text-gray-700 flex-1 truncate">{d.knowledge_point}</span>
                          <span className="text-gray-500 font-medium">{d.count}次</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : distribution?.error ? (
                  <div className="flex flex-col items-center justify-center h-48 text-amber-500">
                    <AlertCircle className="h-10 w-10 mb-2 opacity-60" />
                    <p className="text-sm">{distribution.error}</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                    <PieChartIcon className="h-10 w-10 mb-2 opacity-40" />
                    <p className="text-sm">暂无数据</p>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-8 w-8 rounded-lg bg-green-50 flex items-center justify-center">
                    <BookOpen className="h-4 w-4 text-green-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">各章节正确率</h3>
                </div>

                {data.chapter_accuracy.length > 0 ? (
                  <div className="space-y-4">
                    {data.chapter_accuracy.map(ch => (
                      <div key={ch.chapter}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm text-gray-700 font-medium truncate max-w-[70%]">{ch.chapter}</span>
                          <span className={`text-sm font-bold ${
                            ch.accuracy_rate >= 60 ? 'text-green-600' : ch.accuracy_rate >= 40 ? 'text-amber-600' : 'text-red-600'
                          }`}>
                            {ch.accuracy_rate}%
                          </span>
                        </div>
                        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              ch.accuracy_rate >= 60 ? 'bg-gradient-to-r from-green-400 to-green-500' :
                              ch.accuracy_rate >= 40 ? 'bg-gradient-to-r from-amber-400 to-amber-500' :
                              'bg-gradient-to-r from-red-400 to-red-500'
                            }`}
                            style={{ width: `${ch.accuracy_rate}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">答对 {ch.correct}/{ch.total} 题</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                    <BookOpen className="h-10 w-10 mb-2 opacity-40" />
                    <p className="text-sm">暂无数据</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 p-6 pb-4">
                <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-900">作业完成情况</h3>
              </div>

              {data.assignment_stats.length > 0 ? (
                <div className="overflow-auto">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-white">
                      <tr className="border-t border-gray-100">
                        <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">作业名称</th>
                        <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">类型</th>
                        <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">所属章节</th>
                        <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">完成率</th>
                        <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">平均得分率</th>
                        <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">完成/总人数</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.assignment_stats.map(a => (
                        <tr 
                          key={a.id} 
                          className="border-t border-gray-50 hover:bg-gray-50/50 cursor-pointer"
                          onClick={() => handleAssignmentClick(a.id)}
                        >
                          <td className="px-6 py-3">
                            <span className="text-sm font-medium text-gray-900">{a.name}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              a.type === 'quiz' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                            }`}>
                              {a.type === 'quiz' ? '课堂测验' : '课后作业'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-gray-600">{a.chapters?.join('、') || '-'}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    a.completion_rate >= 80 ? 'bg-green-500' :
                                    a.completion_rate >= 50 ? 'bg-amber-500' : 'bg-red-500'
                                  }`}
                                  style={{ width: `${a.completion_rate}%` }}
                                />
                              </div>
                              <span className={`text-sm font-semibold ${
                                a.completion_rate >= 80 ? 'text-green-600' :
                                a.completion_rate >= 50 ? 'text-amber-600' : 'text-red-600'
                              }`}>
                                {a.completion_rate}%
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-sm font-semibold ${
                              a.avg_score_rate >= 60 ? 'text-green-600' :
                              a.avg_score_rate >= 40 ? 'text-amber-600' : 'text-red-600'
                            }`}>
                              {a.avg_score_rate}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-sm text-gray-600">{a.completed_count}/{a.total_students}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-gray-400 pb-6">
                  <TrendingUp className="h-10 w-10 mb-2 opacity-40" />
                  <p className="text-sm">暂无已发布作业</p>
                </div>
              )}
            </div>
          </div>
        )}
        {activeTab === 'ranking' && <StudentRankings data={data} />}
      </div>

      <AssignmentDetailDialog
        open={showDetail}
        onOpenChange={setShowDetail}
        assignment={detailAssignment}
      />
    </div>
  );
}

function PieChart({ data }: { data: { knowledge_point: string; count: number }[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) return null;

  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const r = 70;

  let currentAngle = -90;
  const slices = data.map((d, i) => {
    const angle = (d.count / total) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);

    const largeArcFlag = angle > 180 ? 1 : 0;

    return {
      d: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`,
      fill: PIE_COLORS[i % PIE_COLORS.length],
    };
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {slices.map((slice, i) => (
        <path key={i} d={slice.d} fill={slice.fill} />
      ))}
      <circle cx={cx} cy={cy} r={40} fill="white" />
      <text x={cx} y={cy - 4} textAnchor="middle" className="text-xs fill-gray-500">
        总计
      </text>
      <text x={cx} y={cy + 8} textAnchor="middle" className="text-lg font-bold fill-gray-800">
        {total}
      </text>
    </svg>
  );
}

function StudentRankings({ data }: { data: SummaryData }) {
  const rankings = data.student_rankings;
  const withSubmissions = rankings.filter(s => s.submission_count > 0);
  const withoutSubmissions = rankings.filter(s => s.submission_count === 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
      <div className="flex items-center gap-2 p-6 pb-4">
        <div className="h-8 w-8 rounded-lg bg-purple-50 flex items-center justify-center">
          <Award className="h-4 w-4 text-purple-600" />
        </div>
        <h3 className="font-semibold text-gray-900">学生排名</h3>
        <span className="text-xs text-gray-400 ml-1">按综合得分排序</span>
      </div>

      <div className="overflow-auto max-h-[600px]">
        <table className="w-full">
          <thead className="sticky top-0 bg-white z-10">
            <tr className="border-t border-gray-100">
              <th className="text-center text-xs font-medium text-gray-500 px-4 py-3 w-16">排名</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">姓名</th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">班级</th>
              <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">得分率</th>
              <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">得分</th>
              <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">提交次数</th>
            </tr>
          </thead>
          <tbody>
            {withSubmissions.map((s, i) => (
              <tr key={s.student_id} className="border-t border-gray-50 hover:bg-gray-50/50">
                <td className="px-4 py-3 text-center">
                  {i < 3 ? (
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                      i === 0 ? 'bg-amber-100 text-amber-600' :
                      i === 1 ? 'bg-gray-100 text-gray-600' :
                      'bg-orange-100 text-orange-600'
                    }`}>
                      {i + 1}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">{i + 1}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm font-medium text-gray-900">{s.name}</span>
                  <p className="text-xs text-gray-400">{s.student_number}</p>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-600">{s.class_name}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          s.score_rate >= 80 ? 'bg-green-500' :
                          s.score_rate >= 60 ? 'bg-blue-500' :
                          s.score_rate >= 40 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${s.score_rate}%` }}
                      />
                    </div>
                    <span className={`text-sm font-semibold ${
                      s.score_rate >= 80 ? 'text-green-600' :
                      s.score_rate >= 60 ? 'text-blue-600' :
                      s.score_rate >= 40 ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      {s.score_rate}%
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-sm font-medium text-gray-900">
                    {s.total_score}/{s.max_score}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-sm text-gray-600">{s.submission_count}</span>
                </td>
              </tr>
            ))}
            {withoutSubmissions.length > 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-3 border-t border-gray-100">
                  <span className="text-xs text-gray-400">未提交作业 ({withoutSubmissions.length}人)</span>
                </td>
              </tr>
            )}
            {withoutSubmissions.map(s => (
              <tr key={s.student_id} className="border-t border-gray-50 opacity-60">
                <td className="px-4 py-3 text-center">
                  <span className="text-sm text-gray-400">-</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-500">{s.name}</span>
                  <p className="text-xs text-gray-400">{s.student_number}</p>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-500">{s.class_name}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-sm text-gray-400">-</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-sm text-gray-400">-</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-sm text-gray-400">0</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}