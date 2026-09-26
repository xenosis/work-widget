// P8.1 → P13(리브랜딩)에서 갱신: electron-builder의 win.icon(설치 파일/실행 파일 아이콘, 다중
// 해상도 .ico)을 사람이 GPT 아이콘 생성기로 만든 원본(scripts/assets/icon-source.png)에서
// 만든다. 실행: node scripts/gen-app-icon.js
//
// ICO 컨테이너는 P8.1 때처럼 직접 만든다 — Windows Vista부터 지원하는 "PNG를 그대로 이미지
// 데이터로 넣는 ICO" 방식이라 별도 BMP/DIB 인코더가 필요 없다. 리사이즈만 scripts/lib/resizePng.js
// (pngjs 기반, P13에서 추가)로 하고 나머지 ICO 패킹 로직은 그대로 재사용한다.
const fs = require('fs');
const path = require('path');
const { buildResizedPngs } = require('./lib/resizePng');

const SIZES = [16, 32, 48, 256];
const sourcePath = path.join(__dirname, 'assets', 'icon-source.png');

function buildIco(images) {
  const count = images.length;
  let offset = 6 + 16 * count; // ICONDIR(6) + ICONDIRENTRY(16)*count
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = icon
  header.writeUInt16LE(count, 4);

  const entries = [];
  const datas = [];
  for (const { size, png } of images) {
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size; // width, 0 == 256(ICO 스펙 관례)
    entry[1] = size >= 256 ? 0 : size; // height
    entry[2] = 0; // 팔레트 색상 수(트루컬러라 0)
    entry[3] = 0; // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8); // 이미지 데이터 크기
    entry.writeUInt32LE(offset, 12); // 파일 시작 기준 오프셋
    offset += png.length;
    entries.push(entry);
    datas.push(png);
  }
  return Buffer.concat([header, ...entries, ...datas]);
}

const sourceBuffer = fs.readFileSync(sourcePath);
const images = buildResizedPngs(sourceBuffer, SIZES);
const ico = buildIco(images);

const outDir = path.join(__dirname, '..', 'electron', 'assets');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'app-icon.ico');
fs.writeFileSync(outPath, ico);
console.log(`wrote app-icon.ico (${SIZES.join('/')}) from ${sourcePath} to`, outPath);
