import {
  formatHakoiriMusumeBoard,
  type HakoiriMusumePiece,
  parseHakoiriMusumeBoard,
} from "@/games/hakoiri-musume/puzzle/board";
import { isHakoiriMusumeCleared } from "@/games/hakoiri-musume/puzzle/rules";
import { createHakoiriMusumeInitialState } from "@/games/hakoiri-musume/puzzle/state";
import {
  isRecordedProblemIdentity,
  type RecordedProblemIdentity,
} from "@/games/problem-id";
import type { ProblemSeed } from "@/games/problem-seed";
import { isRecordObject } from "@/lib/type-guards";

/** 1問を遊ぶためのデータ。始めたときの駒の並び（左上のマスの順）。娘はちょうど1つで、出口の前にはいない。 */
export type HakoiriMusumeProblem = {
  pieces: readonly HakoiriMusumePiece[];
};

/** 盤面の20文字の書き方が変わり、同じ identity から別の問題ができるようになったら上げる。 */
export const HAKOIRI_MUSUME_GENERATOR_VERSION = "1";

/** どの問題も同じ 4 × 5 の箱なので、生成条件は持たない。 */
type HakoiriMusumeProblemConditions = Readonly<Record<never, never>>;

/**
 * 同じ問題を再現するための情報。`seed` は乱数の種ではなく、始めたときの盤面の20文字（`formatHakoiriMusumeBoard`）。
 */
export type HakoiriMusumeProblemIdentity = {
  generatorVersion: typeof HAKOIRI_MUSUME_GENERATOR_VERSION;
  seed: ProblemSeed;
  conditions: HakoiriMusumeProblemConditions;
};

/** 記録に残した問題の識別情報。生成器の版が今と違う記録も読み込む。 */
export type HakoiriMusumeRecordedProblemIdentity = RecordedProblemIdentity;

/** 問題と、それを再現するための情報。 */
export type HakoiriMusumeIdentifiedProblem = {
  problem: HakoiriMusumeProblem;
  identity: HakoiriMusumeProblemIdentity;
};

/** 問題として成り立たない駒の並びなら、その理由。成り立てば `null`。 */
function findProblemDefect(
  pieces: readonly HakoiriMusumePiece[],
): string | null {
  const daughterCount = pieces.filter(
    (piece) => piece.kind === "daughter",
  ).length;
  if (daughterCount !== 1) {
    return "Hakoiri musume problem must have exactly one daughter";
  }
  if (isHakoiriMusumeCleared(createHakoiriMusumeInitialState(pieces))) {
    return "Hakoiri musume daughter must not start at the exit";
  }
  return null;
}

/**
 * 問題の形を確かめる。駒が箱に収まって重ならず、娘がちょうど1つで、出口の前から始まらないこと。
 * 娘を出口の前へ運べるかは、問題集を作るときに確かめる（全部の盤面をたどるので、遊ぶときには確かめない）。
 */
export function assertHakoiriMusumeProblem(
  problem: HakoiriMusumeProblem,
): void {
  const board = formatHakoiriMusumeBoard(problem.pieces);
  const parsed = parseHakoiriMusumeBoard(board);
  const readsBack =
    parsed !== null &&
    parsed.length === problem.pieces.length &&
    parsed.every(
      (piece, index) =>
        piece.kind === problem.pieces[index]!.kind &&
        piece.cell === problem.pieces[index]!.cell,
    );
  if (!readsBack) {
    throw new RangeError(
      "Hakoiri musume pieces must fit in the box without overlapping, in cell order",
    );
  }
  const defect = findProblemDefect(problem.pieces);
  if (defect) {
    throw new RangeError(defect);
  }
}

/** 盤面の20文字から問題を読む。読めないか、問題として成り立たなければ `null`。 */
function decodeHakoiriMusumeProblem(seed: string): HakoiriMusumeProblem | null {
  const pieces = parseHakoiriMusumeBoard(seed);
  return pieces && findProblemDefect(pieces) === null ? { pieces } : null;
}

export function createHakoiriMusumeProblemIdentity(
  problem: HakoiriMusumeProblem,
): HakoiriMusumeProblemIdentity {
  return {
    generatorVersion: HAKOIRI_MUSUME_GENERATOR_VERSION,
    seed: formatHakoiriMusumeBoard(problem.pieces),
    conditions: {},
  };
}

/** identity の盤面から問題を読む。生成器は走らせない。 */
export function restoreHakoiriMusumeProblem(
  identity: HakoiriMusumeProblemIdentity,
): HakoiriMusumeIdentifiedProblem {
  if (identity.generatorVersion !== HAKOIRI_MUSUME_GENERATOR_VERSION) {
    throw new Error(
      `Unsupported hakoiri musume generator version: ${identity.generatorVersion}`,
    );
  }
  const problem = decodeHakoiriMusumeProblem(identity.seed);
  if (!problem) {
    throw new RangeError(`Invalid hakoiri musume board: ${identity.seed}`);
  }
  return { problem, identity };
}

/** 記録・診断など外部から読み戻した値が、現在の生成器で復元できる識別情報かを確かめる。 */
export function isHakoiriMusumeProblemIdentity(
  value: unknown,
): value is HakoiriMusumeProblemIdentity {
  return (
    isRecordObject(value) &&
    value.generatorVersion === HAKOIRI_MUSUME_GENERATOR_VERSION &&
    isRecordObject(value.conditions) &&
    Object.keys(value.conditions).length === 0 &&
    typeof value.seed === "string" &&
    decodeHakoiriMusumeProblem(value.seed) !== null
  );
}

/** 記録から読み戻した値が、問題の識別情報として読めるかを確かめる。 */
export function isHakoiriMusumeRecordedProblemIdentity(
  value: unknown,
): value is HakoiriMusumeRecordedProblemIdentity {
  return isRecordedProblemIdentity(value, {
    generatorVersion: HAKOIRI_MUSUME_GENERATOR_VERSION,
    isProblemIdentity: isHakoiriMusumeProblemIdentity,
  });
}
