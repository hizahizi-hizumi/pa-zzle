// @vitest-environment node

import { difficultyLevels, isInNumericRange } from "@/games/difficulty";
import {
  assessIceFloorMazeDifficulty,
  type IceFloorMazeDifficulty,
  type IceFloorMazeLevelCriteria,
  iceFloorMazeLevelCriteria,
  isIceFloorMazeBoardShapeOfDifficulty,
} from "@/games/ice-floor-maze/difficulty";
import { analyzeIceFloorMazeDifficulty } from "@/games/ice-floor-maze/problem/difficulty-analysis";
import {
  CELL_BRITTLE,
  CELL_ICE,
  CELL_ROCK,
  CELL_THIN,
  countShortestSolutions,
  createElementRules,
  exploreStateSpace,
  findUsedCells,
  measureDistancesToGoal,
  toGenerationBoard,
} from "@/games/ice-floor-maze/problem/generation/state-space";
import { getIceFloorMazeSymmetryKey } from "@/games/ice-floor-maze/problem/generation/symmetry";
import {
  type IceFloorMazePooledProblem,
  listIceFloorMazePoolEntries,
  restoreIceFloorMazePoolEntry,
} from "@/games/ice-floor-maze/problem/problem-pool";
import {
  canSelectIceFloorMazeProblemById,
  selectIceFloorMazeProblemById,
  selectIceFloorMazeProblemForDifficulty,
} from "@/games/ice-floor-maze/problem-selection";
import { createProblemId } from "@/games/problem-id";

const difficulties = difficultyLevels.map(({ id }) => id);
/** 分析し直して分類を確かめる、各レベルの先頭の問題の数。全問は `generate:ice-floor-maze-pool -- --verify` で確かめる。 */
const classifiedSampleSize = 24;

function listPooledProblems(difficulty: IceFloorMazeDifficulty) {
  return listIceFloorMazePoolEntries(difficulty).map(
    restoreIceFloorMazePoolEntry,
  );
}

/** 全問で毎回確かめる軽い性質。分類の採用条件（条件1・2・おとり）は重いので、各レベルの先頭の問題だけで確かめる。 */
function listStructuralViolations(
  difficulty: IceFloorMazeDifficulty,
  { problem, optimalMoveCount, identity }: IceFloorMazePooledProblem,
): string[] {
  const criteria: IceFloorMazeLevelCriteria =
    iceFloorMazeLevelCriteria[difficulty];
  const board = toGenerationBoard(problem.board);
  const rules = createElementRules(board);
  const space = exploreStateSpace(rules, problem.start, {
    goal: problem.goal,
  })!;
  const toGoal = measureDistancesToGoal(space);
  const used = findUsedCells(space);
  const composition =
    rules.elements.length === 0
      ? "none"
      : new Set(rules.kinds).size === 2
        ? "mixed"
        : rules.kinds[0] === CELL_BRITTLE
          ? "brittle-rock"
          : "thin-ice";
  const patternMatches =
    criteria.kind === "tactics"
      ? composition === "none" &&
        criteria.patterns.some((pattern) =>
          isInNumericRange(optimalMoveCount, pattern.optimalMoveCount),
        )
      : criteria.patterns.some(
          (pattern) =>
            pattern.composition === composition &&
            isInNumericRange(optimalMoveCount, pattern.optimalMoveCount) &&
            isInNumericRange(rules.elements.length, pattern.elementCount),
        );
  const unusedDrawnCells = [...board.cells.entries()].filter(
    ([cell, code]) =>
      used[cell] === 0 &&
      (code === CELL_ICE ||
        code === CELL_THIN ||
        ((code === CELL_ROCK || code === CELL_BRITTLE) &&
          !rules.beyond.some((table) => used[table[cell]!] === 1))),
  );
  return [
    ...(isIceFloorMazeBoardShapeOfDifficulty(identity.conditions, difficulty)
      ? []
      : ["盤面の形"]),
    ...(patternMatches ? [] : ["要素・最少手数"]),
    ...(toGoal[0] === optimalMoveCount ? [] : ["最少手数"]),
    ...(countShortestSolutions(space, toGoal, optimalMoveCount) === 1
      ? []
      : ["最短解が一意でない"]),
    ...(unusedDrawnCells.length === 0 ? [] : ["駒が通らない盤面のマス"]),
  ].map((violation) => `${identity.seed}: ${violation}`);
}

