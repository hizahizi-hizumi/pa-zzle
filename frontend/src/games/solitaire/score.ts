import {
  calculateSpeedScore,
  calculateTimeDeltaMs,
  createSpeedScoreRule,
  type PlayScore,
  type ScoreMaximums,
  type SpeedScoreRule,
  subtractWithFloor,
  sumPlayScore,
} from "@/games/score";

/** 打った運びを取り消さずに運び切ることを主に、速さを次に見る（導入調査の採点の前提）。 */
export const SOLITAIRE_SCORE_MAXIMUMS = {
  stability: 60,
  speed: 40,
} as const satisfies ScoreMaximums<"stability" | "speed">;

/** 山札を押す手でない手を1手取り消すごとに減らす点。 */
export const SOLITAIRE_RETRACTED_MOVE_PENALTY = 2;

/**
 * 速さの基準時間。どの配り方も52枚を組札へ運び、導入調査では1問に約120の操作（めくり以外が約88手、めくりが約35回）を測ったので、
 * 1操作3秒として置く。
 */
export const SOLITAIRE_SPEED_FULL_SCORE_MS = 360_000;
export const SOLITAIRE_SPEED_ZERO_SCORE_RATIO = 2;

export type SolitairePlayScore = PlayScore<
  keyof typeof SOLITAIRE_SCORE_MAXIMUMS
>;

type SolitairePlayScoreInput = {
  elapsedMs: number;
  retractedMoveCount: number;
};

export function calculateSolitaireSpeedScoreRule(): SpeedScoreRule {
  return createSpeedScoreRule(
    SOLITAIRE_SPEED_FULL_SCORE_MS,
    SOLITAIRE_SPEED_ZERO_SCORE_RATIO,
  );
}

/** 基準時間に対するクリア時間の差。負なら基準より速い。 */
export function calculateSolitaireTimeDeltaMs(elapsedMs: number): number {
  return calculateTimeDeltaMs(elapsedMs, calculateSolitaireSpeedScoreRule());
}

export function calculateSolitairePlayScore({
  elapsedMs,
  retractedMoveCount,
}: SolitairePlayScoreInput): SolitairePlayScore {
  return sumPlayScore({
    stability: subtractWithFloor(
      SOLITAIRE_SCORE_MAXIMUMS.stability,
      retractedMoveCount * SOLITAIRE_RETRACTED_MOVE_PENALTY,
    ),
    speed: calculateSpeedScore(
      SOLITAIRE_SCORE_MAXIMUMS.speed,
      elapsedMs,
      calculateSolitaireSpeedScoreRule(),
    ),
  });
}
