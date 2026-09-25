// backlog-dashboard.html 전용 로컬 정적 서버.
//
// 이 대시보드는 이 프로젝트 안에서만 쓰는 도구라서 범용 파일 선택 UI 대신
// backlog.json / docs/backlog/*.md를 fetch()로 직접 읽는다. file://로 열면
// 브라우저가 로컬 파일 간 fetch를 막기 때문에(CORS) 이 서버로 띄워야 동작한다.
//
// 읽기 전용: GET/HEAD 외 메서드는 거부하고, 쓰기 로직 자체가 없다.
// 127.0.0.1에만 바인딩해 로컬 밖에서는 접근할 수 없다.
//
// 단일 인스턴스 + 유휴 자동 종료: 프로젝트 경로별로 os.tmpdir()에 lock 파일(pid+port)을
// 둔다. 이미 이 프로젝트용 서버가 떠 있으면 새로 띄우지 않고 그 서버의 브라우저 탭만
// 연다(다른 프로젝트가 먼저 기본 포트를 차지해도 자동으로 다음 포트를 골라 "하나만
// 계속 보이는" 문제를 없앤다). 또한 일정 시간 요청이 없으면(브라우저를 닫고 아무도
// 안 보는 경우 포함) 스스로 종료한다 — /min으로 띄운 백그라운드 프로세스가 영원히
// 남지 않도록.
'use strict';

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const BASE_PORT = process.env.PORT ? Number(process.env.PORT) : 5175;
const PORT_TRIES = 20;
const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10분 무요청 시 자동 종료

const rootHash = crypto.createHash('md5').update(ROOT).digest('hex').slice(0, 8);
const LOCK_PATH = path.join(os.tmpdir(), `work-widget-dashboard-${rootHash}.json`);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

function send(res, status, headers, body) {
  res.writeHead(status, headers);
  res.end(body);
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function openBrowser(url) {
  spawn('cmd', ['/c', 'start', '""', url], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  }).unref();
}

function readLock() {
  try {
    return JSON.parse(fs.readFileSync(LOCK_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function writeLock(port) {
  fs.writeFileSync(LOCK_PATH, JSON.stringify({ pid: process.pid, port }));
}

function clearLock() {
  try {
    fs.unlinkSync(LOCK_PATH);
  } catch {
    // 이미 없으면 무시
  }
}

const existing = readLock();
if (existing && isAlive(existing.pid)) {
  console.log(`이미 이 프로젝트의 대시보드가 실행 중입니다: http://127.0.0.1:${existing.port}/`);
  openBrowser(`http://127.0.0.1:${existing.port}/`);
  process.exit(0);
}

let lastRequestAt = Date.now();

const server = http.createServer((req, res) => {
  lastRequestAt = Date.now();

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    send(res, 405, { 'Content-Type': 'text/plain; charset=utf-8' }, '읽기 전용 서버입니다 (GET만 허용)');
    return;
  }

  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = '/tools/backlog-dashboard.html';
  const full = path.normalize(path.join(ROOT, urlPath));
  if (!full.startsWith(ROOT)) {
    send(res, 403, { 'Content-Type': 'text/plain; charset=utf-8' }, 'forbidden');
    return;
  }

  fs.stat(full, (statErr, stat) => {
    if (statErr || !stat.isFile()) {
      send(res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, `not found: ${urlPath}`);
      return;
    }
    fs.readFile(full, (readErr, data) => {
      if (readErr) {
        send(res, 500, { 'Content-Type': 'text/plain; charset=utf-8' }, String(readErr));
        return;
      }
      const type = TYPES[path.extname(full)] || 'application/octet-stream';
      send(res, 200, { 'Content-Type': type, 'Last-Modified': stat.mtime.toUTCString() }, data);
    });
  });
});

function tryListen(port, triesLeft) {
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && triesLeft > 0) {
      tryListen(port + 1, triesLeft - 1);
      return;
    }
    console.error('서버를 시작하지 못했습니다:', err.message);
    process.exit(1);
  });
  server.listen(port, '127.0.0.1', () => {
    writeLock(port);
    const url = `http://127.0.0.1:${port}/`;
    console.log(`Backlog 대시보드: ${url} (10분간 요청 없으면 자동 종료, 바로 끄려면 Ctrl+C)`);
    openBrowser(url);
  });
}

tryListen(BASE_PORT, PORT_TRIES);

const idleCheck = setInterval(() => {
  if (Date.now() - lastRequestAt > IDLE_TIMEOUT_MS) {
    console.log('10분간 요청이 없어 대시보드 서버를 자동 종료합니다.');
    clearInterval(idleCheck);
    clearLock();
    server.close(() => process.exit(0));
  }
}, 60 * 1000);

function shutdown() {
  clearLock();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
