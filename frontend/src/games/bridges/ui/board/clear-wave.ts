import {
  type BridgesBoard,
  getBridgesNetwork,
} from "@/games/bridges/puzzle/board";
import type { BridgeCount } from "@/games/bridges/puzzle/state";
import { getBridgeExtendMs } from "@/games/bridges/ui/board/bridge-extend";

/** 着いた音と最初の鐘を聞き分けられるだけ離す。 */
const CLEAR_START_AFTER_LANDING_MS = 40;
/** 最後に架けた橋が分からない（盤面を戻した後など）ときの、島0 が弾み始めるまでの間。 */
const CLEAR_START_WITHOUT_ORIGIN_MS = 80;

/**
 * 光が1本の橋を渡り、隣の段の島に着くまでの時間。島から島へ順に渡るのが目で追える遅さにし、段の多い盤面では、
 * 光が全部の島に届くまでを下の上限に収めて、最後の手から結果へ移るまでをほかのゲームの完成演出の長さに収める。
 */
const WAVE_STEP_MS = 120;
const WAVE_MAX_SPREAD_MS = 720;
export const ISLAND_POP_MS = 360;
const ISLAND_POP_PEAK_OFFSET = 0.4;
export const islandPopKeyframes: Keyframe[] = [
  { transform: "scale(1)" },
  { transform: "scale(1.14)", offset: ISLAND_POP_PEAK_OFFSET },
  { transform: "scale(1)" },
];

/**
 * 最後に架けた橋 `originEdge` の両端の島から、架かった橋をたどったときの、島ごとの段数（両端の島が 0）。たどれない島は `null`。
 * クリアした盤面では全島がつながっているので、光が全島に届く。
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

export function getClearWaveStepMs(deepest: number): number {
  return Math.min(WAVE_STEP_MS, WAVE_MAX_SPREAD_MS / Math.max(1, deepest));
}

/**
 * 演出の時間割。どれも演出の始まり（最後の手）からの時間。
 * - `depthStartMs`: 段ごとの、その段の島に光が着いて島が弾み始める時間。添字が段数。段 d から段 d+1 への橋は、
 *   `depthStartMs[d]` から `depthStartMs[d + 1]` までの `stepMs` で光が渡る。
 * - `allLitMs`: 最も遠い島が最も膨らみ、全部の島に光が届いたと見える時間。演出の山で、締めの音をここで鳴らす。
 */
export type ClearWaveTiming = {
  depthStartMs: readonly number[];
  stepMs: number;
  allLitMs: number;
};

/** 盤面の動きとクリア音が同じ時間割で揃うよう、ここに置いて両方から使う。 */
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
  const startMs =
    originEdge === null
      ? CLEAR_START_WITHOUT_ORIGIN_MS
      : getBridgeExtendMs(board, originEdge) + CLEAR_START_AFTER_LANDING_MS;
  const depthStartMs = Array.from(
    { length: deepest + 1 },
    (_, depth) => startMs + depth * stepMs,
  );
  return {
    depthStartMs,
    stepMs,
    allLitMs: depthStartMs[deepest]! + ISLAND_POP_MS * ISLAND_POP_PEAK_OFFSET,
  };
}
