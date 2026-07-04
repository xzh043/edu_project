'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function StudentDashboardPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/student/dashboard/learning-assistant');
  }, [router]);

  return null;
}
