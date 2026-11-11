/**
 * 完成演出の時間割。最後に架けた橋の両端の島から架かった橋をたどって、たどり着いた段ごとに島を灯し、最後の島が灯り切ったときに
 * 締めの音を鳴らす。
 * 盤面の動きとクリア音が同じ時間割で揃うよう、ここに置いて両方から使う。
 */

import {
  type BridgesBoard,
  getBridgesNetwork,
} from "@/games/bridges/puzzle/board";
import type { BridgeCount } from "@/games/bridges/puzzle/state";

/** 最後に架けた橋の両端の島が灯り始めるまでの間。最後に架けた板が着いた盤面を一瞬見せる。 */
export const CLEAR_LIGHT_START_MS = 80;

/**
 * 隣の段の島が灯るまでの間隔。最後の手から結果へ移るまでを、ほかのゲームの完成演出の長さに近づけるよう、灯りが渡り切るまでを
 * 下の上限に収める。
 */
const WAVE_STEP_MS = 70;
const WAVE_MAX_SPREAD_MS = 380;
/** 1つの島が灯って膨らみ、戻る時間。 */
export const ISLAND_POP_MS = 360;
/** 島が最も膨らむ時点の、膨らみ始めからの割合。 */
const ISLAND_POP_PEAK_OFFSET = 0.4;
export const islandPopKeyframes: Keyframe[] = [
  { transform: "scale(1)" },
  { transform: "scale(1.14)", offset: ISLAND_POP_PEAK_OFFSET },
  { transform: "scale(1)" },
];

/**
 * 最後に架けた橋 `originEdge` の両端の島から、架かった橋をたどったときの、島ごとの段数（両端の島が 0）。たどれない島は `null`。
 * `originEdge` が無ければ島0 から数える。クリアした盤面では全島がつながっているので、灯りが全島に届く。
 */
export function listClearWaveDepths(
  board: BridgesBoard,
  bridges: readonly BridgeCount[],
  originEdge: number | null = null,
): (number | null)[] {
  const { edges, islandEdges } = getBridgesNetwork(board);
  const origin = originEdge === null ? undefined : edges[originEdge];
  const queue = origin === undefined ? [0] : [origin.from, origin.to];
  const depths: (number | null)[] = board.islands.map(() => null);
  for (const island of queue) {
    depths[island] = 0;
  }
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

/** 隣の段の島が灯るまでの間隔。灯り切るまでが上限に収まるよう、段の多い盤面では縮める。 */
export function getClearWaveStepMs(deepest: number): number {
  return Math.min(WAVE_STEP_MS, WAVE_MAX_SPREAD_MS / Math.max(1, deepest));
}

/**
 * 演出の時間割。どれも演出の始まりからの時間。
 * - `depthStartMs`: 段ごとの、その段の島が灯り始める時間。添字が段数。
 * - `allLitMs`: 最も遠い島が最も膨らみ、全島が灯り切ったと見える時間。
 */
export type ClearWaveTiming = {
  depthStartMs: readonly number[];
  allLitMs: number;
};

export function getClearWaveTiming(
  board: BridgesBoard,
  bridges: readonly BridgeCount[],
  originEdge: number | null = null,
): ClearWaveTiming {
  const deepest = Math.max(
    0,
    ...listClearWaveDepths(board, bridges, originEdge).map(
      (depth) => depth ?? 0,
    ),
  );
  const stepMs = getClearWaveStepMs(deepest);
  const depthStartMs = Array.from(
    { length: deepest + 1 },
    (_, depth) => CLEAR_LIGHT_START_MS + depth * stepMs,
  );
  return {
    depthStartMs,
    allLitMs: depthStartMs[deepest]! + ISLAND_POP_MS * ISLAND_POP_PEAK_OFFSET,
  };
}
