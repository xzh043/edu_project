'use client';

import { AuthProvider } from '@/lib/auth-context';
import { ReactNode } from 'react';

export function ClientProviders({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
