'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Scan, CameraOff, Loader2, Image as ImageIcon, RefreshCw } from 'lucide-react';
import jsQR from 'jsqr';

const QRCodePattern = /\/student\/dashboard\/tasks\/([^/?#]+)/;

export default function ScanPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const scanningRef = useRef(false);
  const mountedRef = useRef(true);

  const handleResult = useCallback((result: string) => {
    const match = result.match(QRCodePattern);
    if (match) {
      stopCamera();
      router.push(`/student/dashboard/tasks/${match[1]}`);
    } else {
      // 不是作业二维码，继续扫描
      console.log('扫描到非作业二维码:', result);
    }
  }, [router]);

  const stopCamera = useCallback(() => {
    scanningRef.current = false;
    setScanning(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setError('');

    // 先停止已有的流
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    // 检查浏览器兼容性
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('当前浏览器不支持摄像头调用，请使用相册扫码或更换浏览器（Chrome/Safari）');
      return;
    }

    setLoading(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      if (!mountedRef.current) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      video.srcObject = stream;

      // 等待 video 元素准备好
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('视频加载超时')), 10000);
        video.onloadedmetadata = () => {
          clearTimeout(timeout);
          resolve();
        };
        video.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('视频加载失败'));
        };
      });

      await video.play();

      scanningRef.current = true;
      setScanning(true);
      setLoading(false);

      // 解码循环 - 使用 jsQR 库进行识别
      const detectLoop = () => {
        if (!scanningRef.current) return;
        if (!mountedRef.current) return;

        const v = videoRef.current;
        const canvas = canvasRef.current;
        if (!v || !canvas || v.readyState < 2) {
          rafRef.current = requestAnimationFrame(detectLoop);
          return;
        }

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          rafRef.current = requestAnimationFrame(detectLoop);
          return;
        }

        const w = v.videoWidth || 640;
        const h = v.videoHeight || 480;
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(v, 0, 0, w, h);

        try {
          const imageData = ctx.getImageData(0, 0, w, h);
          // 使用 jsQR 解码，支持各种版本的二维码
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });
          if (code && code.data) {
            handleResult(code.data);
            return;
          }
        } catch {
          // ignore decode errors
        }

        rafRef.current = requestAnimationFrame(detectLoop);
      };

      detectLoop();
    } catch (err: unknown) {
      console.error('Camera error:', err);
      const e = err as { name?: string; message?: string };
      let msg = '无法访问摄像头';
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        msg = '摄像头权限被拒绝，请在浏览器设置中允许摄像头权限后重试';
      } else if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
        msg = '未检测到摄像头设备';
      } else if (e.name === 'NotReadableError' || e.name === 'TrackStartError') {
        msg = '摄像头被其他程序占用，请关闭后重试';
      } else if (e.name === 'OverconstrainedError') {
        msg = '摄像头不支持当前分辨率要求';
      } else if (e.message) {
        msg = `摄像头错误：${e.message}`;
      }
      setError(msg);
      setLoading(false);
      setScanning(false);
      scanningRef.current = false;
    }
  }, [handleResult]);

  // 页面加载后自动启动摄像头
  useEffect(() => {
    mountedRef.current = true;
    const timer = setTimeout(() => {
      startCamera();
    }, 100);

    return () => {
      mountedRef.current = false;
      clearTimeout(timer);
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  const handleGallerySelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    stopCamera();
    setError('');
    setLoading(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new (window as unknown as { Image: new () => HTMLImageElement }).Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setLoading(false);
          return;
        }

        // 适当缩放图片以提高解码速度
        const maxSize = 1000;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        const imageData = ctx.getImageData(0, 0, width, height);
        // 使用 jsQR 解码
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth',
        });

        setLoading(false);
        if (code && code.data) {
          handleResult(code.data);
        } else {
          setError('未能识别图片中的二维码，请确保图片清晰完整');
        }
      };
      img.onerror = () => {
        setLoading(false);
        setError('图片加载失败');
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      setLoading(false);
      setError('文件读取失败');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [handleResult, stopCamera]);

  return (
    <div className="fixed inset-0 flex flex-col bg-black">
      {/* 顶部导航栏 */}
      <header className="flex items-center justify-between border-b border-white/10 bg-black/50 px-4 py-3 backdrop-blur-sm z-20">
        <button
          onClick={() => {
            stopCamera();
            router.back();
          }}
          className="flex items-center gap-2 text-white/80 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="text-sm font-medium">返回</span>
        </button>
        <h1 className="text-base font-semibold text-white">扫码作答</h1>
        <div className="w-16" />
      </header>

      {/* 摄像头预览区域 */}
      <div className="relative flex-1 overflow-hidden bg-black">
        {/* video 始终渲染，绝对定位铺满容器 */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* 扫描框引导遮罩 */}
        {scanning && (
          <div className="pointer-events-none absolute inset-0 z-10">
            {/* 半透明遮罩，中间镂空 */}
            <div className="absolute inset-0 bg-black/50" />
            {/* 镂空区域 - 居中 */}
            <div className="absolute left-1/2 top-1/2 h-60 w-60 -translate-x-1/2 -translate-y-1/2">
              {/* 用白色边框做出镂空效果 */}
              <div className="absolute inset-0 rounded-xl border-[3px] border-white/90 shadow-[0_0_0_1000px_rgba(0,0,0,0.5)]" />
              {/* 四个角 */}
              <div className="absolute -left-1 -top-1 h-8 w-8 border-l-4 border-t-4 border-[#3b82f6] rounded-tl-lg" />
              <div className="absolute -right-1 -top-1 h-8 w-8 border-r-4 border-t-4 border-[#3b82f6] rounded-tr-lg" />
              <div className="absolute -bottom-1 -left-1 h-8 w-8 border-l-4 border-b-4 border-[#3b82f6] rounded-bl-lg" />
              <div className="absolute -bottom-1 -right-1 h-8 w-8 border-r-4 border-b-4 border-[#3b82f6] rounded-br-lg" />
              {/* 扫描线动画 */}
              <div className="absolute left-2 right-2 top-1/2 h-0.5 bg-gradient-to-r from-transparent via-[#3b82f6] to-transparent shadow-[0_0_8px_#3b82f6] animate-[scan_2s_ease-in-out_infinite]" />
            </div>
            {/* 提示文字 */}
            <p className="absolute bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-center text-sm text-white/90">
              将作业二维码对准框内即可自动识别
            </p>
          </div>
        )}

        {/* 加载中 */}
        {loading && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
              <span className="text-sm text-white/80">正在启动摄像头...</span>
            </div>
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 p-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <CameraOff className="h-14 w-14 text-red-400" />
              <span className="text-sm text-white max-w-xs">{error}</span>
              <div className="flex gap-3">
                <button
                  onClick={startCamera}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500"
                >
                  <RefreshCw className="h-4 w-4" />
                  重试
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 rounded-lg bg-white/10 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/20"
                >
                  <ImageIcon className="h-4 w-4" />
                  相册扫码
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 底部操作栏 */}
      <footer className="relative z-20 border-t border-white/10 bg-black/80 px-4 py-4 backdrop-blur-sm">
        <div className="flex gap-3">
          <button
            onClick={scanning ? stopCamera : startCamera}
            disabled={loading}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-medium transition-colors ${
              scanning
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : 'bg-blue-600 text-white hover:bg-blue-500'
            }`}
          >
            <Scan className="h-5 w-5" />
            <span>{scanning ? '停止扫码' : '开启摄像头'}</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 font-medium text-white transition-colors hover:bg-white/20"
          >
            <ImageIcon className="h-5 w-5" />
            <span>相册扫码</span>
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleGallerySelect}
        />
      </footer>

      {/* 扫描线动画 keyframes */}
      <style jsx>{`
        @keyframes scan {
          0%, 100% { transform: translateY(-80px); }
          50% { transform: translateY(80px); }
        }
      `}</style>
    </div>
  );
}