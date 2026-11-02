import type { BridgesDifficulty } from "@/games/bridges/difficulty";
import {
  assertBridgesProblem,
  type BRIDGES_GENERATOR_VERSION,
  type BridgesIdentifiedProblem,
  type BridgesProblem,
  type BridgesProblemIdentity,
  createBridgesProblemIdentity,
  isBridgesGenerationConditions,
} from "@/games/bridges/problem/problem";
import problemPoolJson from "@/games/bridges/problem/problem-pool.json";
import type { BridgesBoard, BridgesIsland } from "@/games/bridges/puzzle/board";
import { createProblemPoolIndex, type ProblemId } from "@/games/problem-id";

/**
 * 事前生成した問題集の1問。解の橋は持たない。
 * - `size`・`densityPercent`・`doubleBridgePercent`・`extraBridgePercent`・`candidateIndex` から
 *   `createBridgesProblemIdentity` で identity を再構成する。割合は百分率の整数。
 * - `encodedIslands`（`encodeBridgesPoolIslands`）と `clues`（島の数字を行優先に並べた数字の列）で盤面を表す。
 *   実行時に生成器・解法器を呼ばずに問題を復元するため、生成結果そのものを持つ。
 * - 残りは生成時の分析結果（`BridgesPoolAnalysis`）。プレイ時に解法器を動かさずに済むよう、問題集に持たせる。
 */
export type BridgesProblemPoolEntry = readonly [
  size: number,
  densityPercent: number,
  doubleBridgePercent: number,
  extraBridgePercent: number,
  candidateIndex: number,
  encodedIslands: string,
  clues: string,
  countRoundCount: number,
  connectivityRoundCount: number,
  countReasoningUndecidedEdgeCount: number,
  trialBacktrackCount: number,
];

/**
 * 問題集が持つ、生成時の分析結果。意味は `BridgesReasoningFeatures`・`BridgesTrialFeatures` の同名の値。
 * `countReasoningUndecidedEdgeCount` は、数字の読みだけでは本数が決まらない行き先の数。
 */
export type BridgesPoolAnalysis = {
  countRoundCount: number;
  connectivityRoundCount: number;
  countReasoningUndecidedEdgeCount: number;
  trialBacktrackCount: number;
};

/** 問題集から復元した1問。生成時の分析結果を伴う。 */
export type BridgesPooledProblem = BridgesIdentifiedProblem & {
  analysis: BridgesPoolAnalysis;
};

export type BridgesProblemPool = {
  generatorVersion: typeof BRIDGES_GENERATOR_VERSION;
  levels: Record<BridgesDifficulty, readonly BridgesProblemPoolEntry[]>;
};

const problemPool = problemPoolJson as unknown as BridgesProblemPool;

const bitsPerHexDigit = 4;

function countIslandHexDigits(size: number): number {
  return Math.ceil((size * size) / bitsPerHexDigit);
}

/**
 * 島のあるマスを、盤面の全マス（行優先）の順のビット列（島なら 1）にして16進で表す。先頭のビットを最上位にし、末尾は 0 で埋める。
 * 例: 10×10 は 100 ビットで 25 桁。
 */
export function encodeBridgesPoolIslands(board: BridgesBoard): string {
  const occupied = new Set(
    board.islands.map(({ row, column }) => row * board.width + column),
  );
  let encoded = "";
  for (
    let offset = 0;
    offset < board.width * board.height;
    offset += bitsPerHexDigit
  ) {
    let digit = 0;
    for (let bit = 0; bit < bitsPerHexDigit; bit += 1) {
      digit = (digit << 1) | (occupied.has(offset + bit) ? 1 : 0);
    }
    encoded += digit.toString(16);
  }
  return encoded;
}

/** 島の数字を、行優先の島の順に1文字ずつ並べる。 */
export function encodeBridgesPoolClues(board: BridgesBoard): string {
  return board.islands.map(({ clue }) => String(clue)).join("");
}

