// P7.1: 저장소에 이미지 처리 라이브러리가 없어(package.json 확인) 순수 Node(zlib) PNG 생성
// 로직(scripts/lib/pngIcon.js, P8.1에서 앱 아이콘과 공유하도록 분리)으로 트레이 아이콘을 만든다.
// 실행: node scripts/gen-tray-icon.js
// nativeImage는 파일명이 "<name>@2x.<ext>"면 고해상도 표현으로 자동 인식하므로(Electron 문서),
// 16x16 기본 + 32x32 @2x 한 쌍을 만든다 — critical-reviewer 지적: 32x32 단일 파일만 주면
// Windows 100% DPI의 16px 트레이에서 축소되며 흐려질 수 있었다.
const fs = require('fs');
const path = require('path');
const { buildPng } = require('./lib/pngIcon');

const outDir = path.join(__dirname, '..', 'electron', 'assets');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'tray-icon.png'), buildPng(16));
fs.writeFileSync(path.join(outDir, 'tray-icon@2x.png'), buildPng(32));
console.log('wrote tray-icon.png (16x16) and tray-icon@2x.png (32x32) to', outDir);
