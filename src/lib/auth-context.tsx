'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface User {
  id: string;
  email?: string;
  role: string;
  name: string;
  phone?: string;
  employee_id?: string;
  student_id?: string;
  class_name?: string; // 学生班级名称
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (type: 'teacher' | 'student', identifier: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: { name: string; employee_id: string; phone: string; password: string }) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  login: async () => ({ success: false }),
  register: async () => ({ success: false }),
  logout: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 检查本地存储中的登录状态
  useEffect(() => {
    const initAuth = () => {
      try {
        const storedUser = localStorage.getItem('edu_user');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
      } catch (err) {
        console.error('Auth init error:', err);
        localStorage.removeItem('edu_user');
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = useCallback(async (type: 'teacher' | 'student', identifier: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, identifier, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || '登录失败' };
      }

      setUser(data.user);
      localStorage.setItem('edu_user', JSON.stringify(data.user));
      if (data.session) {
        localStorage.setItem('edu_session', JSON.stringify(data.session));
      }

      return { success: true };
    } catch {
      return { success: false, error: '网络错误，请重试' };
    }
  }, []);

  const register = useCallback(async (regData: { name: string; employee_id: string; phone: string; password: string }) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(regData),
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || '注册失败' };
      }

      return { success: true };
    } catch {
      return { success: false, error: '网络错误，请重试' };
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('edu_user');
    localStorage.removeItem('edu_session');
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      register,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
