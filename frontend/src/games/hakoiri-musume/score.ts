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

/**
 * よける駒と順を先に読み、少ない手数で娘を出口へ運ぶことを中心に称え、速さも見る。
 * 待った・盤面を戻すの回数は別に減点しない。取り消した手も指した手の数に残り、効率に表れるので二重に数えない。
 */
export const HAKOIRI_MUSUME_SCORE_MAXIMUMS = {
  efficiency: 70,
  speed: 30,
} as const satisfies ScoreMaximums<"efficiency" | "speed">;

/**
 * 効率の比の分子と分母に足すゆとりの手数。短い問題（最短8手前後）で、試しに動かした1手の重さを抑える。
 * 試し1手の減点は、丸める前で 70 ÷ (最短 + 6) 点。
 */
export const HAKOIRI_MUSUME_EFFICIENCY_SLACK_MOVES = 5;

/** 基準時間の係数。始めの盤面を見て、娘を通す道の見当をつける時間。 */
export const HAKOIRI_MUSUME_SPEED_READING_MS = 10_000;
/** 基準時間の係数。最短1手ごとの、駒を選んでなぞる時間。 */
export const HAKOIRI_MUSUME_SPEED_PER_OPTIMAL_MOVE_MS = 2_500;
/**
 * 基準時間の係数。準備の長さ1手ごとの、娘を進められないあいだによける駒と順を頭の中でつなぐ時間。
 * 準備の長い問題は、最短手数が同じでも1手ごとに先を読む時間が長い。
 */
export const HAKOIRI_MUSUME_SPEED_PER_PREPARATION_MOVE_MS = 2_500;
/**
 * 速さが0点になる時間の、基準時間に対する倍率。よける順を先に読む問題は読みの当たり外れで時間がぶれ、準備の長い問題ほど
 * 基準時間から離れやすいので、先を読む遊びの詰将棋・一筆書き・リフレクションと同じ3倍にする。基準時間の2倍で速さは半分残る。
 */
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

/**
 * 問題ごとの速さ満点の基準時間。最短手数と準備の長さという問題の作業の量だけから決め、難易度そのものは使わない。
 * 1 秒未満の端数は切り上げる。
 */
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

/** 基準時間に対するクリア時間の差。負なら基準より速い。 */
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

/**
 * 効率は「(最短手数 + ゆとり) ÷ (指した手の数 + ゆとり)」の比で評価する。最短手数で運んだときだけ満点で、
 * 大きく回り道するほど最短手数との比に近づいて下がる。待ったで取り消しても手は減らないので、試してから戻しても効率は上がらない。
 */
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
