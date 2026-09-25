// P8.1: electron-builder의 win.icon(설치 파일/실행 파일 아이콘, 보통 256x256을 포함한 다중
// 해상도 .ico)을 트레이 아이콘과 같은 디자인(scripts/lib/pngIcon.js)으로 만든다. 실행:
// node scripts/gen-app-icon.js
//
// ICO 컨테이너는 직접 만든다(이미지 처리 라이브러리 없음, P7.1과 같은 이유). 전통적인 BMP/DIB
// 방식 대신, Windows Vista부터 지원하는 "PNG를 그대로 이미지 데이터로 넣는 ICO" 방식을 쓴다 —
// 32비트 진짜 컬러+알파를 다루는 BMP/DIB 인코더를 새로 만들 필요 없이 이미 검증된 buildPng를
// 그대로 재사용할 수 있고, 256x256처럼 큰 해상도는 이 방식이 사실상 표준이다.
const fs = require('fs');
const path = require('path');
const { buildPng } = require('./lib/pngIcon');

const SIZES = [16, 32, 48, 256];

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

const images = SIZES.map((size) => ({ size, png: buildPng(size) }));
const ico = buildIco(images);

const outDir = path.join(__dirname, '..', 'electron', 'assets');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'app-icon.ico');
fs.writeFileSync(outPath, ico);
console.log(`wrote app-icon.ico (${SIZES.join('/')}) to`, outPath);
