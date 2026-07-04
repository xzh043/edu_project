import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import { SupabaseConfigProvider } from '@/lib/supabase-config-inject';
import { ClientProviders } from '@/components/client-providers';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: '智慧教学系统',
    template: '%s | 智慧教学系统',
  },
  description: '智慧教学系统 - 教师与学生的教学管理平台',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.COZE_PROJECT_ENV === 'DEV';

  return (
    <html lang="zh-CN">
      <body className="antialiased">
        <SupabaseConfigProvider>
          <ClientProviders>
            {isDev && <Inspector />}
            {children}
          </ClientProviders>
        </SupabaseConfigProvider>
      </body>
    </html>
  );
}
