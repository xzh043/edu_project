'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Scan, CameraOff, Loader2, Image } from 'lucide-react';

const QRCodePattern = /\/student\/dashboard\/tasks\/([^/]+)/;

interface QRCodeDecoder {
  decode: (imageData: ImageData) => string | null;
}

class SimpleQRCodeDecoder implements QRCodeDecoder {
  private readonly FORMAT_INFO_MASK = [
    0x5412, 0x5125, 0x5E7C, 0x5B4B, 0x45F9, 0x40CE, 0x4F97, 0x4AA0,
    0x77C4, 0x72F3, 0x7DAA, 0x789D, 0x662F, 0x6318, 0x6C41, 0x6976
  ];

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

      const findPattern = (): { x: number; y: number; size: number } | null => {
        for (let y = 0; y < height - 20; y += 2) {
          for (let x = 0; x < width - 20; x += 2) {
            const p = getPixel(x, y);
            if (p < 100) {
              let size = 1;
              while (size < 50 && getPixel(x + size, y) < 100) size++;
              if (size >= 7 && size <= 40) {
                const isPattern = this.checkPattern(x, y, size, getPixel);
                if (isPattern) {
                  return { x, y, size };
                }
              }
            }
          }
        }
        return null;
      };

      const pattern = findPattern();
      if (!pattern) return null;

      const moduleSize = pattern.size / 7;
      const startX = Math.floor(pattern.x + pattern.size + moduleSize * 4);
      const startY = Math.floor(pattern.y + pattern.size + moduleSize * 4);

      const bits: boolean[] = [];
      for (let y = 0; y < 25; y++) {
        const py = Math.floor(startY + y * moduleSize);
        for (let x = 0; x < 25; x++) {
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
      console.warn('QR decode error:', e);
    }
    return null;
  }

