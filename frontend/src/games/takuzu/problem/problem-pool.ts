import type { TakuzuDifficulty } from "@/games/takuzu/difficulty";
import type { TakuzuTechnique } from "@/games/takuzu/problem/generation/human-solver";
import {
  assertTakuzuProblem,
  createTakuzuProblemIdentity,
  TAKUZU_BOARD_SIZE,
  type TAKUZU_GENERATOR_VERSION,
  type TakuzuIdentifiedProblem,
  type TakuzuProblem,
  type TakuzuProblemIdentity,
  type TakuzuSolveWorkload,
} from "@/games/takuzu/problem/problem";
import problemPoolJson from "@/games/takuzu/problem/problem-pool.json";
import type { TakuzuCell, TakuzuTile } from "@/games/takuzu/puzzle/board";

/** 問題集で使う手筋の上限の1文字表記。前提調査・難易度文書の A〜E に合わせる。 */
const removalTechniqueLimitByCode = {
  A: "adjacency",
  B: "count-completion",
  C: "single-remaining",
  D: "duplicate-avoidance",
  E: "general-line",
} as const satisfies Record<string, TakuzuTechnique>;

export type TakuzuRemovalTechniqueLimitCode =
  keyof typeof removalTechniqueLimitByCode;

/**
 * 事前生成した問題集の1問。
 * - 生成条件（手筋の上限・戻す数）と候補番号から `createTakuzuProblemIdentity` で identity を再構成する。
 * - `encodedProblem` は解と初期配置を16進で並べた32文字（`encodeTakuzuPoolProblem`）。
 *   実行時に生成器・解探索を呼ばずに問題を復元するため、生成結果そのものを持つ。
 * - `roundCount` / `lineReadingRoundCount` は生成時の分析結果（`TakuzuSolveWorkload`）。
 *   速さの基準時間に使う。プレイ時に解法器を動かさずに済むよう、問題集に持たせる。
 */
export type TakuzuProblemPoolEntry = readonly [
  removalTechniqueLimitCode: TakuzuRemovalTechniqueLimitCode,
  extraGivenCount: number,
  candidateIndex: number,
  encodedProblem: string,
  roundCount: number,
  lineReadingRoundCount: number,
];

/** 問題集から復元した1問。問題を解き切る作業の量を伴う。 */
export type TakuzuPooledProblem = TakuzuIdentifiedProblem & {
  workload: TakuzuSolveWorkload;
};

export type TakuzuProblemPool = {
  generatorVersion: typeof TAKUZU_GENERATOR_VERSION;
  levels: Record<TakuzuDifficulty, readonly TakuzuProblemPoolEntry[]>;
};

const problemPool = problemPoolJson as unknown as TakuzuProblemPool;

const cellCount = TAKUZU_BOARD_SIZE * TAKUZU_BOARD_SIZE;
const cellsPerHexDigit = 4;
const hexDigitCount = cellCount / cellsPerHexDigit;

export function getTakuzuRemovalTechniqueLimitCode(
  technique: TakuzuTechnique,
): TakuzuRemovalTechniqueLimitCode {
  const entry = Object.entries(removalTechniqueLimitByCode).find(
    ([, value]) => value === technique,
  );
  if (!entry) {
    throw new RangeError(`Unknown Takuzu technique: ${technique}`);
  }
  return entry[0] as TakuzuRemovalTechniqueLimitCode;
}

/** 行優先の64マスを4マスずつ16進1桁へ詰める。先頭のマスを最上位ビットにする。 */
function encodeBits(bits: readonly boolean[]): string {
  let encoded = "";
  for (let start = 0; start < bits.length; start += cellsPerHexDigit) {
    let digit = 0;
    for (let offset = 0; offset < cellsPerHexDigit; offset += 1) {
      digit = (digit << 1) | (bits[start + offset] ? 1 : 0);
    }
    encoded += digit.toString(16);
  }
  return encoded;
}

