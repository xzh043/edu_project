'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GraduationCap, Eye, EyeOff, ArrowLeft } from 'lucide-react';

export default function StudentLoginPage() {
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const router = useRouter();

  // 如果已登录，跳转到首页
  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/student/dashboard');
    }
  }, [isAuthenticated, router]);

  if (isAuthenticated) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!studentId.trim()) {
      setError('请输入学号');
      return;
    }

    if (!password) {
      setError('请输入密码');
      return;
    }

    setLoading(true);
    try {
      const result = await login('student', studentId.trim(), password);
      if (result.success) {
        router.replace('/student/dashboard');
      } else {
        setError(result.error || '登录失败');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* 左侧装饰区 - PC端显示 */}
      <div className="hidden flex-1 items-center justify-center bg-primary lg:flex">
        <div className="max-w-md px-8 text-center">
          <GraduationCap className="mx-auto mb-6 h-16 w-16 text-primary-foreground/80" />
          <h2 className="mb-3 text-3xl font-bold text-primary-foreground">
            欢迎回来
          </h2>
          <p className="text-primary-foreground/70 leading-relaxed">
            登录智慧教学系统，查看课程作业、完成测评、与AI学习助手互动
          </p>
        </div>
      </div>

      {/* 右侧登录表单 */}
      <div className="flex flex-1 items-center justify-center bg-white px-4 py-8">
        <div className="w-full max-w-sm">
          {/* 返回首页 */}
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            返回首页
          </Link>

          {/* 标题区 */}
          <div className="mb-8">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 lg:hidden">
              <GraduationCap className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">学生登录</h1>
            <p className="mt-1 text-sm text-gray-500">
              使用学号和密码登录
            </p>
          </div>

          {/* 登录表单 */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="studentId">学号</Label>
              <Input
                id="studentId"
                type="text"
                placeholder="请输入学号"
                value={studentId}
                onChange={(e) => {
                  setStudentId(e.target.value);
                  setError('');
                }}
                autoComplete="username"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  autoComplete="current-password"
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button
              type="submit"
              className="h-11 w-full"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  登录中...
                </span>
              ) : (
                '登录'
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            如无账号，请联系教师注册
          </p>
        </div>
      </div>
    </div>
  );
}