describe("問題集", () => {
  test.each(difficulties)(
    "レベル %s の全問題が、そのレベルの盤面の形・要素・最少手数で、最短解が一意で、駒が通らないマスを盤面に描かないこと",
    (difficulty) => {
      const pooled = listPooledProblems(difficulty);

      const violations = pooled.flatMap((problem) =>
        listStructuralViolations(difficulty, problem),
      );

      expect(pooled.length).toBeGreaterThanOrEqual(300);
      expect(violations).toEqual([]);
    },
  );

  test.each(difficulties)(
    "レベル %s の先頭の問題が、分析でそのレベルに分類され、保存した最少手数が分析と一致すること",
    (difficulty) => {
      const pooled = listPooledProblems(difficulty).slice(
        0,
        classifiedSampleSize,
      );

      const outcomes = pooled.map(({ problem, optimalMoveCount }) => {
        const analysis = analyzeIceFloorMazeDifficulty(problem);
        const assessment = assessIceFloorMazeDifficulty(analysis);
        const level =
          assessment.status === "classified"
            ? assessment.difficulty
            : JSON.stringify(assessment);
        const analyzedMoveCount =
          analysis.status === "analyzed"
            ? analysis.features.optimalMoveCount
            : null;
        return analyzedMoveCount === optimalMoveCount
          ? level
          : `${level}（最少手数 ${optimalMoveCount} → ${analyzedMoveCount}）`;
      });

      expect(new Set(outcomes)).toEqual(new Set([difficulty]));
    },
  );

  test.each(difficulties)(
    "レベル %s の生成条件ごとの問題数の差が、要素の種類で見て1問以内であること",
    (difficulty) => {
      const pooled = listPooledProblems(difficulty);

      const countsByComposition = Map.groupBy(pooled, ({ problem }) => {
        const kinds = new Set(
          problem.board.cells.filter(
            (cell) => cell === "brittle-rock" || cell === "thin-ice",
          ),
        );
        return [...kinds].sort().join("+");
      });
      const counts = [...countsByComposition.values()].map(
        (problems) => problems.length,
      );

      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    },
  );

  test("全レベルを通して回転・反転の同型を含まないこと", () => {
    const pooled = difficulties.flatMap(listPooledProblems);

    const symmetryKeys = new Set(
      pooled.map(({ problem }) => getIceFloorMazeSymmetryKey(problem)),
    );

    expect(symmetryKeys.size).toBe(pooled.length);
  });
});

describe("selectIceFloorMazeProblemForDifficulty", () => {
  test.each(difficulties)(
    "レベル %s の問題集から同じ seed で同じ問題を選ぶこと",
    (difficulty) => {
      const first = selectIceFloorMazeProblemForDifficulty(
        difficulty,
        "seed-a",
      );
      const second = selectIceFloorMazeProblemForDifficulty(
        difficulty,
        "seed-a",
      );

      expect(second).toEqual(first);
      expect(
        listIceFloorMazePoolEntries(difficulty).some(
          ([seed, width, height, optimalMoveCount]) =>
            seed === first.identity.seed &&
            width === first.identity.conditions.width &&
            height === first.identity.conditions.height &&
            optimalMoveCount === first.optimalMoveCount,
        ),
      ).toBe(true);
    },
  );
});

describe("selectIceFloorMazeProblemById", () => {
  const selected = selectIceFloorMazeProblemForDifficulty("4", "seed-b");
  const problemId = createProblemId(selected.identity);

  test("選んだ問題の問題 ID で同じ問題を引くこと", () => {
    const found = selectIceFloorMazeProblemById("4", problemId);

    expect(found).toEqual(selected);
  });

  test("別の難易度では同じ問題 ID の問題を引かないこと", () => {
    const found = selectIceFloorMazeProblemById("5", problemId);

    expect(found).toBeNull();
  });
});

describe("canSelectIceFloorMazeProblemById", () => {
  const selected = selectIceFloorMazeProblemForDifficulty("2", "seed-c");
  const cases = [
    ["問題集の問題 ID", createProblemId(selected.identity), true],
    ["問題集に無い問題 ID", "0000000000", false],
  ] as const;

  test.each(cases)("%s を引けるかを返すこと", (_, problemId, expected) => {
    const selectable = canSelectIceFloorMazeProblemById("2", problemId);

    expect(selectable).toBe(expected);
  });
});
