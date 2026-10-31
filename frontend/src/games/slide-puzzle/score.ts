import {
  calculateLinearScore,
  calculateSpeedScore,
  calculateTimeDeltaMs,
  createSpeedScoreRule,
  type PlayScore,
  type ScoreMaximums,
  type SpeedScoreRule,
  sumPlayScore,
} from "@/games/score";
import type { SlidePuzzleBoardSize } from "@/games/slide-puzzle/puzzle/state";

export const SLIDE_PUZZLE_SCORE_MAXIMUMS = {
  efficiency: 60,
  speed: 40,
} as const satisfies ScoreMaximums<"efficiency" | "speed">;

/**
 * 基準時間のうち盤面把握にあてる時間。盤面が大きいほど把握に掛かるとみなし、
 * タイル数にほぼ比例させる（1 タイルあたり約 0.6 秒）。実プレイで校正する前の仮値。
 */
export const slidePuzzleSpeedInitialRecognitionMsByBoardSize: Record<
  SlidePuzzleBoardSize,
  number
> = {
  3: 5_000,
  4: 10_000,
  5: 15_000,
};
/** 基準時間のうち最短 1 手あたりの時間。盤面サイズによらず共通の仮値。 */
export const SLIDE_PUZZLE_SPEED_PER_OPTIMAL_MOVE_MS = 2_000;
/** 速さが0点になる時間の、基準時間に対する倍率。 */
export const SLIDE_PUZZLE_SPEED_ZERO_SCORE_RATIO = 2;

export type SlidePuzzlePlayScore = PlayScore<
  keyof typeof SLIDE_PUZZLE_SCORE_MAXIMUMS
>;

type SlidePuzzleSpeedFullScoreInput = {
  boardSize: SlidePuzzleBoardSize;
  optimalMoveCount: number;
};

type SlidePuzzleTimeDeltaInput = SlidePuzzleSpeedFullScoreInput & {
  elapsedMs: number;
};

type SlidePuzzleMoveDeltaInput = {
  /** 盤面を戻す前の手も含む、動いたタイルの総枚数。 */
  moveCount: number;
  optimalMoveCount: number;
};

type SlidePuzzlePlayScoreInput = SlidePuzzleTimeDeltaInput &
  SlidePuzzleMoveDeltaInput;

export function calculateSlidePuzzleSpeedFullScoreMs({
  boardSize,
  optimalMoveCount,
}: SlidePuzzleSpeedFullScoreInput): number {
  return (
    slidePuzzleSpeedInitialRecognitionMsByBoardSize[boardSize] +
    Math.max(0, optimalMoveCount) * SLIDE_PUZZLE_SPEED_PER_OPTIMAL_MOVE_MS
  );
}

export function calculateSlidePuzzleSpeedScoreRule(
  input: SlidePuzzleSpeedFullScoreInput,
): SpeedScoreRule {
  return createSpeedScoreRule(
    calculateSlidePuzzleSpeedFullScoreMs(input),
    SLIDE_PUZZLE_SPEED_ZERO_SCORE_RATIO,
  );
}

export function calculateSlidePuzzleTimeDeltaMs({
  elapsedMs,
  ...input
}: SlidePuzzleTimeDeltaInput): number {
  return calculateTimeDeltaMs(
    elapsedMs,
    calculateSlidePuzzleSpeedScoreRule(input),
  );
}

export function calculateSlidePuzzleMoveDelta({
  moveCount,
  optimalMoveCount,
}: SlidePuzzleMoveDeltaInput): number {
  return moveCount - optimalMoveCount;
}

/**
 * 効率は「最短手数 ÷ 総手数」の比で評価する。人の手数は最短の数倍になりやすく、
 * 超過分で線形に減らすと中位の上達差が 0 点に潰れるため。
 * 総手数は盤面を戻す前の手も含むので、盤面を戻した回数を別に減点しない。
 */
export function calculateSlidePuzzlePlayScore({
  elapsedMs,
  moveCount,
  boardSize,
  optimalMoveCount,
}: SlidePuzzlePlayScoreInput): SlidePuzzlePlayScore {
  const efficiency =
    optimalMoveCount <= 0 || moveCount <= optimalMoveCount
      ? SLIDE_PUZZLE_SCORE_MAXIMUMS.efficiency
      : calculateLinearScore(
          SLIDE_PUZZLE_SCORE_MAXIMUMS.efficiency,
          optimalMoveCount / moveCount,
        );

  const speed = calculateSpeedScore(
    SLIDE_PUZZLE_SCORE_MAXIMUMS.speed,
    elapsedMs,
    calculateSlidePuzzleSpeedScoreRule({ boardSize, optimalMoveCount }),
  );

  return sumPlayScore({ efficiency, speed });
}
