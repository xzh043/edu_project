'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { BookOpen, ClipboardList, UserCircle, LogOut } from 'lucide-react';

const tabs = [
  {
    label: '学习助手',
    href: '/student/dashboard/learning-assistant',
    icon: BookOpen,
  },
  {
    label: '任务中心',
    href: '/student/dashboard/tasks',
    icon: ClipboardList,
  },
  {
    label: '我的画像',
    href: '/student/dashboard/profile',
    icon: UserCircle,
  },
];

export default function StudentDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/student/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f9fc]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1e3a5f] border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const handleLogout = async () => {
    if (confirm('确定要退出登录吗？')) {
      await logout();
      router.replace('/student/login');
    }
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#f8f9fc]">
      {/* 顶部栏 */}
      <header className="shrink-0 z-40 flex items-center justify-between border-b border-border/50 bg-white/90 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1e3a5f]">
            <BookOpen className="h-4 w-4 text-white" />
          </div>
          <span className="text-base font-semibold text-[#1a1a2e]">智慧教学</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{user?.name || '同学'}</span>
          <button
            onClick={handleLogout}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="退出登录"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>

      {/* 底部 Tab 导航 */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/50 bg-white/95 backdrop-blur-sm">
        <div className="flex items-center justify-around px-2 py-1">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/');
            const Icon = tab.icon;
            return (
              <button
                key={tab.href}
                onClick={() => router.push(tab.href)}
                className={`flex flex-col items-center gap-0.5 rounded-lg px-4 py-2 transition-colors ${
                  isActive
                    ? 'text-[#1e3a5f]'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className={`h-5 w-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
                <span className={`text-xs ${isActive ? 'font-semibold' : ''}`}>
                  {tab.label}
                </span>
                {isActive && (
                  <div className="mt-0.5 h-0.5 w-4 rounded-full bg-[#1e3a5f]" />
                )}
              </button>
            );
          })}
        </div>
        {/* iOS 安全区 */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>
    </div>
  );
}
