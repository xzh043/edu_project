'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react';

interface Question {
  id: string;
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

export default function AnswerPage() {
  const router = useRouter();
  const params = useParams();
  const assignmentId = params.assignmentId as string;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);

  const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('edu_user') || 'null') : null;

  const fetchQuestions = useCallback(async () => {
    try {
      // 1. 获取学生信息（班级和学号）
      let studentClassName = '';
      let studentNumber = '';
      
      if (user?.id) {
        const profileRes = await fetch(`/api/student/profile?student_id=${user.id}`);
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          studentClassName = profileData.basic_info?.class_name || '';
          studentNumber = profileData.basic_info?.student_number || '';
        }
      }

      // 2. 获取所有题目
      const res = await fetch(`/api/questions?assignment_id=${assignmentId}`);
      if (res.ok) {
        const data = await res.json();
        const allQuestions = data.sort((a: Question, b: Question) => a.sort_order - b.sort_order);
        
        // 3. 筛选该学生需要作答的题目
        const filteredQuestions = allQuestions.filter((q: Question) => {
          // 老师下发作业 - category 为空或为 'teacher_assignment' 或包含"下发作业"或"老师下发作业"
          if (!q.category || q.category === '' || q.category === 'teacher_assignment' || q.category.includes('下发作业') || q.category.includes('老师下发作业')) {
            return true;
          }
          
          // 班级共性作业 - category 为 'class_assignment' 或包含"班级共性作业" 且班级匹配
          if (q.category === 'class_assignment' || q.category.startsWith('class_assignment-') || q.category.includes('班级共性作业')) {
            const questionClassName = q.class_name || '';
            return questionClassName === studentClassName;
          }
          
          // 个性化作业 - category 为 'personal_assignment' 或包含"个性化作业" 且学号匹配
          if (q.category === 'personal_assignment' || q.category.startsWith('personal_assignment-') || q.category.includes('个性化作业')) {
            const questionStudentNumber = q.student_number || '';
            return questionStudentNumber === studentNumber;
          }
          
          // 其他情况不显示
          return false;
        });
        
        // 4. 重新编号题号（从1开始）
        const reorderedQuestions = filteredQuestions.map((q: Question, index: number) => ({
          ...q,
          question_id: index + 1,
        }));
        
        setQuestions(reorderedQuestions);
      }
    } catch (e) {
      console.error('获取题目失败:', e);
    } finally {
      setLoading(false);
    }
  }, [assignmentId, user?.id]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const handleAnswer = (questionId: string, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const answeredCount = Object.keys(answers).length;
  const totalCount = questions.length;
  const currentQuestion = questions[currentIndex];

  const handleSubmit = async () => {
    if (!user?.id) return;
    setSubmitting(true);
    try {
      // Create submission
      const subRes = await fetch('/api/assignment-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: assignmentId,
          student_id: user.id,
          student_number: user.student_id || user.email?.split('@')[0] || '',
          student_name: user.name || '',
          answers: Object.entries(answers).map(([questionId, studentAnswer]) => ({
            question_id: questionId,
            student_answer: studentAnswer,
          })),
        }),
      });

      if (subRes.ok) {
        const subData = await subRes.json();
        setSubmissionId(subData.id);
      }
    } catch (e) {
      console.error('提交失败:', e);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-120px)] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1e3a5f] border-t-transparent" />
      </div>
    );
  }

  // 提交成功页面
  if (submissionId) {
    return (
      <div className="flex min-h-[calc(100vh-120px)] flex-col items-center justify-center px-6">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="mb-2 text-lg font-bold text-[#1a1a2e]">提交成功！</h2>
        <p className="mb-6 text-sm text-muted-foreground">你的答案已成功提交</p>
        <div className="flex gap-3">
          <button
            onClick={() => router.push(`/student/dashboard/tasks/${assignmentId}/result?submission_id=${submissionId}`)}
            className="rounded-lg bg-[#1e3a5f] px-5 py-2 text-sm font-medium text-white"
          >
            查看结果
          </button>
          <button
            onClick={() => router.push('/student/dashboard/tasks')}
            className="rounded-lg border border-border px-5 py-2 text-sm font-medium text-foreground"
          >
            返回列表
          </button>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="flex min-h-[calc(100vh-120px)] flex-col items-center justify-center px-6">
        <AlertCircle className="mb-3 h-12 w-12 text-gray-300" />
        <p className="text-sm text-muted-foreground">暂无题目</p>
        <button onClick={() => router.back()} className="mt-4 text-sm text-[#1e3a5f]">返回</button>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-120px)] flex-col">
      {/* 顶部导航 */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/50 bg-white/95 px-4 py-3 backdrop-blur-sm">
        <button onClick={() => router.push('/student/dashboard/tasks')} className="flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" />
          返回
        </button>
        <span className="text-sm font-medium text-[#1a1a2e]">
          {currentIndex + 1} / {totalCount}
        </span>
        <span className="text-xs text-muted-foreground">
          已答 {answeredCount}/{totalCount}
        </span>
      </div>

      {/* 进度条 */}
      <div className="h-1 bg-muted">
        <div
          className="h-full bg-[#1e3a5f] transition-all duration-300"
          style={{ width: `${(answeredCount / totalCount) * 100}%` }}
        />
      </div>

      {/* 题目区域 */}
      <div className="flex-1 overflow-auto px-4 py-5">
        {currentQuestion && (
          <div>
            {/* 题目类型和题号 */}
            <div className="mb-3 flex items-center gap-2">
              <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                currentQuestion.type === 2
                  ? 'bg-orange-100 text-orange-700'
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {currentQuestion.type === 2 ? '判断题' : '选择题'}
              </span>
              <span className="text-sm font-medium text-muted-foreground">第 {currentQuestion.question_id} 题</span>
              {/* 显示作业类型 */}
              {currentQuestion.category && currentQuestion.category !== '' && (() => {
                if (currentQuestion.category.includes('老师下发作业') || currentQuestion.category === 'teacher_assignment') {
                  return null;
                }
                const isClass = currentQuestion.category.includes('班级共性作业') || currentQuestion.category.startsWith('class_assignment');
                return (
                  <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                    isClass ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'
                  }`}>
                    {isClass ? '班级共性作业' : '个性化作业'}
                  </span>
                );
              })()}
            </div>

            {/* 题目内容 */}
            <h3 className="mb-5 text-base leading-relaxed font-medium text-[#1a1a2e]">
              {currentQuestion.title}
            </h3>

            {/* 选项 */}
            <div className="space-y-3">
              {currentQuestion.options?.map((opt) => {
                const isSelected = answers[currentQuestion.id] === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => handleAnswer(currentQuestion.id, opt.key)}
                    className={`flex w-full items-center gap-3 rounded-xl border-2 p-4 text-left transition-all ${
                      isSelected
                        ? 'border-[#1e3a5f] bg-[#1e3a5f]/5'
                        : 'border-border/50 bg-white hover:border-[#1e3a5f]/30'
                    }`}
                  >
                    <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-sm font-medium ${
                      isSelected
                        ? 'bg-[#1e3a5f] text-white'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {opt.key}
                    </span>
                    <span className={`text-sm ${isSelected ? 'font-medium text-[#1a1a2e]' : 'text-foreground'}`}>
                      {opt.text}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 底部操作区 */}
      <div className="border-t border-border/50 bg-white px-4 py-3">
        {/* 题号导航 */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {questions.map((q, idx) => (
            <button
              key={q.id}
              onClick={() => setCurrentIndex(idx)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium transition-all ${
                idx === currentIndex
                  ? 'bg-[#1e3a5f] text-white'
                  : answers[q.id]
                    ? 'bg-[#1e3a5f]/10 text-[#1e3a5f]'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {idx + 1}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
            className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-muted-foreground disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" /> 上一题
          </button>

          {currentIndex === totalCount - 1 ? (
            <button
              onClick={() => setShowConfirm(true)}
              className="rounded-lg bg-[#1e3a5f] px-6 py-2 text-sm font-medium text-white"
            >
              提交答案
            </button>
          ) : (
            <button
              onClick={() => setCurrentIndex(Math.min(totalCount - 1, currentIndex + 1))}
              className="flex items-center gap-1 rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-medium text-white"
            >
              下一题 <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* 提交确认弹窗 */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6">
            <h3 className="mb-2 text-lg font-bold text-[#1a1a2e]">确认提交？</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              你已回答 {answeredCount}/{totalCount} 题
              {answeredCount < totalCount && (
                <span className="text-orange-500">（还有 {totalCount - answeredCount} 题未作答）</span>
              )}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-lg border border-border py-2 text-sm font-medium"
              >
                继续作答
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 rounded-lg bg-[#1e3a5f] py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {submitting ? '提交中...' : '确认提交'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
