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

/** 基準時間の係数。始めの盤面を見て、娘を通す道とよける駒の見当をつける時間。 */
export const HAKOIRI_MUSUME_SPEED_READING_MS = 15_000;
/** 基準時間の係数。最短1手ごとの、次によける駒を選んでなぞる時間。 */
export const HAKOIRI_MUSUME_SPEED_PER_OPTIMAL_MOVE_MS = 4_000;
/** 速さが0点になる時間の、基準時間に対する倍率。 */
export const HAKOIRI_MUSUME_SPEED_ZERO_SCORE_RATIO = 2;

export type HakoiriMusumePlayScore = PlayScore<
  keyof typeof HAKOIRI_MUSUME_SCORE_MAXIMUMS
>;

type HakoiriMusumeSpeedFullScoreInput = {
  optimalMoveCount: number;
};

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

/**
 * 問題ごとの速さ満点の基準時間。最短手数という問題の作業の量だけから決め、難易度そのものは使わない。
 * 最短手数は記録の事実に残るので、問題集から外れた記録でも求め直せる。
 */
export function calculateHakoiriMusumeSpeedFullScoreMs({
  optimalMoveCount,
}: HakoiriMusumeSpeedFullScoreInput): number {
  return (
    HAKOIRI_MUSUME_SPEED_READING_MS +
    Math.max(0, optimalMoveCount) * HAKOIRI_MUSUME_SPEED_PER_OPTIMAL_MOVE_MS
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
  optimalMoveCount,
}: HakoiriMusumePlayScoreInput): HakoiriMusumePlayScore {
  const efficiency = calculateHakoiriMusumeEfficiencyScore({
    moveCount,
    optimalMoveCount,
  });
  const speed = calculateSpeedScore(
    HAKOIRI_MUSUME_SCORE_MAXIMUMS.speed,
    elapsedMs,
    calculateHakoiriMusumeSpeedScoreRule({ optimalMoveCount }),
  );

  return sumPlayScore({ efficiency, speed });
}
