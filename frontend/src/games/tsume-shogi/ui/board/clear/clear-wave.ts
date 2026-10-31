import type { TsumeShogiSquare } from "@/games/tsume-shogi/puzzle/position";

/**
 * 詰みを盤の上で見せる時間の組み立て。詰めた手の駒が着いてから、玉が傾き、玉の升から盤の照りの波が広がり、
 * 詰み上がりを少し見せて結果へ移る。盤の端まで波が届いても、詰めた手から結果までが 1.4 秒ほどに収まるようにする。
 */
/** 詰めた手の駒が着いてから、詰みの波が立つまで。 */
export const CLEAR_START_DELAY_MS = 200;
/** 玉の升から1升離れるごとに、波が届くのを遅らせる。 */
export const CLEAR_WAVE_STAGGER_MS = 60;
export const CLEAR_WAVE_DURATION_MS = 420;
export const CLEAR_KING_DURATION_MS = 620;
/** 波が収まった詰み上がりの盤を見せる時間。 */
export const CLEAR_SETTLE_MS = 300;

/** 波を立てる升。盤のすべての升で、詰んだ玉の升に印を付ける。 */
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

const BOARD_SIZE = 9;

/** 玉の升から、照りの波が盤のいちばん遠い升へ届くまでの升の数。 */
export function measureTsumeShogiClearWaveReach(
  king: TsumeShogiSquare,
): number {
  return Math.max(
    king.file - 1,
    BOARD_SIZE - king.file,
    king.rank - 1,
    BOARD_SIZE - king.rank,
  );
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
