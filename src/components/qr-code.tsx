'use client';

import { useMemo, useEffect, useState } from 'react';

interface QRCodeProps {
  value: string;
  size?: number;
  level?: 'L' | 'M' | 'Q' | 'H';
}

const QRCode = ({ value, size = 256, level = 'M' }: QRCodeProps) => {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    
    const generate = async () => {
      try {
        const QRCodeLib = require('../lib/qrcode-lib/lib/browser');
        const url = await QRCodeLib.toDataURL(value, {
          width: size,
          margin: 2,
          errorCorrectionLevel: level,
          color: {
            dark: '#000000',
            light: '#ffffff',
          },
        });
        if (mounted) {
          setDataUrl(url);
        }
      } catch (err) {
        console.error('QR code generation failed:', err);
      }
    };
    
    generate();
    
    return () => {
      mounted = false;
    };
  }, [value, size, level]);

  if (!dataUrl) {
    return (
      <div 
        className="rounded-lg bg-white flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <div className="animate-pulse text-gray-400 text-sm">生成中...</div>
      </div>
    );
  }

  return (
    <img
      src={dataUrl}
      alt="QR Code"
      style={{ width: size, height: size }}
      className="rounded-lg"
    />
  );
};

export { QRCode };