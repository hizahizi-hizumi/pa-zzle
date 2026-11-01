import type { NonogramSolveWorkload } from "@/games/nonogram/problem/problem";
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

/**
 * ヒントから読んで確定させてから塗り、迷わず速く図柄を完成させることを称える。
 * 速さを主にし、塗り直しを軽く減らす。× はメモなので付け外しを減点せず、待ったと盤面を戻すも減点しない
 * （待ったで戻した塗りは塗り直しに数えるので、待ったの回数でさらに減らさない）。
 */
export const NONOGRAM_SCORE_MAXIMUMS = {
  speed: 85,
  accuracy: 15,
} as const satisfies ScoreMaximums<"speed" | "accuracy">;

/**
 * 塗り直したマス1つごとの正確さの減点。5マスで正確さが0点になる。
 * 押し間違いを1マス直しただけなら、基準時間の1.15倍ほどまでに解けば great に残る。
 */
export const NONOGRAM_REPAINT_PENALTY = 3;

/** 盤面とヒント全体を見渡す時間。 */
export const NONOGRAM_SPEED_INITIAL_RECOGNITION_MS = 10_000;
/** 行・列1本のヒントに目を移して読み始める時間。ヒントの数字の数によらない。 */
export const NONOGRAM_SPEED_PER_LINE_MS = 1_000;
/** ヒントの数字1つ（行・列の黒の塊1つ）を、その行・列の決まったマスと突き合わせて読む時間。 */
export const NONOGRAM_SPEED_PER_BLOCK_MS = 500;
/** 塗るマス1つを確かめて塗る時間。 */
export const NONOGRAM_SPEED_PER_FILLED_CELL_MS = 750;
/** 決まったマスを使って次に読める行・列を探す、連鎖の1段ごとの時間。 */
export const NONOGRAM_SPEED_PER_ROUND_MS = 4_000;

/**
 * 速さが0点になる時間の、基準時間に対する倍率。
 * 速さを主にするゲームなので、塗り直しなしなら基準時間の1.2倍ほどまでで great、1.4倍ほどまでで good に残る傾きにする。
 */
export const NONOGRAM_SPEED_ZERO_SCORE_RATIO = 3;

export type NonogramPlayScore = PlayScore<keyof typeof NONOGRAM_SCORE_MAXIMUMS>;

type NonogramTimeDeltaInput = {
  elapsedMs: number;
  workload: NonogramSolveWorkload;
};

type NonogramPlayScoreInput = NonogramTimeDeltaInput & {
  repaintCount: number;
};

/** ヒントを読む行と列の本数。 */
export function countNonogramLines({
  width,
  height,
}: Pick<NonogramSolveWorkload, "width" | "height">): number {
  return width + height;
}

/**
 * 問題ごとの速さ満点の基準時間。
 * 盤面把握の時間に、読む行・列の数、ヒントの数字の数、塗るマスの数、連鎖の段の数に応じた時間を足す。
 * 問題を解き切る作業の量だけから決め、難易度そのものは使わない。
 * 係数は、問題集のどのレベルでも、どの項も中央値で基準時間の4割以下・最大で5割以下になり、
 * 塗る操作だけにかかる時間（塊ごとに1回のドラッグ）が中央値で基準時間の15%以下に収まるように決める。
 */
export function calculateNonogramSpeedFullScoreMs(
  workload: NonogramSolveWorkload,
): number {
  return (
    NONOGRAM_SPEED_INITIAL_RECOGNITION_MS +
    countNonogramLines(workload) * NONOGRAM_SPEED_PER_LINE_MS +
    workload.blockCount * NONOGRAM_SPEED_PER_BLOCK_MS +
    workload.filledCellCount * NONOGRAM_SPEED_PER_FILLED_CELL_MS +
    workload.roundCount * NONOGRAM_SPEED_PER_ROUND_MS
  );
}

export function calculateNonogramSpeedScoreRule(
  workload: NonogramSolveWorkload,
): SpeedScoreRule {
  return createSpeedScoreRule(
    calculateNonogramSpeedFullScoreMs(workload),
    NONOGRAM_SPEED_ZERO_SCORE_RATIO,
  );
}

/** 基準時間に対するクリア時間の差。負なら基準より速い。 */
export function calculateNonogramTimeDeltaMs({
  elapsedMs,
  workload,
}: NonogramTimeDeltaInput): number {
  return calculateTimeDeltaMs(
    elapsedMs,
    calculateNonogramSpeedScoreRule(workload),
  );
}

/** 正確さは塗り直したマスの数だけで減点する。解との照合は使わない。 */
export function calculateNonogramPlayScore({
  elapsedMs,
  repaintCount,
  workload,
}: NonogramPlayScoreInput): NonogramPlayScore {
  const speed = calculateSpeedScore(
    NONOGRAM_SCORE_MAXIMUMS.speed,
    elapsedMs,
    calculateNonogramSpeedScoreRule(workload),
  );
  const accuracy = subtractWithFloor(
    NONOGRAM_SCORE_MAXIMUMS.accuracy,
    repaintCount * NONOGRAM_REPAINT_PENALTY,
  );

  return sumPlayScore({ speed, accuracy });
}
