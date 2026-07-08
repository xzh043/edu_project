'use client';

import { useEffect, useRef } from 'react';
import { BookOpen } from 'lucide-react';

export default function LearningAssistantPage() {
  const chatBoxRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<any>(null);

  useEffect(() => {
    if (!chatBoxRef.current || clientRef.current) return;

    // 加载 CozeWebSDK
    const script = document.createElement('script');
    script.src = 'https://lf-cdn.coze.cn/obj/unpkg/flow-platform/chat-app-sdk/1.2.0-beta.19/libs/cn/index.js';
    script.async = true;
    script.onload = () => {
      if (typeof (window as any).CozeWebSDK === 'undefined') return;

      const CozeWebSDK = (window as any).CozeWebSDK;

      // 从 localStorage 获取学生信息
      let userInfo = undefined;
      let studentId = '';
      let studentName = '';
      let className = '';
      try {
        const userStr = localStorage.getItem('edu_user');
        if (userStr) {
          const user = JSON.parse(userStr);
          studentId = user.student_id || '';
          studentName = user.name || '';
          className = user.class_name || '';
          if (studentId && studentName) {
            userInfo = {
              id: studentId,
              url: 'https://lf-coze-web-cdn.coze.cn/obj/coze-web-cn/obric/coze/favicon.1970.png',
              nickname: studentName,
            };
          }
        }
      } catch {
        // ignore
      }

      const client = new CozeWebSDK.WebChatClient({
        config: {
          type: 'bot',
          bot_id: '7658589656686510099',
          botInfo: {
            parameters: {
              id_number: studentId,
              class: className
            }
          }
        },
        auth: {
          type: 'token',
          token: '', // 初始为空，onRefreshToken 会立即获取
          onRefreshToken: async () => {
            const response = await fetch('/api/chat/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ session_name: studentId || undefined }),
            });
            const data = await response.json();
            if (data.access_token) {
              return data.access_token;
            }
            throw new Error('Failed to get access token');
          },
        },
        userInfo,
        ui: {
          base: {
            layout: 'inline', // 必须是 inline 才能嵌入在 div 里
            zIndex: 1000,
            lang:'zh-CN'
          },
          header: {
            isShow: false,
            isNeedClose: false,
          },
          chatBot: {
            title: '学习助手',
            el: chatBoxRef.current,
            width: '100%',
            height: '100%',
            isNeedAddNewConversation: false
          },
          asstBtn: {
            isNeed: false, // 内嵌模式不需要悬浮球
          },
          footer: {
            isShow: false,
            expressionText: 'Powered by ...',
          },
          conversations: {
            isNeed: false  
          }
        },
        
      });

      clientRef.current = client;
      client.showChatBot();
    };

    document.head.appendChild(script);

    return () => {
      // 清理
      try {
        if (clientRef.current) {
          clientRef.current.hideChatBot?.();
          clientRef.current = null;
        }
      } catch {
        // ignore
      }
      // 移除 SDK 脚本
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  return (
    <div className="flex h-[calc(100vh-120px)] flex-col">
      {/* 聊天容器 - CozeWebSDK 会嵌入到这里 */}
      <div
        ref={chatBoxRef}
        className="flex-1 overflow-hidden [&>div]:!h-full [&>div]:!w-full [&_iframe]:!h-full [&_iframe]:!w-full"
        suppressHydrationWarning
      />
    </div>
  );
}
