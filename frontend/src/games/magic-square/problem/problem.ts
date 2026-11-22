import {
  assertMagicSquareBoard,
  isMagicSquareValue,
  type MagicSquareBoard,
  type MagicSquareCell,
} from "@/games/magic-square/puzzle/board";
import {
  isMagicSquareLineViolation,
  listMagicSquareLineEvaluations,
} from "@/games/magic-square/puzzle/rules";
import {
  isRecordedProblemIdentity,
  type RecordedProblemIdentity,
} from "@/games/problem-id";
import type { ProblemSeed } from "@/games/problem-seed";
import {
  isNonEmptyString,
  isNonNegativeInteger,
  isRecordObject,
} from "@/lib/type-guards";

/** 1問。最初から置いてある数（`givens`）だけを持ち、答えは持たない。列の判定は今の盤面だけで決まり、答えと照合しない。 */
export type MagicSquareProblem = {
  givens: MagicSquareBoard;
};

/** 出す盤面の一辺。3×3 は回転と裏返しを除くと1通りしかないので出さない。 */
export const magicSquareBoardSizes = [4, 5, 6] as const;

export type MagicSquareBoardSize = (typeof magicSquareBoardSizes)[number];

export function isMagicSquareBoardSize(
  value: unknown,
): value is MagicSquareBoardSize {
  return magicSquareBoardSizes.some((size) => size === value);
}

/**
 * 盤面の形、置いてある数、空きがあること、最初から置いてある数だけで違反の列が無いことを確かめる。
 * 答えが1つで推理だけで解けることは、問題を作るときに確かめるので、ここでは確かめない。
 */
export function assertMagicSquareProblem(problem: MagicSquareProblem): void {
  const { givens } = problem;
  assertMagicSquareBoard(givens);

  if (!isMagicSquareBoardSize(givens.size)) {
    throw new RangeError(
      `Unsupported magic square board size: ${givens.size}×${givens.size}`,
    );
  }
  if (!givens.cells.includes(null)) {
    throw new RangeError("Magic square problem must have an empty cell");
  }
  const violated = listMagicSquareLineEvaluations(givens).some(({ status }) =>
    isMagicSquareLineViolation(status),
  );
  if (violated) {
    throw new RangeError("Magic square givens must not violate any line");
  }
}

/** 最初から置いてある数の符号化（`seed`）が変わり、同じ identity から別の問題ができるようになったら上げる。 */
export const MAGIC_SQUARE_GENERATOR_VERSION = "1";

export type MagicSquareProblemConditions = {
  size: MagicSquareBoardSize;
};

/**
 * 同じ問題を再現するための情報。`seed` は乱数の種ではなく、最初から置いてある数を行優先で `.` でつないだもの（空きは `0`）。
 * 例: 4×4 で1行目が「空き 4 5 空き」なら `0.4.5.0.…`。
 */
export type MagicSquareProblemIdentity = {
  generatorVersion: typeof MAGIC_SQUARE_GENERATOR_VERSION;
  seed: ProblemSeed;
  conditions: MagicSquareProblemConditions;
};

/** 記録に残した問題の識別情報。生成器の版が今と違う記録も読み込み、再プレイと結果画面の作り直しだけをしない。 */
export type MagicSquareRecordedProblemIdentity = RecordedProblemIdentity;

export type MagicSquareIdentifiedProblem = {
  problem: MagicSquareProblem;
  identity: MagicSquareProblemIdentity;
};

/** 速さの基準時間に使う、問題の作業の量。 */
export type MagicSquareSolveWorkload = {
  emptyCellCount: number;
};

const emptyCellNotation = "0";
const cellSeparator = ".";
const cellNotationPattern = /^(0|[1-9][0-9]*)$/;

function encodeGivens(cells: readonly MagicSquareCell[]): string {
  return cells.map((cell) => cell ?? emptyCellNotation).join(cellSeparator);
}

/** 符号化と置いてある数（範囲と重なり）が正しくなければ `null`。空きの有無と列の違反は確かめない。 */
function decodeMagicSquareProblem(
  seed: string,
  size: MagicSquareBoardSize,
): MagicSquareProblem | null {
  const notations = seed.split(cellSeparator);
  if (
    notations.length !== size * size ||
    !notations.every((notation) => cellNotationPattern.test(notation))
  ) {
    return null;
  }
  const cells = notations.map((notation): MagicSquareCell => {
    const value = Number(notation);
    return value === 0 ? null : value;
  });
  const values = cells.filter((cell) => cell !== null);
  const valid =
    values.every((value) => isMagicSquareValue(size, value)) &&
    new Set(values).size === values.length;
  return valid ? { givens: { size, cells } } : null;
}

export function createMagicSquareProblemIdentity(
  problem: MagicSquareProblem,
): MagicSquareProblemIdentity {
  const { size, cells } = problem.givens;
  if (!isMagicSquareBoardSize(size)) {
    throw new RangeError(`Unsupported magic square board size: ${size}`);
  }
  return {
    generatorVersion: MAGIC_SQUARE_GENERATOR_VERSION,
    seed: encodeGivens(cells),
    conditions: { size },
  };
}

/** identity の `seed` から問題を復号する。生成器は走らせない。 */
export function restoreMagicSquareProblem(
  identity: MagicSquareProblemIdentity,
): MagicSquareIdentifiedProblem {
  if (identity.generatorVersion !== MAGIC_SQUARE_GENERATOR_VERSION) {
    throw new Error(
      `Unsupported magic square generator version: ${identity.generatorVersion}`,
    );
  }
  const problem = decodeMagicSquareProblem(
    identity.seed,
    identity.conditions.size,
  );
  if (!problem) {
    throw new RangeError(`Invalid magic square problem seed: ${identity.seed}`);
  }
  assertMagicSquareProblem(problem);
  return { problem, identity };
}

/** 記録・診断など外部から読み戻した値が、今の生成器で復元できる識別情報かを確かめる。 */
export function isCurrentMagicSquareProblemIdentity(
  value: unknown,
): value is MagicSquareProblemIdentity {
  if (!isRecordObject(value) || !isRecordObject(value.conditions)) {
    return false;
  }
  const { size } = value.conditions;
  return (
    value.generatorVersion === MAGIC_SQUARE_GENERATOR_VERSION &&
    isNonEmptyString(value.seed) &&
    isMagicSquareBoardSize(size) &&
    decodeMagicSquareProblem(value.seed, size) !== null
  );
}

export function isMagicSquareRecordedProblemIdentity(
  value: unknown,
): value is MagicSquareRecordedProblemIdentity {
  return isRecordedProblemIdentity(value, {
    generatorVersion: MAGIC_SQUARE_GENERATOR_VERSION,
    isProblemIdentity: isCurrentMagicSquareProblemIdentity,
  });
}

export function createMagicSquareSolveWorkload(
  problem: MagicSquareProblem,
): MagicSquareSolveWorkload {
  return {
    emptyCellCount: problem.givens.cells.filter((cell) => cell === null).length,
  };
}

export function isMagicSquareSolveWorkload(
  value: unknown,
): value is MagicSquareSolveWorkload {
  return isRecordObject(value) && isNonNegativeInteger(value.emptyCellCount);
}

export const _private = {
  decodeMagicSquareProblem,
};
