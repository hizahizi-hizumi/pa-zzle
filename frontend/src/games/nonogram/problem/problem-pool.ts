import type { NonogramDifficulty } from "@/games/nonogram/difficulty";
import type { NonogramReadingFeatures } from "@/games/nonogram/problem/difficulty-analysis";
import {
  createNonogramProblem,
  createNonogramProblemIdentity,
  isNonogramBoardSize,
  NONOGRAM_GENERATOR_VERSION,
  type NonogramIdentifiedProblem,
  type NonogramProblemIdentity,
  nonogramPatternStyles,
} from "@/games/nonogram/problem/problem";
import problemPoolJson from "@/games/nonogram/problem/problem-pool.json";
import type { NonogramGridSize } from "@/games/nonogram/puzzle/board";
import type { NonogramPattern } from "@/games/nonogram/puzzle/pattern";
import { createProblemPoolIdLookup } from "@/games/problem-id";

/**
 * 事前生成した問題集の1問。
 * - `styleIndex` は `nonogramPatternStyles` の中の図柄の作り方の位置。大きさ・作り方・`candidateIndex` で
 *   `createNonogramProblemIdentity` の identity を再構成する。
 * - `encodedSolution` は解の図柄（`encodeNonogramPoolSolution`）。ヒントは解から求まるので持たない。
 *   実行時に生成器・線の読みを呼ばずに問題を復元するため、生成結果そのものを持つ。
 * - 残りは生成時に測った難易度の特徴（`NonogramReadingFeatures`）。問題集を作り直さずに分類を確かめられるよう持たせる。
 */
export type NonogramProblemPoolEntry = readonly [
  width: number,
  height: number,
  styleIndex: number,
  candidateIndex: number,
  encodedSolution: string,
  roundCount: number,
  entryLineCount: number,
  firstRoundFixedCellCount: number,
  minimumProgressedLineCount: number,
  narrowRoundCount: number,
  readingsBeyondEdgesCount: number,
];

/**
 * 問題集の中の1問を指す識別情報。
 * - `poolVersion`: 問題集を作り直して問題の並びが変わったら上げる。
 * - `problemId`: `<レベル>-<番号>`（番号はレベルの中の1始まりの並び順）。例: `4-17`。
 */
export type NonogramProblemPoolReference = {
  poolVersion: string;
  problemId: string;
};

/** 問題集の1項目を読み解いた値。問題は `encodedSolution` から復元する。 */
export type NonogramDecodedPoolEntry = {
  identity: NonogramProblemIdentity;
  features: NonogramReadingFeatures;
};

/** 問題集から復元した1問。問題集の中の位置を伴う。 */
export type NonogramPooledProblem = NonogramIdentifiedProblem & {
  poolReference: NonogramProblemPoolReference;
};

export type NonogramProblemPool = {
  poolVersion: string;
  generatorVersion: typeof NONOGRAM_GENERATOR_VERSION;
  levels: Record<NonogramDifficulty, readonly NonogramProblemPoolEntry[]>;
};

const problemPool = problemPoolJson as unknown as NonogramProblemPool;

const HEX_DIGIT_BITS = 4;

function getRowDigitCount(width: number): number {
  return Math.ceil(width / HEX_DIGIT_BITS);
}

/**
 * 図柄を、行ごとに左のマスを上位の桁とした2進数（黒が1）の16進表記にし、上の行から並べる。
 * 1行は幅に応じた桁数（幅10なら3桁）にそろえる。例: 幅7の行 `##....#` は `61`。
 */
export function encodeNonogramPoolSolution(pattern: NonogramPattern): string {
  const digitCount = getRowDigitCount(pattern.width);
  return Array.from({ length: pattern.height }, (_, row) => {
    const bits = pattern.black
      .slice(row * pattern.width, (row + 1) * pattern.width)
      .reduce((value, isBlack) => value * 2 + (isBlack ? 1 : 0), 0);
    return bits.toString(16).padStart(digitCount, "0");
  }).join("");
}

