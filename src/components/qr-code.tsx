'use client';

import { useMemo } from 'react';

interface QRCodeProps {
  value: string;
  size?: number;
  level?: 'L' | 'M' | 'Q' | 'H';
}

const QRCode = ({ value, size = 256, level = 'M' }: QRCodeProps) => {
  const canvasUrl = useMemo(() => {
    const qr = qrCodeEncode(value, level);
    const cellSize = Math.floor(size / qr.size);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    
    ctx.fillStyle = '#000000';
    for (let y = 0; y < qr.size; y++) {
      for (let x = 0; x < qr.size; x++) {
        if (qr.data[y * qr.size + x]) {
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        }
      }
    }
    
    return canvas.toDataURL('image/png');
  }, [value, size, level]);

  return (
    <img
      src={canvasUrl}
      alt="QR Code"
      style={{ width: size, height: size }}
      className="rounded-lg"
    />
  );
};

export { QRCode };

// QR Code encoding implementation (simplified)
type ErrorLevel = 'L' | 'M' | 'Q' | 'H';

interface QRCodeData {
  size: number;
  data: boolean[];
}

function qrCodeEncode(text: string, level: ErrorLevel): QRCodeData {
  const mode = detectMode(text);
  const encoded = encodeText(text, mode);
  const ecLevel = level;
  
  let version = 1;
  while (true) {
    const capacity = getCapacity(version, ecLevel, mode);
    if (encoded.length <= capacity) break;
    version++;
  }
  
  const ecBlocks = getECBlocks(version, ecLevel);
  const totalCodewords = getTotalCodewords(version);
  const dataCodewords = totalCodewords - ecBlocks.totalEC;
  
  const data = new Uint8Array(dataCodewords);
  data[0] = (mode << 4) | (text.length);
  data.set(encoded, 1);
  
  const paddedCount = dataCodewords - encoded.length - 1;
  for (let i = 0; i < paddedCount; i++) {
    data[encoded.length + 1 + i] = i % 2 === 0 ? 0xEC : 0x11;
  }
  
  const codewords = addErrorCorrection(data, ecBlocks);
  const bits = codewordsToBits(codewords);
  const mask = findBestMask(bits, version);
  const finalBits = applyMask(bits, mask, version);
  
  const size = version * 4 + 17;
  const result = createQRMatrix(finalBits, mask, version, size);
  
  return { size, data: result };
}

function detectMode(text: string): number {
  if (/^[0-9]*$/.test(text)) return 1;
  if (/^[A-Za-z0-9 $%*+./:-]*$/.test(text)) return 2;
  return 4;
}

function encodeText(text: string, mode: number): Uint8Array {
  if (mode === 1) {
    const result = new Uint8Array(Math.ceil(text.length / 2));
    for (let i = 0; i < text.length; i += 2) {
      result[i / 2] = parseInt(text.substr(i, 2), 10);
    }
    return result;
  }
  if (mode === 2) {
    const result = new Uint8Array(Math.ceil(text.length * 5 / 8));
    let bit = 0, byte = 0;
    for (let i = 0; i < text.length; i++) {
      const val = getAlphanumericValue(text[i]);
      for (let j = 5; j >= 0; j--) {
        byte = (byte << 1) | ((val >> j) & 1);
        bit++;
        if (bit === 8) {
          result[result.length - Math.ceil((text.length * 5 - bit + 8) / 8)] = byte;
          byte = 0;
          bit = 0;
        }
      }
    }
    if (bit > 0) {
      byte <<= (8 - bit);
      result[result.length - 1] = byte;
    }
    return result;
  }
  const encoder = new TextEncoder();
  return encoder.encode(text);
}

function getAlphanumericValue(c: string): number {
  if (c >= '0' && c <= '9') return c.charCodeAt(0) - '0'.charCodeAt(0);
  if (c >= 'A' && c <= 'Z') return c.charCodeAt(0) - 'A'.charCodeAt(0) + 10;
  const map: Record<string, number> = { ' ': 36, '$': 37, '%': 38, '*': 39, '+': 40, '-': 41, '.': 42, '/': 43, ':': 44 };
  return map[c] || 0;
}

function getCapacity(version: number, ecLevel: ErrorLevel, mode: number): number {
  const ecBlocks = getECBlocks(version, ecLevel);
  const totalCodewords = getTotalCodewords(version);
  const dataCodewords = totalCodewords - ecBlocks.totalEC;
  
  let headerSize = 4;
  if (mode === 1 && version >= 10) headerSize += 3;
  else if (mode === 2 && version >= 10) headerSize += 3;
  else if (mode === 4) headerSize += 12;
  
  return dataCodewords - headerSize;
}

