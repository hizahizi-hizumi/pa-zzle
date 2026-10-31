import type { IceFloorMazeBoardShape } from "@/games/ice-floor-maze/problem/problem";
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
 * 試し滑りをせず、最短の道筋で止めることを称える（評価案 A。配点は仮置き）。
 * 待った・盤面を戻すの回数は別に減点しない。取り消した手も総手数に残り、効率に表れるので二重に数えない。
 */
export const ICE_FLOOR_MAZE_SCORE_MAXIMUMS = {
  efficiency: 60,
  speed: 40,
} as const satisfies ScoreMaximums<"efficiency" | "speed">;

/**
 * 基準時間の係数（仮置き）。盤面1マスごとの把握の時間。
 * 広い盤面ほど止まり先が多く、各手で比べる範囲も広いので、盤面を読む時間をマス数に比例させる。
 * 8×8 で12.8秒、12×14 で33.6秒。
 */
export const ICE_FLOOR_MAZE_SPEED_PER_CELL_MS = 200;
/** 基準時間の係数（仮置き）。最短1手ごとの、止まる位置を確かめて滑らせる時間。 */
export const ICE_FLOOR_MAZE_SPEED_PER_OPTIMAL_MOVE_MS = 2_500;
/** 速さが0点になる時間の、基準時間に対する倍率。 */
export const ICE_FLOOR_MAZE_SPEED_ZERO_SCORE_RATIO = 2;

export type IceFloorMazePlayScore = PlayScore<
  keyof typeof ICE_FLOOR_MAZE_SCORE_MAXIMUMS
>;

type IceFloorMazeSpeedFullScoreInput = {
  boardShape: IceFloorMazeBoardShape;
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

export function countIceFloorMazeBoardCells({
  width,
  height,
}: IceFloorMazeBoardShape): number {
  return width * height;
}

/**
 * 問題ごとの速さ満点の基準時間。盤面のマス数と最短手数という、問題の作業の量だけから決め、難易度そのものは使わない。
 * 盤面の形は記録の identity から、最短手数は記録の事実から読めるので、問題集から外れた記録でも求め直せる。
 */
export function calculateIceFloorMazeSpeedFullScoreMs({
  boardShape,
  optimalMoveCount,
}: IceFloorMazeSpeedFullScoreInput): number {
  return (
    countIceFloorMazeBoardCells(boardShape) * ICE_FLOOR_MAZE_SPEED_PER_CELL_MS +
    Math.max(0, optimalMoveCount) * ICE_FLOOR_MAZE_SPEED_PER_OPTIMAL_MOVE_MS
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
 * 効率は「最短手数 ÷ 総手数」の比で評価し、最短の2倍の手数で半分の点にする。
 * 試し滑りはそのまま総手数に表れ、待ったで取り消しても手は減らないので、待ったを使った総当たりでは効率が上がらない。
 */
export function calculateIceFloorMazePlayScore({
  elapsedMs,
  moveCount,
  boardShape,
  optimalMoveCount,
}: IceFloorMazePlayScoreInput): IceFloorMazePlayScore {
  const efficiency =
    optimalMoveCount <= 0 || moveCount <= optimalMoveCount
      ? ICE_FLOOR_MAZE_SCORE_MAXIMUMS.efficiency
      : calculateLinearScore(
          ICE_FLOOR_MAZE_SCORE_MAXIMUMS.efficiency,
          optimalMoveCount / moveCount,
        );

  const speed = calculateSpeedScore(
    ICE_FLOOR_MAZE_SCORE_MAXIMUMS.speed,
    elapsedMs,
    calculateIceFloorMazeSpeedScoreRule({ boardShape, optimalMoveCount }),
  );

  return sumPlayScore({ efficiency, speed });
}
