/**
 * 完成演出の、島0 から橋をたどって島を順に膨らませる波。
 * 盤面の動きとクリア音が同じ時間割で揃うよう、ここに置いて両方から使う。
 */

import {
  type BridgesBoard,
  getBridgesNetwork,
} from "@/games/bridges/puzzle/board";
import type { BridgeCount } from "@/games/bridges/puzzle/state";

/** 隣の島へ波が渡る間隔。島の数の多い盤面でも波全体が長くなりすぎないよう、全体の長さは下の上限に収める。 */
const WAVE_STEP_MS = 90;
const WAVE_MAX_SPREAD_MS = 900;
/** 1つの島が膨らんで戻る時間。 */
export const ISLAND_POP_MS = 320;
/** 島が最も膨らむ時点の、膨らみ始めからの割合。 */
const ISLAND_POP_PEAK_OFFSET = 0.45;
export const islandPopKeyframes: Keyframe[] = [
  { transform: "scale(1)" },
  { transform: "scale(1.22)", offset: ISLAND_POP_PEAK_OFFSET },
  { transform: "scale(1)" },
];

/**
 * 島0 から架かった橋をたどったときの、島ごとの段数（島0 が 0）。たどれない島は `null`。
 * クリアした盤面では全島がつながっているので、波が全島に渡る。
 */
export function listClearWaveDepths(
  board: BridgesBoard,
  bridges: readonly BridgeCount[],
): (number | null)[] {
  const { edges, islandEdges } = getBridgesNetwork(board);
  const depths: (number | null)[] = board.islands.map(() => null);
  depths[0] = 0;
  const queue = [0];
  for (let head = 0; head < queue.length; head += 1) {
    const island = queue[head]!;
    for (const edge of islandEdges[island]!) {
      const { from, to } = edges[edge]!;
      const other = from === island ? to : from;
      if (bridges[edge] !== 0 && depths[other] === null) {
        depths[other] = depths[island]! + 1;
        queue.push(other);
      }
    }
  }
  return depths;
}

/** 隣の島へ波が渡る間隔。波全体が上限に収まるよう、段の多い盤面では縮める。 */
export function getClearWaveStepMs(deepest: number): number {
  return Math.min(WAVE_STEP_MS, WAVE_MAX_SPREAD_MS / Math.max(1, deepest));
}

/**
 * 波の時間の区切り。
 * - `lastPopStartMs`: 最も遠い島が膨らみ始めるまでの時間。
 * - `lastPopPeakMs`: 最も遠い島が最も膨らむまでの時間。全島がつながったことが見え切る時点。
 */
export function getClearWaveTiming(
  board: BridgesBoard,
  bridges: readonly BridgeCount[],
): { lastPopStartMs: number; lastPopPeakMs: number } {
  const deepest = Math.max(
    0,
    ...listClearWaveDepths(board, bridges).map((depth) => depth ?? 0),
  );
  const lastPopStartMs = deepest * getClearWaveStepMs(deepest);
  return {
    lastPopStartMs,
    lastPopPeakMs: lastPopStartMs + ISLAND_POP_MS * ISLAND_POP_PEAK_OFFSET,
  };
}
