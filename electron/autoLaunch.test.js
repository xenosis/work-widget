import fs from 'fs';
import path from 'path';
import os from 'os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { hasRegisteredAutoLaunch, markAutoLaunchRegistered } from './autoLaunch.js';

// P7.2 critical-reviewer 지적: "최초 1회만 등록" 판단 로직(app.getPath에 의존하지 않는 순수 fs
// 부분)은 dataStore.js의 pruneOldBackups와 같은 이유로 Electron 런타임 없이 테스트 가능하다 —
// getAutoLaunchFlagPath(app.getPath 의존)는 여기서 테스트하지 않는다(vite.config.js 주석 참고).

describe('hasRegisteredAutoLaunch / markAutoLaunchRegistered', () => {
  let dir;
  let flagPath;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'work-widget-autolaunch-test-'));
    flagPath = path.join(dir, 'auto-launch-registered.flag');
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('플래그 파일이 없으면 아직 등록 안 한 것으로 판단한다', () => {
    expect(hasRegisteredAutoLaunch(flagPath)).toBe(false);
  });

  it('markAutoLaunchRegistered 후에는 등록된 것으로 판단한다', () => {
    markAutoLaunchRegistered(flagPath);
    expect(hasRegisteredAutoLaunch(flagPath)).toBe(true);
  });

  it('반복 호출해도 매번 같은 판단을 내린다(멱등)', () => {
    markAutoLaunchRegistered(flagPath);
    markAutoLaunchRegistered(flagPath);
    expect(hasRegisteredAutoLaunch(flagPath)).toBe(true);
  });
});
