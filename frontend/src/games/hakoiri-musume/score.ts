import type { HakoiriMusumeWorkload } from "@/games/hakoiri-musume/problem/problem-pool";
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

export const HAKOIRI_MUSUME_SCORE_MAXIMUMS = {
  efficiency: 70,
  speed: 30,
} as const satisfies ScoreMaximums<"efficiency" | "speed">;

/** 試し1手の減点は、丸める前で 70 ÷ (最短 + 6) 点。 */
export const HAKOIRI_MUSUME_EFFICIENCY_SLACK_MOVES = 5;

/** 始めの盤面を見て、娘を通す道の見当をつける時間。 */
export const HAKOIRI_MUSUME_SPEED_READING_MS = 10_000;
/** 駒を選んでなぞる時間。 */
export const HAKOIRI_MUSUME_SPEED_PER_OPTIMAL_MOVE_MS = 2_500;
/** 娘を進められないあいだに、よける駒と順を頭の中でつなぐ時間。 */
export const HAKOIRI_MUSUME_SPEED_PER_PREPARATION_MOVE_MS = 2_500;
/** 先を読む遊びの詰将棋・一筆書き・リフレクションと同じ倍率。基準時間の2倍で速さは半分残る。 */
export const HAKOIRI_MUSUME_SPEED_ZERO_SCORE_RATIO = 3;

export type HakoiriMusumePlayScore = PlayScore<
  keyof typeof HAKOIRI_MUSUME_SCORE_MAXIMUMS
>;

type HakoiriMusumeSpeedFullScoreInput = HakoiriMusumeWorkload;

type HakoiriMusumeTimeDeltaInput = HakoiriMusumeSpeedFullScoreInput & {
  elapsedMs: number;
};

type HakoiriMusumeMoveDeltaInput = {
  /** 指した手の数。待ったで取り消した手と、盤面を戻す前の手も含む。 */
  moveCount: number;
  optimalMoveCount: number;
};

type HakoiriMusumePlayScoreInput = HakoiriMusumeTimeDeltaInput &
  HakoiriMusumeMoveDeltaInput;

/** 基準時間を切り上げてそろえる単位。係数の 2.5 秒で 0.5 秒の端数が出るので、1 秒単位で見せる。 */
const HAKOIRI_MUSUME_SPEED_FULL_SCORE_STEP_MS = 1_000;

export function calculateHakoiriMusumeSpeedFullScoreMs({
  optimalMoveCount,
  preparationLength,
}: HakoiriMusumeSpeedFullScoreInput): number {
  const fullScoreMs =
    HAKOIRI_MUSUME_SPEED_READING_MS +
    Math.max(0, optimalMoveCount) * HAKOIRI_MUSUME_SPEED_PER_OPTIMAL_MOVE_MS +
    Math.max(0, preparationLength) *
      HAKOIRI_MUSUME_SPEED_PER_PREPARATION_MOVE_MS;
  return (
    Math.ceil(fullScoreMs / HAKOIRI_MUSUME_SPEED_FULL_SCORE_STEP_MS) *
    HAKOIRI_MUSUME_SPEED_FULL_SCORE_STEP_MS
  );
}

export function calculateHakoiriMusumeSpeedScoreRule(
  input: HakoiriMusumeSpeedFullScoreInput,
): SpeedScoreRule {
  return createSpeedScoreRule(
    calculateHakoiriMusumeSpeedFullScoreMs(input),
    HAKOIRI_MUSUME_SPEED_ZERO_SCORE_RATIO,
  );
}

/** 負なら基準より速い。 */
export function calculateHakoiriMusumeTimeDeltaMs({
  elapsedMs,
  ...input
}: HakoiriMusumeTimeDeltaInput): number {
  return calculateTimeDeltaMs(
    elapsedMs,
    calculateHakoiriMusumeSpeedScoreRule(input),
  );
}

export function calculateHakoiriMusumeMoveDelta({
  moveCount,
  optimalMoveCount,
}: HakoiriMusumeMoveDeltaInput): number {
  return moveCount - optimalMoveCount;
}

function calculateHakoiriMusumeEfficiencyScore({
  moveCount,
  optimalMoveCount,
}: HakoiriMusumeMoveDeltaInput): number {
  if (optimalMoveCount <= 0 || moveCount <= optimalMoveCount) {
    return HAKOIRI_MUSUME_SCORE_MAXIMUMS.efficiency;
  }

  return calculateLinearScore(
    HAKOIRI_MUSUME_SCORE_MAXIMUMS.efficiency,
    (optimalMoveCount + HAKOIRI_MUSUME_EFFICIENCY_SLACK_MOVES) /
      (moveCount + HAKOIRI_MUSUME_EFFICIENCY_SLACK_MOVES),
  );
}

export function calculateHakoiriMusumePlayScore({
  elapsedMs,
  moveCount,
  ...workload
}: HakoiriMusumePlayScoreInput): HakoiriMusumePlayScore {
  const { optimalMoveCount } = workload;
  const efficiency = calculateHakoiriMusumeEfficiencyScore({
    moveCount,
    optimalMoveCount,
  });
  const speed = calculateSpeedScore(
    HAKOIRI_MUSUME_SCORE_MAXIMUMS.speed,
    elapsedMs,
    calculateHakoiriMusumeSpeedScoreRule(workload),
  );

  return sumPlayScore({ efficiency, speed });
}
