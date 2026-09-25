// P7.1이 만든 순수 Node(zlib) PNG 생성 로직 — P8.1에서 앱 아이콘(.ico)도 같은 디자인(청록 원 +
// 흰 체크마크)으로 만들기 위해 scripts/gen-tray-icon.js에서 공유 모듈로 뽑았다. 트레이 아이콘과
// 로직을 이원화하면 브랜드 색/모양이 서로 어긋날 수 있어 하나로 합쳤다.
'use strict';

const zlib = require('zlib');

// CRC32 (PNG 스펙 표준 다항식)
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

// 이 앱의 accent 색(src/index.css의 --accent: oklch(75% 0.15 200), 다크 글래스 UI의 청록
// 포인트 컬러)을 근사한 RGB — 정확한 oklch 변환 도구가 없어 시각적으로 비슷한 청록을 골랐다.
const ACCENT = [56, 199, 201];
const WHITE = [255, 255, 255];

function distToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const abLen2 = abx * abx + aby * aby;
  let t = abLen2 === 0 ? 0 : (apx * abx + apy * aby) / abLen2;
  t = Math.max(0, Math.min(1, t));
  const cx2 = ax + abx * t;
  const cy2 = ay + aby * t;
  return Math.sqrt((px - cx2) * (px - cx2) + (py - cy2) * (py - cy2));
}

function pixelAt(size, x, y) {
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  const r = size / 2 - 1;
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > r + 0.5) return [0, 0, 0, 0];

  let alpha = 255;
  if (dist > r - 0.5) {
    alpha = Math.max(0, Math.round(255 * (r + 0.5 - dist)));
  }

  // 체크마크 좌표는 32x32 기준으로 정하고 다른 크기는 비례 축소한다.
  const scale = size / 32;
  const p1 = [9 * scale, 17 * scale];
  const p2 = [14 * scale, 22 * scale];
  const p3 = [23 * scale, 10 * scale];
  const thickness = 2.6 * scale;

  const onCheck =
    distToSegment(x, y, p1[0], p1[1], p2[0], p2[1]) < thickness ||
    distToSegment(x, y, p2[0], p2[1], p3[0], p3[1]) < thickness;

  const [r255, g255, b255] = onCheck ? WHITE : ACCENT;
  return [r255, g255, b255, alpha];
}

function buildPng(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  let offset = 0;
  for (let y = 0; y < size; y += 1) {
    raw[offset] = 0; // 필터 없음
    offset += 1;
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = pixelAt(size, x, y);
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      raw[offset + 3] = a;
      offset += 4;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = zlib.deflateSync(raw);

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

module.exports = { buildPng };
