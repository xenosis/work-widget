// P13 리브랜딩: 사람이 GPT 아이콘 생성기로 만든 원본 이미지(scripts/assets/icon-source.png)를
// 트레이/앱 아이콘에 필요한 여러 정사각형 크기로 리사이즈한다. 원본은 정사각형이 아닐 수도
// 있으므로 리사이즈 전에 가운데 기준 정사각형으로 잘라낸다(크롭하지 않으면 트레이/설치 아이콘이
// 찌그러져 보임). 디코딩/인코딩은 pngjs(순수 JS, 네이티브 바이너리 없음 — P7.1/P8.1이 세운
// "이미지 처리 네이티브 의존성 없음" 기조를 유지)로 한다.
// critical-reviewer 지적(P13 리뷰, Medium): 처음엔 출력 픽셀당 원본 4점만 보는 이중선형
// 보간을 썼는데, 이 용도(1000px대 원본을 16~48px로 축소)에서는 사실상 점 샘플링과 다름없어
// 앨리어싱이 심하고 얇은 획이 사라질 수 있었다. 출력 픽셀이 덮는 원본 사각형 전체를 평균 내는
// 박스 필터(area averaging)로 바꿨다 — 큰 배율로 축소할 때 표준적으로 쓰이는 방식이다. 또한
// RGB를 그냥 평균 내면 반투명/완전 투명 픽셀의 색이 불투명 픽셀에 섞여 경계에 색 번짐이
// 생길 수 있어(같은 지적), 알파를 미리 곱한(premultiplied) 값으로 평균 낸 뒤 다시 나눠
// 되돌린다.
const { PNG } = require('pngjs');

function decodePng(buffer) {
  const png = PNG.sync.read(buffer);
  return { width: png.width, height: png.height, data: png.data };
}

function cropToSquare({ width, height, data }) {
  const size = Math.min(width, height);
  const offsetX = Math.floor((width - size) / 2);
  const offsetY = Math.floor((height - size) / 2);
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    const srcRowStart = ((y + offsetY) * width + offsetX) * 4;
    const dstRowStart = y * size * 4;
    data.copy(out, dstRowStart, srcRowStart, srcRowStart + size * 4);
  }
  return { width: size, height: size, data: out };
}

// [ty, ty+1)×[tx, tx+1) 출력 픽셀 하나가 덮는 원본 사각형 [sy0,sy1)×[sx0,sx1) 안의 모든
// 원본 픽셀을 평균 낸다. 축소(scale>1)든 확대(scale<1)든 항상 최소 1개 픽셀은 샘플링하도록
// clamp해 0으로 나누는 일이 없게 한다.
function averageRegion(src, srcSize, sx0, sx1, sy0, sy1) {
  const xStart = Math.floor(sx0);
  const yStart = Math.floor(sy0);
  const xEnd = Math.max(xStart + 1, Math.min(srcSize, Math.ceil(sx1)));
  const yEnd = Math.max(yStart + 1, Math.min(srcSize, Math.ceil(sy1)));

  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let aSum = 0;
  let count = 0;
  for (let sy = yStart; sy < yEnd; sy++) {
    for (let sx = xStart; sx < xEnd; sx++) {
      const idx = (sy * srcSize + sx) * 4;
      const a = src[idx + 3];
      // 알파를 미리 곱해서 더한다(premultiplied) — 그냥 더하면 완전 투명 픽셀의 RGB가
      // 불투명 픽셀과 같은 비중으로 섞여 축소된 이미지 가장자리에 색이 번져 보일 수 있다.
      rSum += src[idx] * a;
      gSum += src[idx + 1] * a;
      bSum += src[idx + 2] * a;
      aSum += a;
      count++;
    }
  }
  return {
    r: aSum > 0 ? Math.round(rSum / aSum) : 0,
    g: aSum > 0 ? Math.round(gSum / aSum) : 0,
    b: aSum > 0 ? Math.round(bSum / aSum) : 0,
    a: Math.round(aSum / count),
  };
}

function resizeSquare({ width, data }, targetSize) {
  const srcSize = width;
  const out = Buffer.alloc(targetSize * targetSize * 4);
  const scale = srcSize / targetSize;
  for (let ty = 0; ty < targetSize; ty++) {
    const sy0 = ty * scale;
    const sy1 = sy0 + scale;
    for (let tx = 0; tx < targetSize; tx++) {
      const sx0 = tx * scale;
      const sx1 = sx0 + scale;
      const { r, g, b, a } = averageRegion(data, srcSize, sx0, sx1, sy0, sy1);
      const idx = (ty * targetSize + tx) * 4;
      out[idx] = r;
      out[idx + 1] = g;
      out[idx + 2] = b;
      out[idx + 3] = a;
    }
  }
  return out;
}

function encodePng(size, rgba) {
  const png = new PNG({ width: size, height: size });
  rgba.copy(png.data);
  return PNG.sync.write(png);
}

// source PNG 버퍼 -> 지정된 각 정사각형 크기의 PNG 버퍼 배열.
function buildResizedPngs(sourceBuffer, sizes) {
  const decoded = decodePng(sourceBuffer);
  const squared = cropToSquare(decoded);
  return sizes.map((size) => ({
    size,
    png: encodePng(size, resizeSquare(squared, size)),
  }));
}

module.exports = { buildResizedPngs, cropToSquare, resizeSquare };
