import type { TsumeShogiSquare } from "@/games/tsume-shogi/puzzle/position";

/** 詰めた手の駒が着いてから、詰みの波が立つまで。 */
export const CLEAR_START_DELAY_MS = 260;
/** 玉の升から1升離れるごとに、波が届くのを遅らせる。 */
export const CLEAR_WAVE_STAGGER_MS = 70;
export const CLEAR_WAVE_DURATION_MS = 420;
export const CLEAR_KING_DURATION_MS = 620;
/** 波が収まった詰み上がりの盤を見せる時間。 */
export const CLEAR_SETTLE_MS = 700;

/** 波で動かす升。駒のある升と玉の升だけを対象にする。 */
export type TsumeShogiClearWaveSquare = {
  square: TsumeShogiSquare;
  matedKing: boolean;
};

export type TsumeShogiClearWaveStep = {
  square: TsumeShogiSquare;
  matedKing: boolean;
  delayMs: number;
  durationMs: number;
};

export type TsumeShogiClearWavePlan = {
  steps: TsumeShogiClearWaveStep[];
  /** 演出を始めてから、詰み上がりを見せ終えるまで。動きを減らす設定でも、この間だけ詰み上がりを見せる。 */
  totalMs: number;
};

function distance(a: TsumeShogiSquare, b: TsumeShogiSquare): number {
  return Math.max(Math.abs(a.file - b.file), Math.abs(a.rank - b.rank));
}

/**
 * 詰みの波の順序と長さ。玉の升から近い順に、1升ごとに遅らせて立てる。
 * 玉が見つからないときは波を立てず、詰み上がりを見せる時間だけを返す。
 */
export function planTsumeShogiClearWave(
  squares: readonly TsumeShogiClearWaveSquare[],
): TsumeShogiClearWavePlan {
  const king = squares.find((square) => square.matedKing);
  if (!king) {
    return {
      steps: [],
      totalMs: CLEAR_START_DELAY_MS + CLEAR_KING_DURATION_MS + CLEAR_SETTLE_MS,
    };
  }
  const steps = squares
    .map((target) => ({
      square: target.square,
      matedKing: target.matedKing,
      delayMs:
        CLEAR_START_DELAY_MS +
        distance(target.square, king.square) * CLEAR_WAVE_STAGGER_MS,
      durationMs: target.matedKing
        ? CLEAR_KING_DURATION_MS
        : CLEAR_WAVE_DURATION_MS,
    }))
    .sort((a, b) => a.delayMs - b.delayMs);
  const lastEndMs = Math.max(
    ...steps.map((step) => step.delayMs + step.durationMs),
  );
  return { steps, totalMs: lastEndMs + CLEAR_SETTLE_MS };
}