function getTotalCodewords(version: number): number {
  return ((version * 4 + 17) ** 2 - 36) / 8;
}

interface ECBlocks {
  totalEC: number;
  blocks: { count: number; data: number; ec: number }[];
}

function getECBlocks(version: number, ecLevel: ErrorLevel): ECBlocks {
  const ecData: Record<number, Record<ErrorLevel, { blocks: number; data: number; ec: number; g1?: number; g2?: number; d1?: number; d2?: number }>> = {
    1: { L: { blocks: 1, data: 19, ec: 7 }, M: { blocks: 1, data: 16, ec: 10 }, Q: { blocks: 1, data: 13, ec: 13 }, H: { blocks: 1, data: 9, ec: 17 } },
    2: { L: { blocks: 1, data: 34, ec: 10 }, M: { blocks: 1, data: 28, ec: 16 }, Q: { blocks: 1, data: 22, ec: 22 }, H: { blocks: 1, data: 16, ec: 28 } },
    3: { L: { blocks: 1, data: 55, ec: 15 }, M: { blocks: 1, data: 44, ec: 24 }, Q: { blocks: 2, data: 17, ec: 18 }, H: { blocks: 2, data: 13, ec: 22 } },
    4: { L: { blocks: 1, data: 80, ec: 20 }, M: { blocks: 2, data: 32, ec: 18 }, Q: { blocks: 2, data: 24, ec: 26 }, H: { blocks: 4, data: 9, ec: 16 } },
    5: { L: { blocks: 1, data: 108, ec: 26 }, M: { blocks: 2, data: 43, ec: 24 }, Q: { blocks: 2, data: 32, ec: 36 }, H: { blocks: 4, data: 11, ec: 22 } },
  };
  
  const info = ecData[version]?.[ecLevel] || ecData[5][ecLevel];
  if (info.g1) {
    return {
      totalEC: info.blocks * info.ec + (info.g1 || 0) * (info.ec + 1),
      blocks: [{ count: info.blocks, data: info.data, ec: info.ec }],
    };
  }
  return {
    totalEC: info.blocks * info.ec,
    blocks: [{ count: info.blocks, data: info.data, ec: info.ec }],
  };
}

function addErrorCorrection(data: Uint8Array, ecBlocks: ECBlocks): Uint8Array {
  const result: number[] = [];
  
  for (const block of ecBlocks.blocks) {
    for (let i = 0; i < block.count; i++) {
      const start = i * block.data;
      const blockData = data.subarray(start, start + block.data);
      const ec = generateEC(blockData, block.ec);
      result.push(...blockData, ...ec);
    }
  }
  
  return new Uint8Array(result);
}

function generateEC(data: Uint8Array, count: number): number[] {
  const gen = getGenerator(count);
  const reg = new Array(count).fill(0);
  
  for (const byte of data) {
    let fb = byte ^ reg[0];
    for (let i = 0; i < count - 1; i++) {
      reg[i] = reg[i + 1] ^ multiply(fb, gen[i + 1]);
    }
    reg[count - 1] = multiply(fb, gen[count]);
  }
  
  return reg;
}

function getGenerator(count: number): number[] {
  const gen = [1];
  for (let i = 0; i < count; i++) {
    gen.push(multiply(gen[i], 3));
    for (let j = i; j > 0; j--) {
      gen[j] = gen[j - 1] ^ multiply(gen[j], 3);
    }
  }
  return gen;
}

function multiply(a: number, b: number): number {
  let p = 0;
  for (let i = 0; i < 8; i++) {
    if (b & 1) p ^= a;
    const hiBit = a & 0x80;
    a <<= 1;
    if (hiBit) a ^= 0x1B;
    b >>= 1;
  }
  return p & 0xFF;
}

function codewordsToBits(codewords: Uint8Array): boolean[] {
  const bits: boolean[] = [];
  for (const cw of codewords) {
    for (let i = 7; i >= 0; i--) {
      bits.push(!!(cw & (1 << i)));
    }
  }
  return bits;
}

function findBestMask(bits: boolean[], version: number): number {
  let bestMask = 0, bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const masked = applyMask(bits, mask, version);
    const score = calculatePenalty(masked, version);
    if (score < bestScore) {
      bestScore = score;
      bestMask = mask;
    }
  }
  return bestMask;
}

function applyMask(bits: boolean[], mask: number, version: number): boolean[] {
  const size = version * 4 + 17;
  const result = bits.slice();
  const maskFn = getMaskFunction(mask);
  
  let bitIndex = 0;
  for (let y = size - 1; y >= 0; y--) {
    for (let x = size - 1; x >= 0; x--) {
      const xx = x;
      if (isReserved(x, y, version)) continue;
      if (bitIndex >= result.length) break;
      if (maskFn(x, y)) {
        result[bitIndex] = !result[bitIndex];
      }
      bitIndex++;
    }
  }
  
  return result;
}

