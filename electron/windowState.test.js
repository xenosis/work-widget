import { describe, it, expect } from 'vitest';
import { isValidBounds } from './windowState.js';

// isOnVisibleDisplay/loadWindowState/saveWindowState는 electron의 app/screen에 의존해서
// dataStore.test.js와 같은 이유로(plain node에서 electron이 경로 문자열만 내보내 app/screen이
// undefined) 여기서 테스트하지 않는다 — isValidBounds만 순수 함수라 검증한다.
describe('isValidBounds', () => {
  it('x/y/width/height가 모두 유한수이고 크기가 양수면 유효하다', () => {
    expect(isValidBounds({ x: 100, y: 100, width: 420, height: 640 })).toBe(true);
  });

  it('필드가 없거나 숫자가 아니면 무효하다', () => {
    expect(isValidBounds(null)).toBeFalsy();
    expect(isValidBounds(undefined)).toBeFalsy();
    expect(isValidBounds({})).toBeFalsy();
    expect(isValidBounds({ x: 'a', y: 0, width: 420, height: 640 })).toBeFalsy();
    expect(isValidBounds({ x: 0, y: 0, width: NaN, height: 640 })).toBeFalsy();
  });

  it('width/height가 0 이하면 무효하다', () => {
    expect(isValidBounds({ x: 0, y: 0, width: 0, height: 640 })).toBe(false);
    expect(isValidBounds({ x: 0, y: 0, width: 420, height: -10 })).toBe(false);
  });
});
