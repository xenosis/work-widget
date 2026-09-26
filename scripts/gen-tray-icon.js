// P7.1 → P13(리브랜딩)에서 갱신: 트레이 아이콘을 사람이 GPT 아이콘 생성기로 만든 원본
// (scripts/assets/icon-source.png)에서 만든다. 실행: node scripts/gen-tray-icon.js
// nativeImage는 파일명이 "<name>@2x.<ext>"면 고해상도 표현으로 자동 인식하므로(Electron 문서),
// 16x16 기본 + 32x32 @2x 한 쌍을 만든다 — critical-reviewer 지적(P7.1): 32x32 단일 파일만
// 주면 Windows 100% DPI의 16px 트레이에서 축소되며 흐려질 수 있었다.
const fs = require('fs');
const path = require('path');
const { buildResizedPngs } = require('./lib/resizePng');

const sourcePath = path.join(__dirname, 'assets', 'icon-source.png');
const outDir = path.join(__dirname, '..', 'electron', 'assets');
fs.mkdirSync(outDir, { recursive: true });

const sourceBuffer = fs.readFileSync(sourcePath);
const [icon16, icon32] = buildResizedPngs(sourceBuffer, [16, 32]);
fs.writeFileSync(path.join(outDir, 'tray-icon.png'), icon16.png);
fs.writeFileSync(path.join(outDir, 'tray-icon@2x.png'), icon32.png);
console.log('wrote tray-icon.png (16x16) and tray-icon@2x.png (32x32) from', sourcePath, 'to', outDir);
