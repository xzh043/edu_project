import { NextRequest, NextResponse } from 'next/server';

const COZE_API_URL = 'https://api.coze.cn/v3/chat';
const BOT_ID = '7657072060547989538';
const PAT_TOKEN = 'pat_x0aBiUYPnd5Jk1LtA7KmVOolzy8T3tXnT0rXp8EdiN2eOKe6rwEQoOBrBiFcITv9';

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: '请提供有效的问题' }, { status: 400 });
    }

    // 使用流式 API
    const response = await fetch(COZE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${PAT_TOKEN}`,
      },
      body: JSON.stringify({
        bot_id: BOT_ID,
        user_id: 'edusys-student',
        stream: true,
        auto_save_history: true,
        additional_messages: [
          {
            role: 'user',
            content: query,
            content_type: 'text',
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Coze API error:', response.status, errorText);
      return NextResponse.json(
        { error: `Coze API 请求失败: ${response.status}` },
        { status: response.status }
      );
    }

    // 转发流式响应
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              break;
            }

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data:')) {
                const data = line.slice(5).trim();
                if (data === '"[DONE]"' || data === '[DONE]') continue;

                try {
                  const parsed = JSON.parse(data);
                  // v3 流式事件类型
                  if (parsed.type === 'conversation.message.delta' && parsed.content) {
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({ type: 'answer', content: parsed.content })}\n\n`
                      )
                    );
                  } else if (parsed.type === 'conversation.message.completed') {
                    const msg = parsed.data || parsed;
                    if (msg.role === 'assistant' && msg.type === 'answer' && msg.content) {
                      controller.enqueue(
                        encoder.encode(
                          `data: ${JSON.stringify({ type: 'answer', content: msg.content })}\n\n`
                        )
                      );
                    }
                  }
                } catch {
                  // ignore parse errors
                }
              }
            }
          }
        } catch (err) {
          console.error('Stream error:', err);
        } finally {
          controller.close();
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    console.error('Chat API error:', err);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
