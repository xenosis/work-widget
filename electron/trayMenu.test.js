import { describe, it, expect, vi } from 'vitest';
import { buildTrayMenuTemplate } from './trayMenu.js';

// P29: buildTrayMenuTemplate은 electron을 전혀 안 써서(app/Menu 의존은 buildTrayMenu 쪽 얇은
// 층에만 있음) 이 프로젝트의 실제 전례(autoLaunch.test.js — electron 의존 부분은 떼어내고
// 순수 로직만 검증)대로 그대로 vitest로 검증한다. critical-reviewer 지적: 처음엔 이 분리를
// 안 하고 "vi.mock이 CJS/ESM 인터롭 문제로 안 먹혀서 vitest 자체를 포기한다"고 잘못 적었었다.
function baseOpts(overrides) {
  return {
    openAtLogin: false,
    autoLaunchToggleEnabled: true,
    onToggleVisibility: vi.fn(),
    onToggleAutoLaunch: vi.fn(),
    onQuit: vi.fn(),
    ...overrides,
  };
}

function findItem(template, label) {
  return template.find((item) => item.label === label);
}

describe('buildTrayMenuTemplate', () => {
  it('열기/숨기기, 구분선 2개, 자동 실행 체크박스, 완전히 종료 순서로 5개 항목을 만든다', () => {
    const template = buildTrayMenuTemplate(baseOpts());
    expect(template.map((i) => i.label ?? '(구분선)')).toEqual([
      '열기/숨기기',
      '(구분선)',
      'Windows 시작 시 자동 실행',
      '(구분선)',
      '완전히 종료',
    ]);
    expect(template[1].type).toBe('separator');
    expect(template[3].type).toBe('separator');
  });

  it('열기/숨기기를 클릭하면 onToggleVisibility를 그대로 부른다', () => {
    const opts = baseOpts();
    findItem(buildTrayMenuTemplate(opts), '열기/숨기기').click();
    expect(opts.onToggleVisibility).toHaveBeenCalledTimes(1);
  });

  it('완전히 종료를 클릭하면 onQuit을 그대로 부른다', () => {
    const opts = baseOpts();
    findItem(buildTrayMenuTemplate(opts), '완전히 종료').click();
    expect(opts.onQuit).toHaveBeenCalledTimes(1);
  });

  it('자동 실행 체크박스는 openAtLogin을 checked에 그대로 반영한다', () => {
    expect(findItem(buildTrayMenuTemplate(baseOpts({ openAtLogin: true })), 'Windows 시작 시 자동 실행').checked).toBe(
      true
    );
    expect(
      findItem(buildTrayMenuTemplate(baseOpts({ openAtLogin: false })), 'Windows 시작 시 자동 실행').checked
    ).toBe(false);
  });

  // critical-reviewer 지적(High): 개발 모드(패키지 빌드가 아님)에서 이 체크박스를 누르면
  // 개발용 electron.exe 자체가 실제 Windows 시작 프로그램에 등록되는 부작용이 있었다 —
  // configureAutoLaunch(P7.2)가 같은 이유로 app.isPackaged 가드를 두는 것과 동일하게, 이
  // 항목도 패키지 빌드가 아니면 비활성화(enabled:false)해야 한다.
  it('autoLaunchToggleEnabled가 false면(개발 모드) 체크박스가 비활성화된다', () => {
    expect(
      findItem(buildTrayMenuTemplate(baseOpts({ autoLaunchToggleEnabled: false })), 'Windows 시작 시 자동 실행').enabled
    ).toBe(false);
  });

  it('autoLaunchToggleEnabled가 true면(패키지 빌드) 체크박스가 활성화된다', () => {
    expect(
      findItem(buildTrayMenuTemplate(baseOpts({ autoLaunchToggleEnabled: true })), 'Windows 시작 시 자동 실행').enabled
    ).toBe(true);
  });

  it('체크박스를 클릭하면 그 새 checked 값 그대로 onToggleAutoLaunch에 넘긴다', () => {
    const opts = baseOpts();
    const item = findItem(buildTrayMenuTemplate(opts), 'Windows 시작 시 자동 실행');
    item.click({ checked: true });
    expect(opts.onToggleAutoLaunch).toHaveBeenCalledWith(true);
    item.click({ checked: false });
    expect(opts.onToggleAutoLaunch).toHaveBeenCalledWith(false);
  });
});
