'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Scan, CameraOff, Loader2, Image as ImageIcon, RefreshCw } from 'lucide-react';

const QRCodePattern = /\/student\/dashboard\/tasks\/([^/?#]+)/;

class SimpleQRCodeDecoder {
  decode(imageData: ImageData): string | null {
    try {
      const width = imageData.width;
      const height = imageData.height;
      const data = imageData.data;

      const getPixel = (x: number, y: number): number => {
        if (x < 0 || x >= width || y < 0 || y >= height) return 255;
        const idx = (y * width + x) * 4;
        return (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      };

      // 查找二维码的三个定位标记（左上、右上、左下）
      const findFinderPattern = (): { x: number; y: number; size: number } | null => {
        for (let y = 0; y < height - 20; y += 3) {
          for (let x = 0; x < width - 20; x += 3) {
            const p = getPixel(x, y);
            if (p < 100) {
              // 测量黑色区域宽度
              let size = 1;
              while (size < 60 && getPixel(x + size, y) < 100) size++;
              if (size >= 7 && size <= 50) {
                // 验证是否是定位标记（7:7:7:7 比例）
                if (this.checkFinderPattern(x, y, size, getPixel)) {
                  return { x, y, size };
                }
              }
            }
          }
        }
        return null;
      };

      const pattern = findFinderPattern();
      if (!pattern) return null;

      const moduleSize = pattern.size / 7;
      const startX = Math.floor(pattern.x + moduleSize * 4);
      const startY = Math.floor(pattern.y + moduleSize * 4);

      // 采样二维码数据区域
      const bits: boolean[] = [];
      const gridSize = 25;
      for (let y = 0; y < gridSize; y++) {
        const py = Math.floor(startY + y * moduleSize);
        for (let x = 0; x < gridSize; x++) {
          const px = Math.floor(startX + x * moduleSize);
          const brightness = getPixel(px, py);
          bits.push(brightness < 128);
        }
      }

      const text = this.decodeBits(bits);
      if (text && QRCodePattern.test(text)) {
        return text;
      }
    } catch (e) {
      // ignore
    }
    return null;
  }

  private checkFinderPattern(x: number, y: number, size: number, getPixel: (x: number, y: number) => number): boolean {
    // 定位标记：黑-白-黑-白-黑 = 1:1:3:1:1 比例
    const unit = size / 7;
    const checks = [
      { dx: 0, dy: 0, expect: true },
      { dx: unit, dy: 0, expect: false },
      { dx: 2 * unit, dy: 0, expect: true },
      { dx: 3 * unit, dy: 0, expect: true },
      { dx: 4 * unit, dy: 0, expect: true },
      { dx: 5 * unit, dy: 0, expect: false },
      { dx: 6 * unit, dy: 0, expect: true },
      { dx: 0, dy: unit, expect: false },
      { dx: 6 * unit, dy: unit, expect: false },
      { dx: 0, dy: 6 * unit, expect: true },
      { dx: 6 * unit, dy: 6 * unit, expect: true },
      { dx: 3 * unit, dy: 3 * unit, expect: true },
    ];
    for (const c of checks) {
      const px = Math.floor(x + c.dx);
      const py = Math.floor(y + c.dy);
      const isDark = getPixel(px, py) < 128;
      if (isDark !== c.expect) return false;
    }
    return true;
  }

  private decodeBits(bits: boolean[]): string {
    const byteArray: number[] = [];
    let currentByte = 0;
    let bitCount = 0;

    for (let i = 0; i < bits.length; i++) {
      if (this.isDataBit(i)) {
        currentByte = (currentByte << 1) | (bits[i] ? 1 : 0);
        bitCount++;
        if (bitCount === 8) {
          byteArray.push(currentByte);
          currentByte = 0;
          bitCount = 0;
        }
      }
    }

    try {
      const decoder = new TextDecoder('UTF-8');
      return decoder.decode(new Uint8Array(byteArray));
    } catch {
      return '';
    }
  }

  private isDataBit(index: number): boolean {
    const x = index % 25;
    const y = Math.floor(index / 25);
    if (x < 9 && y < 9) return false;
    if (x < 9 && y > 15) return false;
    if (x > 15 && y < 9) return false;
    if (x === 6 || y === 6) return false;
    return true;
  }
}

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
  // 用 ref 跟踪扫描状态，避免闭包陷阱
  const scanningRef = useRef(false);
  const decoderRef = useRef<SimpleQRCodeDecoder | null>(null);
  const mountedRef = useRef(true);

  const handleResult = useCallback((result: string) => {
    const match = result.match(QRCodePattern);
    if (match) {
      stopCamera();
      router.push(`/student/dashboard/tasks/${match[1]}`);
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

      // 解码循环 - 使用 ref 判断状态，避免闭包陷阱
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
          if (!decoderRef.current) {
            decoderRef.current = new SimpleQRCodeDecoder();
          }
          const result = decoderRef.current.decode(imageData);
          if (result) {
            handleResult(result);
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
    // 延迟一帧确保 video 元素已渲染
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

        const maxSize = 800;
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
        if (!decoderRef.current) {
          decoderRef.current = new SimpleQRCodeDecoder();
        }
        const result = decoderRef.current.decode(imageData);
        
        setLoading(false);
        if (result) {
          handleResult(result);
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
    // 重置 input 以便重复选择同一文件
    e.target.value = '';
  }, [handleResult, stopCamera]);

  return (
    <div className="flex h-screen flex-col bg-black">
      <header className="flex items-center justify-between border-b border-white/10 bg-black/50 px-4 py-3 backdrop-blur-sm">
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

      <main className="flex-1 relative overflow-hidden">
        {/* video 始终渲染，避免 ref 丢失 */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`h-full w-full object-cover ${scanning ? 'opacity-100' : 'opacity-0'}`}
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* 扫描框引导 */}
        {scanning && (
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-black/40" />
            <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2">
              <div className="relative h-full w-full rounded-2xl bg-transparent overflow-hidden">
                <div className="absolute left-0 top-0 h-10 w-10 border-l-4 border-t-4 border-white rounded-tl-lg" />
                <div className="absolute right-0 top-0 h-10 w-10 border-r-4 border-t-4 border-white rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 h-10 w-10 border-l-4 border-b-4 border-white rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 h-10 w-10 border-r-4 border-b-4 border-white rounded-br-lg" />
                <div className="absolute left-0 top-1/2 h-0.5 w-full bg-white/60 animate-pulse" />
              </div>
            </div>
            <p className="absolute bottom-20 left-1/2 -translate-x-1/2 text-center text-sm text-white/80">
              将作业二维码放入框内即可自动识别
            </p>
          </div>
        )}

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
              <span className="text-sm text-white/80">正在启动摄像头...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6">
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
      </main>

      <footer className="border-t border-white/10 bg-black/50 px-4 py-4 backdrop-blur-sm">
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
    </div>
  );
}