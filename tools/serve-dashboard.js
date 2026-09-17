// backlog-dashboard.html 전용 로컬 정적 서버.
//
// 이 대시보드는 이 프로젝트 안에서만 쓰는 도구라서 범용 파일 선택 UI 대신
// backlog.json / docs/backlog/*.md를 fetch()로 직접 읽는다. file://로 열면
// 브라우저가 로컬 파일 간 fetch를 막기 때문에(CORS) 이 서버로 띄워야 동작한다.
//
// 읽기 전용: GET/HEAD 외 메서드는 거부하고, 쓰기 로직 자체가 없다.
// 127.0.0.1에만 바인딩해 로컬 밖에서는 접근할 수 없다.
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = process.env.PORT ? Number(process.env.PORT) : 5175;

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

const server = http.createServer((req, res) => {
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

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Backlog 대시보드: http://127.0.0.1:${PORT}/ (Ctrl+C로 종료)`);
});
