'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import {
  Users,
  ClipboardList,
  BarChart3,
  Settings,
  LogOut,
  GraduationCap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

const menus = [
  { key: 'students', label: '学生管理', icon: Users, path: '/dashboard/students' },
  { key: 'assessments', label: '测评作业', icon: ClipboardList, path: '/dashboard/assessments' },
  { key: 'analytics', label: '数据分析', icon: BarChart3, path: '/dashboard/analytics' },
  { key: 'settings', label: '设置', icon: Settings, path: '/dashboard/settings' },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!user) {
      router.replace('/');
    }
  }, [user, router]);

  if (!user) return null;

  const handleLogout = () => {
    logout();
    router.replace('/');
  };

  return (
    <div className="flex h-screen bg-[#F5F7FA]">
      {/* 侧边栏 */}
      <aside className="flex w-60 flex-col bg-[#1e3a5f]">
        {/* Logo 区域 */}
        <div className="flex h-16 items-center gap-2.5 px-6 border-b border-white/10">
          <GraduationCap className="size-6 text-white" />
          <span className="text-lg font-bold text-white">智慧教学</span>
        </div>

        {/* 菜单列表 */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {menus.map((menu) => {
            const Icon = menu.icon;
            const isActive = pathname === menu.path || pathname?.startsWith(menu.path + '/');
            return (
              <button
                key={menu.key}
                onClick={() => router.push(menu.path)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-white/15 text-white shadow-md'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                )}
              >
                <Icon className="size-4.5" />
                {menu.label}
              </button>
            );
          })}
        </nav>

        {/* 用户信息 + 退出 */}
        <div className="border-t border-white/10 px-4 py-3">
          <div className="mb-2 text-xs text-white/60">
            {user.role === 'teacher' ? '教师' : '学生'}：{user.name}
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-white/60 hover:text-red-300 hover:bg-white/10"
              >
                <LogOut className="size-4" />
                退出登录
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认退出</AlertDialogTitle>
                <AlertDialogDescription>
                  确定要退出登录吗？
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={handleLogout}>
                  确认退出
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