/** `encodeBridgesPoolIslands` と `encodeBridgesPoolClues` で表した正方形の盤面から問題を作り、形を確かめる。 */
export function decodeBridgesPoolProblem(
  size: number,
  encodedIslands: string,
  clues: string,
): BridgesProblem {
  if (
    !/^[0-9a-f]+$/.test(encodedIslands) ||
    encodedIslands.length !== countIslandHexDigits(size)
  ) {
    throw new RangeError(
      `Bridges pool islands must be ${countIslandHexDigits(size)} lowercase hex digits`,
    );
  }
  const cells = Array.from(encodedIslands).flatMap((character) => {
    const digit = Number.parseInt(character, 16);
    return Array.from(
      { length: bitsPerHexDigit },
      (_, bit) => ((digit >> (bitsPerHexDigit - 1 - bit)) & 1) === 1,
    );
  });
  if (cells.slice(size * size).some(Boolean)) {
    throw new RangeError("Bridges pool islands have padding bits");
  }
  const positions = cells.flatMap((occupied, cell) => (occupied ? [cell] : []));
  if (!/^[1-8]*$/.test(clues) || clues.length !== positions.length) {
    throw new RangeError("Bridges pool clues must be one digit per island");
  }
  const islands: BridgesIsland[] = positions.map((cell, index) => ({
    row: Math.floor(cell / size),
    column: cell % size,
    clue: Number(clues[index]),
  }));
  const problem: BridgesProblem = { width: size, height: size, islands };
  assertBridgesProblem(problem);
  return problem;
}

export function toBridgesPoolIdentity([
  size,
  densityPercent,
  doubleBridgePercent,
  extraBridgePercent,
  candidateIndex,
]: BridgesProblemPoolEntry): BridgesProblemIdentity {
  const conditions = {
    size,
    islandDensity: densityPercent / 100,
    doubleBridgeRate: doubleBridgePercent / 100,
    extraBridgeRate: extraBridgePercent / 100,
  };
  if (!isBridgesGenerationConditions(conditions)) {
    throw new RangeError(
      `Unsupported Bridges generation conditions: ${JSON.stringify(conditions)}`,
    );
  }
  return createBridgesProblemIdentity(conditions, candidateIndex);
}

export function toBridgesPoolAnalysis(
  entry: BridgesProblemPoolEntry,
): BridgesPoolAnalysis {
  const [
    ,
    ,
    ,
    ,
    ,
    ,
    ,
    countRoundCount,
    connectivityRoundCount,
    countReasoningUndecidedEdgeCount,
    trialBacktrackCount,
  ] = entry;
  return {
    countRoundCount,
    connectivityRoundCount,
    countReasoningUndecidedEdgeCount,
    trialBacktrackCount,
  };
}

export function toBridgesPooledProblem(
  entry: BridgesProblemPoolEntry,
): BridgesPooledProblem {
  const [size, , , , , encodedIslands, clues] = entry;
  return {
    problem: decodeBridgesPoolProblem(size, encodedIslands, clues),
    identity: toBridgesPoolIdentity(entry),
    analysis: toBridgesPoolAnalysis(entry),
  };
}

export function listBridgesPoolEntries(
  difficulty: BridgesDifficulty,
): readonly BridgesProblemPoolEntry[] {
  return problemPool.levels[difficulty];
}

const poolIndex = createProblemPoolIndex(
  problemPool.levels,
  toBridgesPoolIdentity,
);

/** 難易度の問題集から問題 ID で1問を探す。問題集に無い ID・別の難易度の ID には `null` を返す。 */
export function findBridgesPoolEntryByProblemId(
  difficulty: BridgesDifficulty,
  problemId: string,
): BridgesProblemPoolEntry | null {
  return poolIndex.findPositionById(difficulty, problemId)?.entry ?? null;
}

let entriesBySeed: ReadonlyMap<string, BridgesProblemPoolEntry> | undefined;

/** identity に一致する問題集の1問を探す。生成器の版や条件が違う identity・問題集に無い identity には `null` を返す。 */
export function findBridgesPoolEntry(
  identity: BridgesProblemIdentity,
): BridgesProblemPoolEntry | null {
  if (identity.generatorVersion !== problemPool.generatorVersion) {
    return null;
  }
  entriesBySeed ??= new Map(
    Object.values(problemPool.levels)
      .flat()
      .map((entry) => [toBridgesPoolIdentity(entry).seed, entry]),
  );
  return entriesBySeed.get(identity.seed) ?? null;
}

/** 難易度の問題集の全問の問題 ID を、問題集の並び順で返す。 */
export function listBridgesPoolProblemIds(
  difficulty: BridgesDifficulty,
): readonly ProblemId[] {
  return poolIndex.listProblemIds(difficulty);
}
