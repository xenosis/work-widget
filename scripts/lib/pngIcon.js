// P7.1이 만든 순수 Node(zlib) PNG 생성 로직 — P8.1에서 앱 아이콘(.ico)도 같은 디자인(남색 원 +
// 흰 서류가방 실루엣)으로 만들기 위해 scripts/gen-tray-icon.js에서 공유 모듈로 뽑았다. 트레이
// 아이콘과 로직을 이원화하면 브랜드 색/모양이 서로 어긋날 수 있어 하나로 합쳤다.
// P13 결정(사람, 2026-09-25): "업무 위젯" 리브랜딩(Deskdock)의 일부로 기존 청록 원+체크마크
// 디자인을 남색 원+서류가방(briefcase) 실루엣으로 교체 — "업무용 위젯"이라는 인상을 더 직접
// 전달하고, 하늘색 계열이던 배경색도 더 전문적인 남색으로 바꿨다.
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

// P13 결정: "전문적인" 톤을 원해 기존 청록(하늘색 계열) 대신 깊은 남색을 골랐다 — 정확한 브랜드
// 컬러 시스템은 없고, 시각적으로 "네이비/업무용" 인상을 주는 RGB를 직접 골랐다.
const ACCENT = [37, 66, 112];
const WHITE = [246, 248, 251];

// 점 (x,y)가 (x0,y0)-(x1,y1) 사각형(모서리 반지름 r)의 안쪽인지 — 서류가방 실루엣을 사각형
// 조합으로 그리기 위한 헬퍼. 체크마크 때 쓰던 두 점 사이 거리 계산(distToSegment) 대신, 이번
// 도형은 채워진 영역 판정이 더 간단해서 이 방식을 쓴다.
function inRoundedRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const withinXCore = x >= x0 + r && x <= x1 - r;
  const withinYCore = y >= y0 + r && y <= y1 - r;
  if (withinXCore || withinYCore) return true; // 모서리 라운딩이 필요 없는 십자 영역
  const cx = x < x0 + r ? x0 + r : x1 - r;
  const cy = y < y0 + r ? y0 + r : y1 - r;
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

// 서류가방(briefcase) 실루엣 — 업무용 위젯이라는 인상을 직접 전달하기 위한 심볼(P13 결정).
// 32x32 가상 좌표 기준으로 정의하고, 실제 크기에 맞춰 scale로 나눠(virtual 좌표로 변환) 판정한다.
function isBriefcase(xv, yv) {
  const inBody = inRoundedRect(xv, yv, 5, 12, 27, 25, 2.5);
  const inHandle = inRoundedRect(xv, yv, 11, 6, 21, 13, 1.5);
  const handleHollow = xv >= 13 && xv <= 19 && yv >= 8 && yv <= 14;
  const inSeam = inBody && yv >= 17.5 && yv <= 18.5; // 뚜껑이 갈라지는 선 — 배경색으로 뺀다
  return (inBody || (inHandle && !handleHollow)) && !inSeam;
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

  // 도형은 32x32 기준으로 정하고 다른 크기는 비례 축소한다(체크마크 때와 동일한 관례).
  const scale = size / 32;
  const onBriefcase = isBriefcase(x / scale, y / scale);

  const [r255, g255, b255] = onBriefcase ? WHITE : ACCENT;
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