  private checkPattern(x: number, y: number, size: number, getPixel: (x: number, y: number) => number): boolean {
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        const px = x + dx;
        const py = y + dy;
        const b = getPixel(px, py);
        const inOuter = dx < 2 || dx >= size - 2 || dy < 2 || dy >= size - 2;
        const inInner = dx >= size - 3 && dy >= size - 3;
        
        if (inOuter && b > 150) return false;
        if (!inOuter && !inInner && b < 150) return false;
        if (inInner && b > 150) return false;
      }
    }
    return true;
  }

  private decodeBits(bits: boolean[]): string {
    let byteArray: number[] = [];
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
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanMethod, setScanMethod] = useState<'camera' | 'gallery'>('camera');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number>(0);
  const decoderRef = useRef<SimpleQRCodeDecoder | null>(null);

  const handleScanResult = useCallback((result: string) => {
    stopScanning();
    const match = result.match(QRCodePattern);
    if (match) {
      router.push(`/student/dashboard/tasks/${match[1]}`);
    } else {
      setError('无效的二维码内容');
    }
  }, [router]);

  const stopScanning = useCallback(() => {
    setIsScanning(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = 0;
    }
  }, []);

  const processImageData = useCallback((imageData: ImageData): boolean => {
    if (!decoderRef.current) {
      decoderRef.current = new SimpleQRCodeDecoder();
    }
    
    const result = decoderRef.current.decode(imageData);
    if (result) {
      handleScanResult(result);
      return true;
    }
    return false;
  }, [handleScanResult]);

  const startCameraScanning = useCallback(async () => {
    setError('');
    setLoading(true);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const detectLoop = () => {
        if (!isScanning || !videoRef.current || !canvasRef.current) return;
        
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) return;
        
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const found = processImageData(imageData);
        
        if (!found && isScanning) {
          animationFrameRef.current = requestAnimationFrame(detectLoop);
        }
      };

      setIsScanning(true);
      setLoading(false);
      detectLoop();
      
    } catch (err) {
      console.error('Failed to access camera:', err);
      setError('无法访问摄像头，请检查权限设置或使用相册扫码');
      setLoading(false);
    }
  }, [isScanning, processImageData]);

  const handleGallerySelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new (window as any).Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const maxSize = 640;
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
        const result = decoderRef.current?.decode(imageData);
        
        if (result) {
          handleScanResult(result);
        } else {
          setError('未能识别图片中的二维码');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, [handleScanResult]);

  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, [stopScanning]);

  return (
    <div className="flex h-screen flex-col bg-black">
      <header className="flex items-center justify-between border-b border-white/10 bg-black/50 px-4 py-3 backdrop-blur-sm">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-white/80 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="text-sm font-medium">返回</span>
        </button>
        <h1 className="text-base font-semibold text-white">扫码作答</h1>
        <div className="w-16" />
      </header>

      <main className="flex-1 relative overflow-hidden">
        {scanMethod === 'camera' && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
          />
        )}
        <canvas ref={canvasRef} className="hidden" />

        <div className="absolute inset-0 bg-black/30">
          <div className="mx-auto mt-16 w-64">
            <div className="relative">
              <div className="aspect-square rounded-xl border-4 border-[#1e3a5f]/80 bg-white/5">
                <div className="absolute left-0 top-0 h-8 w-8">
                  <div className="h-full w-full border-l-4 border-t-4 border-[#1e3a5f]" />
                  <div className="ml-1 mt-1 h-4 w-4 border-l-2 border-t-2 border-[#1e3a5f]" />
                </div>
                <div className="absolute right-0 top-0 h-8 w-8">
                  <div className="h-full w-full border-r-4 border-t-4 border-[#1e3a5f]" />
                  <div className="mr-1 mt-1 h-4 w-4 border-r-2 border-t-2 border-[#1e3a5f]" />
                </div>
                <div className="absolute bottom-0 left-0 h-8 w-8">
                  <div className="h-full w-full border-l-4 border-b-4 border-[#1e3a5f]" />
                  <div className="ml-1 mb-1 h-4 w-4 border-l-2 border-b-2 border-[#1e3a5f]" />
                </div>
                <div className="absolute bottom-0 right-0 h-8 w-8">
                  <div className="h-full w-full border-r-4 border-b-4 border-[#1e3a5f]" />
                  <div className="mr-1 mb-1 h-4 w-4 border-r-2 border-b-2 border-[#1e3a5f]" />
                </div>
              </div>
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2">
                <p className="text-center text-sm text-white/80">将作业二维码放入框内</p>
              </div>
            </div>
          </div>
        </div>

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-[#1e3a5f]" />
              <span className="text-sm text-white/80">正在启动摄像头...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="flex flex-col items-center gap-3">
              <CameraOff className="h-12 w-12 text-red-400" />
              <span className="text-sm text-white">{error}</span>
              <button
                onClick={startCameraScanning}
                className="mt-4 rounded-lg bg-[#1e3a5f] px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1e3a5f]/80"
              >
                重试
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-white/10 bg-black/50 px-4 py-4 backdrop-blur-sm">
        <div className="flex gap-3">
          <button
            onClick={() => {
              setScanMethod('camera');
              startCameraScanning();
            }}
            disabled={loading}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-medium transition-colors ${
              isScanning && scanMethod === 'camera'
                ? 'bg-red-500/20 text-red-400'
                : 'bg-[#1e3a5f] text-white hover:bg-[#1e3a5f]/90'
            }`}
          >
            <Scan className="h-5 w-5" />
            <span>{isScanning && scanMethod === 'camera' ? '停止扫码' : '摄像头扫码'}</span>
          </button>
          <button
            onClick={() => {
              setScanMethod('gallery');
              fileInputRef.current?.click();
            }}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 font-medium text-white transition-colors hover:bg-white/20"
          >
            <Image className="h-5 w-5" />
            <span>相册扫码</span>
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleGallerySelect}
        />
      </footer>
    </div>
  );
}