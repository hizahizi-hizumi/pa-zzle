import { BOT, TUBE } from "./scene";

/** 下から積んだ液の塊。量は単位（1 = 1色1単位）。同じ色の続きは1つにまとめる。 */
export type LiquidBlock = { color: number; from: number; to: number };

export function toBlocks(
  contents: readonly number[],
  extra?: { color: number; amount: number },
): LiquidBlock[] {
  const blocks: LiquidBlock[] = [];
  function push(color: number, amount: number) {
    if (amount <= 0.0001) return;
    const last = blocks[blocks.length - 1];
    if (last && last.color === color) {
      last.to += amount;
      return;
    }
    const from = last ? last.to : 0;
    blocks.push({ color, from, to: from + amount });
  }
  for (const color of contents) push(color, 1);
  if (extra) push(extra.color, extra.amount);
  return blocks;
}

export function totalAmount(blocks: readonly LiquidBlock[]): number {
  return blocks[blocks.length - 1]?.to ?? 0;
}

const STEP = 1.5;
const AREA = STEP * STEP;
const samples: [number, number][] = [];
for (let y = TUBE.CAV_TOP + STEP / 2; y < BOT; y += STEP) {
  for (let x = -TUBE.RI + STEP / 2; x < TUBE.RI; x += STEP) {
    const straight = y <= BOT - TUBE.RI;
    const inside =
      straight || x * x + (y - (BOT - TUBE.RI)) ** 2 <= TUBE.RI * TUBE.RI;
    if (inside) samples.push([x, y]);
  }
}

/** 立てたときに下から amount 単位まで満たす体積 */
function uprightVolume(amount: number): number {
  const level = BOT - amount * TUBE.U;
  let n = 0;
  for (const [, y] of samples) if (y >= level) n += 1;
  return n * AREA;
}

const volumeCache = new Map<number, number>();
function volumeOf(amount: number): number {
  const key = Math.round(amount * 200) / 200;
  let v = volumeCache.get(key);
  if (v === undefined) {
    v = uprightVolume(key);
    volumeCache.set(key, v);
  }
  return v;
}

/**
 * 傾けた管の中の液の帯。座標は、管の原点から見た画面の向き（水平な液面）。
 * hi が上の液面、lo が下の液面（lo は塊の下端。底の塊は十分大きい値）。
 */
export type TiltedBand = { color: number; hi: number; lo: number };

export function tiltedBands(
  blocks: readonly LiquidBlock[],
  angleDeg: number,
): TiltedBand[] {
  if (blocks.length === 0) return [];
  const a = (angleDeg * Math.PI) / 180;
  const s = Math.sin(a);
  const c = Math.cos(a);
  const ys = samples.map(([x, y]) => x * s + y * c).sort((p, q) => q - p);
  function levelAt(volume: number): number {
    const index = Math.min(
      ys.length - 1,
      Math.max(0, Math.round(volume / AREA) - 1),
    );
    return ys[index] ?? 0;
  }
  const bands: TiltedBand[] = [];
  const total = volumeOf(totalAmount(blocks));
  if (c > 0) {
    let previous = 0;
    for (const block of blocks) {
      const v = volumeOf(block.to);
      bands.push({
        color: block.color,
        lo: previous > 0 ? levelAt(previous) : 1000,
        hi: levelAt(v),
      });
      previous = v;
    }
  } else {
    // 口が下を向くと、上の塊ほど低い所（口の側）に集まる。
    let previous = 0;
    for (let i = blocks.length - 1; i >= 0; i -= 1) {
      const block = blocks[i];
      if (!block) continue;
      const v = total - volumeOf(block.from);
      bands.unshift({
        color: block.color,
        lo: previous > 0 ? levelAt(previous) : 1000,
        hi: levelAt(v),
      });
      previous = v;
    }
  }
  return bands;
}

/** 注ぐときの傾き（度）。残りが少ないほど深く傾ける。 */
export function pourTilt(remaining: number): number {
  return 50 + (4 - remaining) * 15.5;
}
