'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { GraduationCap, BookOpen } from 'lucide-react';

export default function HomePage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace(user?.role === 'student' ? '/student/dashboard' : '/dashboard');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--background)] px-4">
      {/* Logo 和标题 */}
      <div className="mb-10 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20">
          <span className="text-2xl font-bold text-primary-foreground">智</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          智慧教学系统
        </h1>
        <p className="mt-2 text-muted-foreground">
          选择您的身份进入系统
        </p>
      </div>

      {/* 角色选择卡片 */}
      <div className="flex w-full max-w-2xl flex-col gap-4 sm:flex-row sm:gap-6">
        {/* 教师入口 */}
        <Link
          href="/teacher/login"
          className="group flex-1 rounded-xl border bg-card p-6 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
        >
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
            <BookOpen className="h-6 w-6" />
          </div>
          <h2 className="mb-1 text-xl font-semibold text-card-foreground">教师入口</h2>
          <p className="text-sm text-muted-foreground">
            使用手机号和密码登录，管理课程与学生
          </p>
          <div className="mt-4 text-sm font-medium text-primary">
            手机号登录 →
          </div>
        </Link>

        {/* 学生入口 */}
        <Link
          href="/student/login"
          className="group flex-1 rounded-xl border bg-card p-6 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
        >
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
            <GraduationCap className="h-6 w-6" />
          </div>
          <h2 className="mb-1 text-xl font-semibold text-card-foreground">学生入口</h2>
          <p className="text-sm text-muted-foreground">
            使用学号和密码登录，查看课程与成绩
          </p>
          <div className="mt-4 text-sm font-medium text-primary">
            学号登录 →
          </div>
        </Link>
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        智慧教学系统 &copy; {new Date().getFullYear()}
      </p>
    </div>
  );
}
