'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, XCircle, MinusCircle, Sparkles } from 'lucide-react';

interface QuestionWithAnswer {
  id: string;
  question_id: number;
  type: number;
  title: string;
  options: { key: string; text: string }[];
  answer: string;
  analysis: string;
  sort_order: number;
  student_answer: string | null;
  is_correct: boolean | null;
  score: number | null;
  category: string;
  class_name?: string;
  student_number?: string;
}

interface Submission {
  id: string;
  assignment_id: string;
  status: string;
  total_score: number;
  max_score: number;
  submitted_at: string;
  graded_at: string | null;
}

export default function ResultPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const submissionId = searchParams.get('submission_id');
  const assignmentId = params.assignmentId as string;

  const [questions, setQuestions] = useState<QuestionWithAnswer[]>([]);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);

  // AI suggestion states
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [aiSuggestionTime, setAiSuggestionTime] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Get user info from localStorage
  const getUserInfo = useCallback(() => {
    try {
      const userStr = localStorage.getItem('edu_user');
      if (userStr) return JSON.parse(userStr);
    } catch { /* ignore */ }
    return null;
  }, []);

  const fetchData = useCallback(async () => {
    if (!submissionId) return;
    try {
      // Use question-answers API which returns { submission, questions } with answer info embedded
      const res = await fetch(`/api/question-answers?submission_id=${submissionId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.submission) {
          setSubmission(data.submission);
        }
        if (data.questions) {
          setQuestions(data.questions);
        }
      }
    } catch (e) {
      console.error('获取结果失败:', e);
    } finally {
      setLoading(false);
    }
  }, [submissionId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch existing AI suggestion
  const fetchAiSuggestion = useCallback(async () => {
    const user = getUserInfo();
    if (!user?.student_id || !assignmentId) return;
    try {
      const res = await fetch(`/api/students/ai-suggestion?student_number=${user.student_id}&assignment_id=${assignmentId}`);
      if (res.ok) {
        const data = await res.json();
        const suggestions = data.suggestions || [];
        if (suggestions.length > 0) {
          setAiSuggestion(suggestions[0].content);
          setAiSuggestionTime(suggestions[0].created_at);
        }
      }
    } catch { /* ignore */ }
  }, [assignmentId, getUserInfo]);

  useEffect(() => {
    fetchAiSuggestion();
  }, [fetchAiSuggestion]);

  // Generate AI suggestion
  const handleGenerateAiSuggestion = async () => {
    const user = getUserInfo();
    if (!user?.id || !user?.student_id) return;
    setAiLoading(true);
    try {
      const res = await fetch('/api/students/ai-suggestion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: user.id,
          student_number: user.student_id,
          assignment_id: assignmentId,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.suggestion) {
          setAiSuggestion(data.suggestion.content);
          setAiSuggestionTime(data.suggestion.created_at);
        }
      } else {
        const data = await res.json();
        console.error('AI建议生成失败:', data.error);
      }
    } catch (e) {
      console.error('AI建议请求失败:', e);
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-120px)] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1e3a5f] border-t-transparent" />
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="flex min-h-[calc(100vh-120px)] flex-col items-center justify-center px-6">
        <p className="text-sm text-muted-foreground">未找到提交记录</p>
        <button onClick={() => router.back()} className="mt-4 text-sm text-[#1e3a5f]">返回</button>
      </div>
    );
  }

  const correctCount = questions.filter(q => q.is_correct === true).length;
  const wrongCount = questions.filter(q => q.is_correct === false).length;
  const unansweredCount = questions.filter(q => q.is_correct === null).length;

  return (
    <div className="min-h-[calc(100vh-120px)] overflow-auto">
      {/* 顶部 */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border/50 bg-white/95 px-4 py-3 backdrop-blur-sm">
        <button onClick={() => router.push('/student/dashboard/tasks')} className="flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" />
          返回
        </button>
        <span className="text-sm font-medium text-[#1a1a2e]">作答结果</span>
      </div>

      {/* 得分概览 */}
      <div className="mx-4 mt-4 rounded-2xl bg-gradient-to-br from-[#1e3a5f] to-[#2d5a8e] p-5 text-white">
        <div className="mb-3 text-sm opacity-80">得分</div>
        <div className="flex items-end gap-1">
          <span className="text-3xl font-bold">{submission.total_score}</span>
          <span className="mb-1 text-sm opacity-70">/ {submission.max_score}</span>
        </div>
        <div className="mt-4 flex gap-4">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-green-300" />
            <span className="text-xs">正确 {correctCount}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <XCircle className="h-4 w-4 text-red-300" />
            <span className="text-xs">错误 {wrongCount}</span>
          </div>
          {unansweredCount > 0 && (
            <div className="flex items-center gap-1.5">
              <MinusCircle className="h-4 w-4 text-gray-300" />
              <span className="text-xs">未答 {unansweredCount}</span>
            </div>
          )}
        </div>
      </div>

      {/* AI学习建议 */}
      {wrongCount > 0 && (
        <div className="mx-4 mt-3">
          {aiSuggestion ? (
            <div className="rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50 to-indigo-50 p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  <span className="text-sm font-semibold text-purple-700">AI学习建议</span>
                </div>
                <button
                  onClick={handleGenerateAiSuggestion}
                  disabled={aiLoading}
                  className="text-xs text-purple-500 hover:text-purple-700 disabled:opacity-50"
                >
                  {aiLoading ? '生成中...' : '重新生成'}
                </button>
              </div>
              <p className="whitespace-pre-line text-xs leading-relaxed text-purple-800">{aiSuggestion}</p>
              {aiSuggestionTime && (
                <p className="mt-2 text-[10px] text-purple-400">
                  生成于 {new Date(aiSuggestionTime).toLocaleString('zh-CN')}
                </p>
              )}
            </div>
          ) : (
            <button
              onClick={handleGenerateAiSuggestion}
              disabled={aiLoading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-purple-200 bg-purple-50/50 p-4 text-sm text-purple-600 transition hover:bg-purple-50 disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              {aiLoading ? '正在生成AI建议...' : '获取AI学习建议'}
            </button>
          )}
        </div>
      )}

      {/* 题目列表 */}
      <div className="space-y-3 px-4 py-4 pb-24">
        {questions.map((q, idx) => {
          const isCorrect = q.is_correct === true;
          const isWrong = q.is_correct === false;
          const isUnanswered = q.is_correct === null;

          return (
            <div key={q.id} className={`rounded-xl border-2 p-4 ${
              isCorrect ? 'border-green-200 bg-green-50/50'
                : isWrong ? 'border-red-200 bg-red-50/50'
                : 'border-gray-200 bg-gray-50/50'
            }`}>
              {/* 题目头部 */}
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                    q.type === 2 ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {q.type === 2 ? '判断题' : '选择题'}
                  </span>
                  <span className="text-sm font-medium text-muted-foreground">第 {q.question_id} 题</span>
                  {/* 作业类型标签 */}
                  {(() => {
                    if (q.class_name && q.class_name !== '') {
                      return (
                        <span className="rounded-md px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">
                          班级共性作业
                        </span>
                      );
                    }
                    if (q.student_number && q.student_number !== '') {
                      return (
                        <span className="rounded-md px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700">
                          个性化作业
                        </span>
                      );
                    }
                    return null;
                  })()}
                </div>
                {isCorrect && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                {isWrong && <XCircle className="h-5 w-5 text-red-500" />}
                {isUnanswered && <MinusCircle className="h-5 w-5 text-gray-400" />}
              </div>

              {/* 题目内容 */}
              <p className="mb-3 text-sm leading-relaxed text-[#1a1a2e]">{q.title}</p>

              {/* 选项 */}
              <div className="space-y-2">
                {q.options?.map((opt) => {
                  const isStudentAnswer = q.student_answer === opt.key;
                  const isCorrectAnswer = q.answer === opt.key;
                  return (
                    <div
                      key={opt.key}
                      className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm ${
                        isCorrectAnswer
                          ? 'border-green-300 bg-green-50'
                          : isStudentAnswer && !isCorrectAnswer
                            ? 'border-red-300 bg-red-50'
                            : 'border-transparent'
                      }`}
                    >
                      <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs ${
                        isCorrectAnswer
                          ? 'bg-green-500 text-white'
                          : isStudentAnswer && !isCorrectAnswer
                            ? 'bg-red-500 text-white'
                            : 'bg-muted text-muted-foreground'
                      }`}>
                        {opt.key}
                      </span>
                      <span className={isCorrectAnswer ? 'font-medium text-green-700' : isStudentAnswer && !isCorrectAnswer ? 'text-red-700' : ''}>
                        {opt.text}
                      </span>
                      {isCorrectAnswer && <span className="ml-auto text-xs text-green-600">正确答案</span>}
                      {isStudentAnswer && !isCorrectAnswer && <span className="ml-auto text-xs text-red-500">你的答案</span>}
                    </div>
                  );
                })}
              </div>

              {/* 解析 */}
              {q.analysis && (
                <div className="mt-3 rounded-lg bg-blue-50 p-3">
                  <p className="text-xs font-medium text-blue-700">解析</p>
                  <p className="mt-1 text-xs leading-relaxed text-blue-600">{q.analysis}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