export function decodeNonogramPoolSolution(
  { width, height }: NonogramGridSize,
  encoded: string,
): NonogramPattern {
  if (!isNonogramBoardSize(width, height)) {
    throw new RangeError(
      `Unsupported Nonogram pool board size: ${width}x${height}`,
    );
  }
  const digitCount = getRowDigitCount(width);
  if (encoded.length !== digitCount * height || !/^[0-9a-f]+$/.test(encoded)) {
    throw new RangeError(
      `Nonogram pool solution must have ${digitCount * height} hex digits`,
    );
  }
  const black = Array.from({ length: height }, (_, row) => {
    const bits = Number.parseInt(
      encoded.slice(row * digitCount, (row + 1) * digitCount),
      16,
    );
    if (bits >= 2 ** width) {
      throw new RangeError("Nonogram pool solution row exceeds the width");
    }
    return Array.from(
      { length: width },
      (_, column) => Math.floor(bits / 2 ** (width - 1 - column)) % 2 === 1,
    );
  }).flat();
  return { width, height, black };
}

export function decodeNonogramPoolEntry([
  width,
  height,
  styleIndex,
  candidateIndex,
  ,
  roundCount,
  entryLineCount,
  firstRoundFixedCellCount,
  minimumProgressedLineCount,
  narrowRoundCount,
  readingsBeyondEdgesCount,
]: NonogramProblemPoolEntry): NonogramDecodedPoolEntry {
  const style = nonogramPatternStyles[styleIndex];
  if (style === undefined) {
    throw new RangeError(`Unknown Nonogram pattern style: ${styleIndex}`);
  }
  return {
    identity: createNonogramProblemIdentity(
      { width, height },
      style,
      candidateIndex,
    ),
    features: {
      roundCount,
      entryLineCount,
      firstRoundFixedCellCount,
      minimumProgressedLineCount,
      narrowRoundCount,
      readingsBeyondEdgesCount,
    },
  };
}

export function formatNonogramPoolProblemId(
  difficulty: NonogramDifficulty,
  entryIndex: number,
): string {
  return `${difficulty}-${entryIndex + 1}`;
}

/** 問題集の1問を、問題集の中の位置 `poolReference` を添えて復元する。 */
export function restoreNonogramPoolEntry(
  entry: NonogramProblemPoolEntry,
  poolReference: NonogramProblemPoolReference,
): NonogramPooledProblem {
  const [width, height, , , encodedSolution] = entry;
  return {
    problem: createNonogramProblem(
      decodeNonogramPoolSolution({ width, height }, encodedSolution),
    ),
    identity: decodeNonogramPoolEntry(entry).identity,
    poolReference,
  };
}

export function toNonogramPooledProblem(
  difficulty: NonogramDifficulty,
  entryIndex: number,
): NonogramPooledProblem {
  const problemId = formatNonogramPoolProblemId(difficulty, entryIndex);
  const entry = problemPool.levels[difficulty][entryIndex];
  if (!entry) {
    throw new RangeError(`No Nonogram pool problem ${problemId}`);
  }
  return restoreNonogramPoolEntry(entry, {
    poolVersion: problemPool.poolVersion,
    problemId,
  });
}

export function listNonogramPoolEntries(
  difficulty: NonogramDifficulty,
): readonly NonogramProblemPoolEntry[] {
  return problemPool.levels[difficulty];
}

const findPoolPositionByProblemId = createProblemPoolIdLookup(
  problemPool.levels,
  (entry) => decodeNonogramPoolEntry(entry).identity,
);

/**
 * 難易度の問題集から問題 ID で1問を探して復元する。問題集に無い ID・別の難易度の ID には `null` を返す。
 * 問題 ID は今の生成器の版の identity から求めるので、生成器の版が今と違う問題集からは引かない。
 */
export function findNonogramPooledProblemByProblemId(
  difficulty: NonogramDifficulty,
  problemId: string,
): NonogramPooledProblem | null {
  if (problemPool.generatorVersion !== NONOGRAM_GENERATOR_VERSION) {
    return null;
  }
  const position = findPoolPositionByProblemId(difficulty, problemId);
  return position
    ? toNonogramPooledProblem(difficulty, position.entryIndex)
    : null;
}
