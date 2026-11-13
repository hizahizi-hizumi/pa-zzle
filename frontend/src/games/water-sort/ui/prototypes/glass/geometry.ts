// 試作 glass: 厚手ガラスの試験管の形と、傾けた管の中の液面の高さを体積から求める計算。
// 座標は試験管の局所座標（x は横、y は下向き。口の縁の上端が y=0）。

/** 内側の半径。 */
export const R = 22.5;
/** ガラスの肉厚。 */
export const WALL = 5.8;
/** 外側の半径。 */
export const RO = R + WALL;
/** 内側の直線部の下端（ここから下が丸い底）。 */
export const STRAIGHT_BOTTOM = 161;
/** 内側の底。 */
export const BOT = STRAIGHT_BOTTOM + R;
/** 外側の底（底のガラスは厚い）。 */
export const OUTER_BOT = STRAIGHT_BOTTOM + RO + 4.5;
/** 内側の上端。 */
export const CAVITY_TOP = 3;
/** 1単位の高さ。 */
export const U = 32.5;
export const CAPACITY = 4;

export const CAVITY_PATH = `M${-R},${CAVITY_TOP} L${-R},${STRAIGHT_BOTTOM} A${R},${R} 0 0 0 ${R},${STRAIGHT_BOTTOM} L${R},${CAVITY_TOP} Z`;
export const OUTER_PATH = `M${-RO},1.5 L${-RO},${STRAIGHT_BOTTOM} A${RO},${OUTER_BOT - STRAIGHT_BOTTOM} 0 0 0 ${RO},${STRAIGHT_BOTTOM} L${RO},1.5 Z`;
/** ガラスの肉（外側から内側を抜いた形）。 */
export const WALL_PATH = `${OUTER_PATH} ${CAVITY_PATH}`;

function inCavity(x: number, y: number) {
  if (Math.abs(x) > R || y < CAVITY_TOP) return false;
  if (y <= STRAIGHT_BOTTOM) return true;
  return x * x + (y - STRAIGHT_BOTTOM) ** 2 <= R * R;
}

const STEP = 1;
const sampleX: number[] = [];
const sampleY: number[] = [];
for (let y = CAVITY_TOP + STEP / 2; y < BOT; y += STEP) {
  for (let x = -R + STEP / 2; x < R; x += STEP) {
    if (inCavity(x, y)) {
      sampleX.push(x);
      sampleY.push(y);
    }
  }
}
const SAMPLE_COUNT = sampleX.length;
const sortedYAsc = Float64Array.from(sampleY).sort();

/** 立てた管で、底から u 単位の高さまでの体積（標本の数）。 */
export function volumeOfUnits(u: number): number {
  if (u <= 0) return 0;
  const h = BOT - u * U;
  // y >= h の標本の数
  let lo = 0;
  let hi = SAMPLE_COUNT;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((sortedYAsc[mid] ?? 0) < h) lo = mid + 1;
    else hi = mid;
  }
  return SAMPLE_COUNT - lo;
}

const rad = (d: number) => (d * Math.PI) / 180;

/** 角度 0〜180 度（1度ごと）で、こぼさずに入る体積。 */
const capacityByDegree: number[] = [];
for (let d = 0; d <= 180; d++) {
  const s = Math.sin(rad(d));
  const c = Math.cos(rad(d));
  const kLip = R * s + CAVITY_TOP * c;
  let n = 0;
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    if ((sampleX[i] ?? 0) * s + (sampleY[i] ?? 0) * c > kLip) n++;
  }
  capacityByDegree.push(n);
}

/** 体積 v がちょうど口の縁に届く傾き（度、正）。 */
export function angleForVolume(v: number): number {
  for (let d = 1; d <= 180; d++) {
    const cap = capacityByDegree[d] ?? 0;
    if (cap <= v) {
      const prev = capacityByDegree[d - 1] ?? cap;
      const t = prev === cap ? 0 : (prev - v) / (prev - cap);
      return d - 1 + t;
    }
  }
  return 180;
}

const scratch = new Float64Array(SAMPLE_COUNT);

/**
 * 傾き a 度のとき、底から数えた体積ごとの液面の位置を返す。
 * 位置は k = x·sin a + y·cos a（世界で下ほど大きい）で表す。
 */
export function levelsAt(aDeg: number, volumes: readonly number[]): number[] {
  if (aDeg === 0) {
    return volumes.map((v) => {
      // 立てた管: 体積から高さへ（単位の高さは一定なので標本の逆引き）
      if (v <= 0) return BOT;
      const index = SAMPLE_COUNT - Math.round(v);
      return sortedYAsc[Math.max(0, Math.min(SAMPLE_COUNT - 1, index))] ?? BOT;
    });
  }
  const s = Math.sin(rad(aDeg));
  const c = Math.cos(rad(aDeg));
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    scratch[i] = (sampleX[i] ?? 0) * s + (sampleY[i] ?? 0) * c;
  }
  scratch.sort();
  const maxK = scratch[SAMPLE_COUNT - 1] ?? 0;
  return volumes.map((v) => {
    if (v <= 0) return maxK + 1;
    const index = SAMPLE_COUNT - Math.round(v);
    return scratch[Math.max(0, Math.min(SAMPLE_COUNT - 1, index))] ?? maxK;
  });
}

/** 立てた管の単位の高さ。 */
export function heightOfUnits(u: number) {
  return BOT - u * U;
}
