import { describe, it, expect } from 'vitest';
import { cropToSquare, resizeSquare } from './resizePng.js';

// 4x2 RGBA 원본(가로가 더 긴 직사각형)을 만드는 헬퍼 — 각 픽셀을 (col, row, 0, 255)로 채워
// 크롭 후 어느 열이 남았는지 색만 보고 바로 알 수 있게 한다.
function makeRect(width, height) {
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      data[idx] = x;
      data[idx + 1] = y;
      data[idx + 2] = 0;
      data[idx + 3] = 255;
    }
  }
  return { width, height, data };
}

describe('cropToSquare', () => {
  it('가로가 더 긴 이미지는 가운데 세로띠만 남긴다', () => {
    const rect = makeRect(4, 2); // width>height → size=2, offsetX=floor((4-2)/2)=1
    const cropped = cropToSquare(rect);
    expect(cropped.width).toBe(2);
    expect(cropped.height).toBe(2);
    // (row0,col0)은 원본의 (x=1,y=0), (row0,col1)은 원본의 (x=2,y=0)
    expect(cropped.data[0]).toBe(1); // R = x
    expect(cropped.data[4]).toBe(2);
  });

  it('세로가 더 긴 이미지는 가운데 가로띠만 남긴다', () => {
    const rect = makeRect(2, 4); // height>width → size=2, offsetY=1
    const cropped = cropToSquare(rect);
    expect(cropped.width).toBe(2);
    expect(cropped.height).toBe(2);
    expect(cropped.data[1]).toBe(1); // G = y, 첫 행은 원본 y=1
  });

  it('이미 정사각형이면 그대로(내용 동일) 돌려준다', () => {
    const rect = makeRect(3, 3);
    const cropped = cropToSquare(rect);
    expect(cropped.width).toBe(3);
    expect(cropped.data).toEqual(rect.data);
  });
});

describe('resizeSquare', () => {
  it('정확히 절반으로 축소하면 2x2 블록의 평균이 된다', () => {
    // 4x4, 전부 불투명(alpha=255). 왼쪽 위 2x2 블록은 R=0, 오른쪽 위 2x2 블록은 R=100.
    const size = 4;
    const data = Buffer.alloc(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        data[idx] = x < 2 ? 0 : 100;
        data[idx + 1] = 0;
        data[idx + 2] = 0;
        data[idx + 3] = 255;
      }
    }
    const out = resizeSquare({ width: size, data }, 2);
    // 출력 (0,0)은 원본 왼쪽 위 2x2(R=0) 평균, (0,1)은 오른쪽 위 2x2(R=100) 평균.
    expect(out[0]).toBe(0);
    expect(out[4]).toBe(100);
    expect(out[3]).toBe(255); // alpha 그대로 유지
  });

  it('1x1로 축소하면 전체 픽셀의 평균 색 하나가 된다', () => {
    const size = 2;
    const data = Buffer.from([
      0, 0, 0, 255, // (0,0) 검정
      100, 0, 0, 255, // (1,0)
      0, 0, 0, 255, // (0,1)
      100, 0, 0, 255, // (1,1)
    ]);
    const out = resizeSquare({ width: size, data }, 1);
    expect(out[0]).toBe(50); // (0+100+0+100)/4
    expect(out[3]).toBe(255);
  });

  it('완전 투명 픽셀은 색이 결과에 섞이지 않는다(알파 예비곱)', () => {
    // 왼쪽은 불투명 빨강(R=200,a=255), 오른쪽은 완전 투명이지만 R=200으로 오염된 픽셀 —
    // 예비곱 없이 단순 평균이면 R이 100 근처로 섞여 나오지만, 예비곱하면 알파=0인 픽셀의
    // 색은 가중치 0이라 결과 색은 그대로 200이어야 한다.
    const size = 2;
    const data = Buffer.from([
      200, 0, 0, 255, // (0,0) 불투명 빨강
      200, 0, 0, 0, // (1,0) 완전 투명(색은 남아있지만 안 보여야 함)
      200, 0, 0, 255, // (0,1)
      200, 0, 0, 0, // (1,1)
    ]);
    const out = resizeSquare({ width: size, data }, 1);
    expect(out[0]).toBe(200);
    expect(out[3]).toBe(128); // (255+0+255+0)/4 반올림
  });

  it('확대(targetSize > srcSize)해도 0으로 나누지 않고 값을 채운다', () => {
    const size = 1;
    const data = Buffer.from([10, 20, 30, 255]);
    const out = resizeSquare({ width: size, data }, 3);
    expect(out.length).toBe(3 * 3 * 4);
    expect(out[0]).toBe(10);
    expect(out[out.length - 4]).toBe(10);
  });
});
