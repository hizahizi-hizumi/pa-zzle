import type { PourAnimation } from "@/games/water-sort/ui/board/pour/pour-animation";

/** 場の力で液を宙に渡す1回の長さ。 */
export const FIELD_POUR_DURATION_MS = 1250;

/** 動きの長さに対する割合。液の先端が注ぎ元を出て注ぎ先に着き、末尾が注ぎ元を離れて注ぎ先に収まるまで。 */
export const FIELD_POUR_PHASES = {
  headLeaves: 0.08,
  headArrives: 0.44,
  tailLeaves: 0.6,
  tailArrives: 0.84,
} as const;

export type FieldPourFrame = {
  /** 流れの先端と末尾の位置（0 が注ぎ元の液面、1 が注ぎ先の液面）。 */
  head: number;
  tail: number;
  /** 注ぎ元から抜けた割合と、注ぎ先に収まった割合。 */
  drained: number;
  received: number;
  /** 持ち上げた注ぎ元が置かれた位置へ戻る割合（行き過ぎて少し沈んでから戻る）。 */
  settle: number;
  /** 液を受けた重みで注ぎ先が沈む量（管の高さに対する割合）。 */
  receiverDip: number;
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function progressBetween(t: number, start: number, end: number): number {
  return clamp01((t - start) / (end - start));
}

function easeOutBack(value: number): number {
  const overshoot = 1.6;
  const shifted = value - 1;
  return 1 + (overshoot + 1) * shifted ** 3 + overshoot * shifted ** 2;
}

export function getFieldPourFrame(t: number): FieldPourFrame {
  const { headLeaves, headArrives, tailLeaves, tailArrives } =
    FIELD_POUR_PHASES;
  // 引き出す所はゆっくり、落ちる所は重さで速まる。
  const head = progressBetween(t, headLeaves, headArrives) ** 1.4;
  const tail = progressBetween(t, tailLeaves, tailArrives) ** 1.7;
  const landing = progressBetween(t, headArrives, headArrives + 0.3);
  return {
    head,
    tail,
    drained: progressBetween(t, headLeaves + 0.02, tailLeaves),
    received: progressBetween(t, headArrives, tailArrives + 0.04),
    settle: easeOutBack(progressBetween(t, tailLeaves, 0.94)),
    receiverDip: Math.sin(Math.PI * landing) * (1 - landing) * 0.035,
  };
}

const startTimes = new WeakMap<PourAnimation, number>();

/** 注ぎ元と注ぎ先を別々に動かすので、同じ注ぎの始まりの時刻をそろえる。 */
export function getFieldPourElapsed(animation: PourAnimation): number {
  const now = performance.now();
  const start = startTimes.get(animation) ?? now;
  startTimes.set(animation, start);
  return clamp01((now - start) / FIELD_POUR_DURATION_MS);
}

export function getMovedSlotCount(animation: PourAnimation): number {
  return animation.source.before.length - animation.source.after.length;
}