function decodeBits(encoded: string): boolean[] {
  if (!/^[0-9a-f]+$/.test(encoded)) {
    throw new RangeError("Takuzu pool problem must be lowercase hex");
  }
  return Array.from(encoded).flatMap((character) => {
    const digit = Number.parseInt(character, 16);
    return Array.from(
      { length: cellsPerHexDigit },
      (_, offset) => ((digit >> (cellsPerHexDigit - 1 - offset)) & 1) === 1,
    );
  });
}

/** 解（B を 1）と初期配置のマスク（固定マスを 1）を、それぞれ16進16桁で並べる。 */
export function encodeTakuzuPoolProblem({
  givens,
  solution,
}: TakuzuProblem): string {
  if (solution.size !== TAKUZU_BOARD_SIZE) {
    throw new RangeError("Takuzu pool problems must be 8×8");
  }
  return (
    encodeBits(solution.cells.map((cell) => cell === "b")) +
    encodeBits(givens.cells.map((cell) => cell !== null))
  );
}

export function decodeTakuzuPoolProblem(encoded: string): TakuzuProblem {
  if (encoded.length !== hexDigitCount * 2) {
    throw new RangeError(
      `Takuzu pool problem must have ${hexDigitCount * 2} hex digits`,
    );
  }
  const solutionBits = decodeBits(encoded.slice(0, hexDigitCount));
  const givenBits = decodeBits(encoded.slice(hexDigitCount));
  const solutionCells = solutionBits.map(
    (isB): TakuzuTile => (isB ? "b" : "a"),
  );
  const problem: TakuzuProblem = {
    givens: {
      size: TAKUZU_BOARD_SIZE,
      cells: solutionCells.map(
        (tile, cellIndex): TakuzuCell => (givenBits[cellIndex] ? tile : null),
      ),
    },
    solution: { size: TAKUZU_BOARD_SIZE, cells: solutionCells },
  };
  assertTakuzuProblem(problem);
  return problem;
}

export function toTakuzuPoolIdentity([
  removalTechniqueLimitCode,
  extraGivenCount,
  candidateIndex,
]: TakuzuProblemPoolEntry): TakuzuProblemIdentity {
  return createTakuzuProblemIdentity(
    removalTechniqueLimitByCode[removalTechniqueLimitCode],
    extraGivenCount,
    candidateIndex,
  );
}

export function toTakuzuPooledProblem(
  entry: TakuzuProblemPoolEntry,
): TakuzuPooledProblem {
  const [, , , encodedProblem, roundCount, lineReadingRoundCount] = entry;
  const problem = decodeTakuzuPoolProblem(encodedProblem);
  return {
    problem,
    identity: toTakuzuPoolIdentity(entry),
    workload: {
      emptyCellCount: problem.givens.cells.filter((cell) => cell === null)
        .length,
      roundCount,
      lineReadingRoundCount,
    },
  };
}

export function listTakuzuPoolEntries(
  difficulty: TakuzuDifficulty,
): readonly TakuzuProblemPoolEntry[] {
  return problemPool.levels[difficulty];
}

let entriesBySeed: ReadonlyMap<string, TakuzuProblemPoolEntry> | undefined;

function getEntriesBySeed(): ReadonlyMap<string, TakuzuProblemPoolEntry> {
  entriesBySeed ??= new Map(
    Object.values(problemPool.levels)
      .flat()
      .map((entry) => [toTakuzuPoolIdentity(entry).seed, entry]),
  );
  return entriesBySeed;
}

/** identity に一致する問題集の1問を探す。生成器の版や条件が違う identity には `null` を返す。 */
export function findTakuzuPoolEntry(
  identity: TakuzuProblemIdentity,
): TakuzuProblemPoolEntry | null {
  if (identity.generatorVersion !== problemPool.generatorVersion) {
    return null;
  }
  const entry = getEntriesBySeed().get(identity.seed);
  if (!entry) {
    return null;
  }
  const { conditions } = toTakuzuPoolIdentity(entry);
  const matches =
    conditions.size === identity.conditions.size &&
    conditions.removalTechniqueLimit ===
      identity.conditions.removalTechniqueLimit &&
    conditions.extraGivenCount === identity.conditions.extraGivenCount;
  return matches ? entry : null;
}
