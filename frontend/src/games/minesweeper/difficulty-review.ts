import {
  assessMinesweeperDifficulty,
  type MinesweeperDifficultyAssessment,
} from "./difficulty";
import type { MinesweeperHumanSolveFeatures } from "./problem/difficulty-analysis";
import {
  type MinesweeperDifficultyReviewProblem,
  minesweeperDifficultyReviewProblems,
} from "./problem/difficulty-review-problems";
import { restoreMinesweeperProblem } from "./problem/generator";
import {
  MINESWEEPER_GENERATOR_VERSION,
  type MinesweeperProblem,
  type MinesweeperProblemIdentity,
  type MinesweeperStartCellPlacement,
} from "./problem/problem";

export type MinesweeperDifficultyReviewEntry =
  MinesweeperDifficultyReviewProblem & {
    assessment: MinesweeperDifficultyAssessment;
    /** 解き切るのに要った推論の特徴。推論モデルで解き切れなかった問題では `undefined`。 */
    features: MinesweeperHumanSolveFeatures | undefined;
  };

/** 確認用の問題を復元し、現在の難易度判定の結果と推論の特徴を添えて返す。 */
export function assessMinesweeperDifficultyReviewProblems(): MinesweeperDifficultyReviewEntry[] {
  return minesweeperDifficultyReviewProblems.map((reviewProblem) => {
    const { rows, columns } = reviewProblem.identity.conditions;
    const analysis = restoreMinesweeperProblem(
      reviewProblem.identity,
    ).difficultyAnalysis;
    return {
      ...reviewProblem,
      assessment: assessMinesweeperDifficulty(analysis, { rows, columns }),
      features: analysis.status === "analyzed" ? analysis.features : undefined,
    };
  });
}

const identitySearchKeys = {
  seed: "seed",
  rows: "rows",
  columns: "columns",
  mineCount: "mines",
  startCellPlacement: "start",
  generationAttempt: "attempt",
} as const;

const startCellPlacements: readonly MinesweeperStartCellPlacement[] = [
  "random",
  "center",
];

export function formatMinesweeperProblemIdentitySearch(
  identity: MinesweeperProblemIdentity,
): string {
  const { rows, columns, mineCount, startCellPlacement } = identity.conditions;
  return `?${new URLSearchParams([
    [identitySearchKeys.seed, identity.seed],
    [identitySearchKeys.rows, String(rows)],
    [identitySearchKeys.columns, String(columns)],
    [identitySearchKeys.mineCount, String(mineCount)],
    [identitySearchKeys.startCellPlacement, startCellPlacement],
    [identitySearchKeys.generationAttempt, String(identity.generationAttempt)],
  ])}`;
}

function parseNaturalNumber(value: string | null): number | undefined {
  return value !== null && /^\d+$/.test(value) ? Number(value) : undefined;
}

function parseMinesweeperProblemIdentitySearch(
  searchParams: URLSearchParams,
): MinesweeperProblemIdentity | undefined {
  const seed = searchParams.get(identitySearchKeys.seed);
  const rows = parseNaturalNumber(searchParams.get(identitySearchKeys.rows));
  const columns = parseNaturalNumber(
    searchParams.get(identitySearchKeys.columns),
  );
  const mineCount = parseNaturalNumber(
    searchParams.get(identitySearchKeys.mineCount),
  );
  const startCellPlacement = startCellPlacements.find(
    (placement) =>
      placement === searchParams.get(identitySearchKeys.startCellPlacement),
  );
  const generationAttempt = parseNaturalNumber(
    searchParams.get(identitySearchKeys.generationAttempt),
  );
  if (
    !seed ||
    rows === undefined ||
    columns === undefined ||
    mineCount === undefined ||
    startCellPlacement === undefined ||
    generationAttempt === undefined
  ) {
    return undefined;
  }

  return {
    generatorVersion: MINESWEEPER_GENERATOR_VERSION,
    seed,
    conditions: { rows, columns, mineCount, startCellPlacement },
    generationAttempt,
  };
}

/** URLの検索パラメータが表す問題を復元する。生成条件として成り立たない値なら `undefined` を返す。 */
export function restoreMinesweeperProblemFromSearch(
  searchParams: URLSearchParams,
): MinesweeperProblem | undefined {
  const identity = parseMinesweeperProblemIdentitySearch(searchParams);
  if (!identity) {
    return undefined;
  }
  try {
    return restoreMinesweeperProblem(identity).problem;
  } catch (error) {
    // 盤面の大きさや地雷数の範囲は復元時の検証が所有しているため、その拒否を不正なURLとして扱う。
    if (error instanceof RangeError) {
      return undefined;
    }
    throw error;
  }
}

export const _private = { parseMinesweeperProblemIdentitySearch };