function getMaskFunction(mask: number): (x: number, y: number) => boolean {
  const masks = [
    (x: number, y: number) => (x + y) % 2 === 0,
    (x: number, y: number) => y % 2 === 0,
    (x: number, y: number) => x % 3 === 0,
    (x: number, y: number) => (x + y) % 3 === 0,
    (x: number, y: number) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
    (x: number, y: number) => (x * y) % 2 + (x * y) % 3 === 0,
    (x: number, y: number) => ((x * y) % 2 + (x * y) % 3) % 2 === 0,
    (x: number, y: number) => ((x * y) % 3 + (x + y) % 2) % 2 === 0,
  ];
  return masks[mask];
}

function isReserved(x: number, y: number, version: number): boolean {
  const size = version * 4 + 17;
  if ((x < 9 && y < 9) || (x < 9 && y > size - 10) || (x > size - 10 && y < 9)) return true;
  if (version > 6 && x === Math.floor(size / 2) && y < 9) return true;
  return false;
}

function calculatePenalty(bits: boolean[], version: number): number {
  let penalty = 0;
  const size = version * 4 + 17;
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const bit = getBit(bits, x, y, version);
      if (x < size - 4) {
        let count = 1;
        for (let i = 1; i <= 4; i++) {
          if (getBit(bits, x + i, y, version) === bit) count++;
          else break;
        }
        if (count >= 5) penalty += 3 + count - 5;
      }
      if (y < size - 4) {
        let count = 1;
        for (let i = 1; i <= 4; i++) {
          if (getBit(bits, x, y + i, version) === bit) count++;
          else break;
        }
        if (count >= 5) penalty += 3 + count - 5;
      }
    }
  }
  
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const b1 = getBit(bits, x, y, version);
      const b2 = getBit(bits, x + 1, y, version);
      const b3 = getBit(bits, x, y + 1, version);
      const b4 = getBit(bits, x + 1, y + 1, version);
      if (b1 === b2 && b2 === b3 && b3 === b4) penalty += 3;
    }
  }
  
  let darkCount = 0;
  for (let i = 0; i < bits.length; i++) {
    if (bits[i]) darkCount++;
  }
  const ratio = darkCount / bits.length;
  const diff = Math.abs(ratio - 0.5);
  penalty += Math.floor(diff * 20);
  
  return penalty;
}

function getBit(bits: boolean[], x: number, y: number, version: number): boolean {
  const size = version * 4 + 17;
  if (isReserved(x, y, version)) return false;
  
  let bitIndex = 0;
  for (let yy = size - 1; yy >= 0; yy--) {
    for (let xx = size - 1; xx >= 0; xx--) {
      const xxx = xx;
      if (isReserved(xxx, yy, version)) continue;
      if (xxx === x && yy === y) return bits[bitIndex] || false;
      bitIndex++;
    }
  }
  return false;
}

function createQRMatrix(bits: boolean[], mask: number, version: number, size: number): boolean[] {
  const result = new Array(size * size).fill(false);
  
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      if (j < 7 && i < 7) {
        const val = getFinderPatternBit(i, j);
        result[j * size + i] = val;
        result[(size - 1 - j) * size + i] = val;
        result[j * size + (size - 1 - i)] = val;
      }
    }
  }
  
  for (let i = 0; i < 8; i++) {
    result[(6 * size + i) % (size * size)] = i % 2 === 0;
    result[i * size + 6] = i % 2 === 0;
    result[(size - 7) * size + i] = i % 2 === 0;
  }
  
  let bitIndex = 0;
  for (let y = size - 1; y >= 0; y--) {
    for (let x = size - 1; x >= 0; x--) {
      const xx = x;
      if (isReserved(xx, y, version)) continue;
      if (bitIndex >= bits.length) break;
      result[y * size + xx] = bits[bitIndex];
      bitIndex++;
    }
  }
  
  const maskFn = getMaskFunction(mask);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!isReserved(x, y, version) && maskFn(x, y)) {
        result[y * size + x] = !result[y * size + x];
      }
    }
  }
  
  return result;
}

function getFinderPatternBit(row: number, col: number): boolean {
  if (row < 7 && col < 7) {
    if (row === 0 || row === 6 || col === 0 || col === 6) return true;
    if (row === 1 || row === 5 || col === 1 || col === 5) return false;
    if (row === 2 || row === 4 || col === 2 || col === 4) return true;
    if (row === 3 && col === 3) return true;
  }
  return false;
}