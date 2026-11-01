import {
  countIceFloorMazeRecordedDrawnCells,
  countIceFloorMazeRecordedElements,
  type IceFloorMazeRecordedProblemIdentity,
} from "@/games/ice-floor-maze/problem/problem";
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
 * 試し滑りをせず、最短の道筋で止めることを称える（評価案 A の配点。仮置き）。
 * 待った・盤面を戻すの回数は別に減点しない。取り消した手も総手数に残り、効率に表れるので二重に数えない。
 */
export const ICE_FLOOR_MAZE_SCORE_MAXIMUMS = {
  efficiency: 60,
  speed: 40,
} as const satisfies ScoreMaximums<"efficiency" | "speed">;

/**
 * 効率の比の分子と分母に足すゆとりの手数（仮置き）。短い問題で試し滑り1回の重さを抑える。
 * 試し1回の減点は、丸める前で 60 ÷ (最短 + 11) 点。最短10手前後の問題の長さに揃えた。
 */
export const ICE_FLOOR_MAZE_EFFICIENCY_SLACK_MOVES = 10;

/**
 * 基準時間の係数（仮置き）。盤面として描くマス1つごとの把握の時間。
 * 広い盤面ほど止まり先が多く、各手で比べる範囲も広いので、盤面を読む時間をマス数に比例させる。
 */
export const ICE_FLOOR_MAZE_SPEED_PER_CELL_MS = 200;
/** 基準時間の係数（仮置き）。最短1手ごとの、止まる位置を確かめて滑らせる時間。 */
export const ICE_FLOOR_MAZE_SPEED_PER_OPTIMAL_MOVE_MS = 2_500;
/**
 * 基準時間の係数（仮置き）。初期盤面の要素（もろい岩・薄い氷）1つごとの、崩れる・割れる後の盤面と使う順序を読む時間。
 * 要素つきの問題は、最短手数が同じでも、初期盤面のとおりに読めないぶん1手あたりの読みが長い。
 */
export const ICE_FLOOR_MAZE_SPEED_PER_ELEMENT_MS = 8_000;
/** 速さが0点になる時間の、基準時間に対する倍率。 */
export const ICE_FLOOR_MAZE_SPEED_ZERO_SCORE_RATIO = 2;

export type IceFloorMazePlayScore = PlayScore<
  keyof typeof ICE_FLOOR_MAZE_SCORE_MAXIMUMS
>;

/** 基準時間に使う盤面の量。記録の identity から求め直せる。 */
export type IceFloorMazeSpeedReference = {
  /** 盤面として描くマスの数。盤面の外を除く。 */
  drawnCellCount: number;
  /** 初期盤面の要素（もろい岩・薄い氷）の数。 */
  elementCount: number;
};

type IceFloorMazeSpeedFullScoreInput = {
  speedReference: IceFloorMazeSpeedReference;
  optimalMoveCount: number;
};

type IceFloorMazeTimeDeltaInput = IceFloorMazeSpeedFullScoreInput & {
  elapsedMs: number;
};

type IceFloorMazeMoveDeltaInput = {
  /** 成立した滑りの総数。待ったで取り消した手と、盤面を戻す前の手も含む。 */
  moveCount: number;
  optimalMoveCount: number;
};

type IceFloorMazePlayScoreInput = IceFloorMazeTimeDeltaInput &
  IceFloorMazeMoveDeltaInput;

/**
 * 問題の identity から基準時間に使う盤面の量を求める。今の版は seed の盤面から数え、
 * 盤面の外も要素も持たない初期版（版 `"1"`）などは、幅 × 高さのマスと要素0とする。
 */
export function getIceFloorMazeSpeedReference(
  identity: IceFloorMazeRecordedProblemIdentity,
): IceFloorMazeSpeedReference {
  return {
    drawnCellCount: countIceFloorMazeRecordedDrawnCells(identity),
    elementCount: countIceFloorMazeRecordedElements(identity),
  };
}

/**
 * 問題ごとの速さ満点の基準時間。描くマスの数・要素の数・最短手数という、問題の作業の量だけから決め、難易度そのものは使わない。
 * 盤面の量は記録の identity から、最短手数は記録の事実から読めるので、問題集から外れた記録でも求め直せる。
 */
export function calculateIceFloorMazeSpeedFullScoreMs({
  speedReference: { drawnCellCount, elementCount },
  optimalMoveCount,
}: IceFloorMazeSpeedFullScoreInput): number {
  return (
    Math.max(0, drawnCellCount) * ICE_FLOOR_MAZE_SPEED_PER_CELL_MS +
    Math.max(0, optimalMoveCount) * ICE_FLOOR_MAZE_SPEED_PER_OPTIMAL_MOVE_MS +
    Math.max(0, elementCount) * ICE_FLOOR_MAZE_SPEED_PER_ELEMENT_MS
  );
}

export function calculateIceFloorMazeSpeedScoreRule(
  input: IceFloorMazeSpeedFullScoreInput,
): SpeedScoreRule {
  return createSpeedScoreRule(
    calculateIceFloorMazeSpeedFullScoreMs(input),
    ICE_FLOOR_MAZE_SPEED_ZERO_SCORE_RATIO,
  );
}

/** 基準時間に対するクリア時間の差。負なら基準より速い。 */
export function calculateIceFloorMazeTimeDeltaMs({
  elapsedMs,
  ...input
}: IceFloorMazeTimeDeltaInput): number {
  return calculateTimeDeltaMs(
    elapsedMs,
    calculateIceFloorMazeSpeedScoreRule(input),
  );
}

export function calculateIceFloorMazeMoveDelta({
  moveCount,
  optimalMoveCount,
}: IceFloorMazeMoveDeltaInput): number {
  return moveCount - optimalMoveCount;
}

/**
 * 効率は「(最短手数 + ゆとり) ÷ (総手数 + ゆとり)」の比で評価する。総手数が最短手数のときだけ満点で、
 * 短い問題でも試し1回の減点は小さく、大きな試行錯誤では最短手数との比に近づいて下がる。
 * 試し滑りはそのまま総手数に表れ、待ったで取り消しても手は減らないので、待ったを使った総当たりでは効率が上がらない。
 */
function calculateIceFloorMazeEfficiencyScore({
  moveCount,
  optimalMoveCount,
}: IceFloorMazeMoveDeltaInput): number {
  if (optimalMoveCount <= 0 || moveCount <= optimalMoveCount) {
    return ICE_FLOOR_MAZE_SCORE_MAXIMUMS.efficiency;
  }

  return calculateLinearScore(
    ICE_FLOOR_MAZE_SCORE_MAXIMUMS.efficiency,
    (optimalMoveCount + ICE_FLOOR_MAZE_EFFICIENCY_SLACK_MOVES) /
      (moveCount + ICE_FLOOR_MAZE_EFFICIENCY_SLACK_MOVES),
  );
}

export function calculateIceFloorMazePlayScore({
  elapsedMs,
  moveCount,
  speedReference,
  optimalMoveCount,
}: IceFloorMazePlayScoreInput): IceFloorMazePlayScore {
  const efficiency = calculateIceFloorMazeEfficiencyScore({
    moveCount,
    optimalMoveCount,
  });
  const speed = calculateSpeedScore(
    ICE_FLOOR_MAZE_SCORE_MAXIMUMS.speed,
    elapsedMs,
    calculateIceFloorMazeSpeedScoreRule({ speedReference, optimalMoveCount }),
  );

  return sumPlayScore({ efficiency, speed });
}
