// @vitest-environment node

import { difficultyLevels } from "@/games/difficulty";
import {
  assessIceFloorMazeDifficulty,
  type IceFloorMazeDifficulty,
  isIceFloorMazeBoardShapeOfDifficulty,
} from "@/games/ice-floor-maze/difficulty";
import { analyzeIceFloorMazeDifficulty } from "@/games/ice-floor-maze/problem/difficulty-analysis";
import { removeIceFloorMazeIrrelevantRocks } from "@/games/ice-floor-maze/problem/generation/relevant-rocks";
import { getIceFloorMazeSymmetryKey } from "@/games/ice-floor-maze/problem/generation/symmetry";
import {
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

function listPooledProblems(difficulty: IceFloorMazeDifficulty) {
  return listIceFloorMazePoolEntries(difficulty).map(
    restoreIceFloorMazePoolEntry,
  );
}

describe("問題集", () => {
  test.each(difficulties)(
    "レベル %s の全問題が、分析でそのレベルに分類され、保存した最少手数が分析と一致すること",
    (difficulty) => {
      const pooled = listPooledProblems(difficulty);

      const outcomes = pooled.map(({ problem, optimalMoveCount }) => {
        const analysis = analyzeIceFloorMazeDifficulty(problem);
        const assessment = assessIceFloorMazeDifficulty(analysis);
        const level =
          assessment.status === "classified"
            ? assessment.difficulty
            : assessment.status;
        const analyzedMoveCount =
          analysis.status === "invalid"
            ? null
            : analysis.features.optimalMoveCount;
        return analyzedMoveCount === optimalMoveCount
          ? level
          : `${level}（最少手数 ${optimalMoveCount} → ${analyzedMoveCount}）`;
      });

      expect(pooled.length).toBeGreaterThanOrEqual(100);
      expect(new Set(outcomes)).toEqual(new Set([difficulty]));
    },
  );

  test.each(difficulties)(
    "レベル %s の全問題が、そのレベルの盤面の形で、無関係な岩を含まないこと",
    (difficulty) => {
      const pooled = listPooledProblems(difficulty);

      const violations = pooled.filter(
        ({ problem: { board, start } }) =>
          !isIceFloorMazeBoardShapeOfDifficulty(board, difficulty) ||
          removeIceFloorMazeIrrelevantRocks(board, start).cells.some(
            (cell, cellIndex) => cell !== board.cells[cellIndex],
          ),
      );

      expect(violations).toEqual([]);
    },
  );

  test.each(difficulties)(
    "レベル %s の盤面の形ごとの問題数の差が1問以内であること",
    (difficulty) => {
      const entries = listIceFloorMazePoolEntries(difficulty);

      const countsByShape = Map.groupBy(
        entries,
        ([, width, height]) => `${width}x${height}`,
      );
      const counts = [...countsByShape.values()].map(
        (shapeEntries) => shapeEntries.length,
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
