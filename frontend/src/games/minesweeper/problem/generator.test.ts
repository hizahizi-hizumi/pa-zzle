import { getMinesweeperNeighborCellIndices } from "@/games/minesweeper/puzzle/board";
import {
  generateMinesweeperProblem,
  MinesweeperGenerationExhaustedError,
  restoreMinesweeperProblem,
} from "@/games/minesweeper/problem/generator";
import type { MinesweeperGenerationConditions } from "@/games/minesweeper/problem/problem";

describe("generateMinesweeperProblem", () => {
  const conditions: MinesweeperGenerationConditions = {
    rows: 16,
    columns: 12,
    mineCount: 35,
    startCellPlacement: "random",
  };

  describe("同じseedと生成条件の場合", () => {
    const options = { seed: "minesweeper-reproducible-seed", conditions };

    test("同じ問題と同じ分析結果を再現すること", () => {
      const first = generateMinesweeperProblem(options);
      const second = generateMinesweeperProblem(options);

      expect(second).toEqual(first);
    });
  });

  describe("異なるseedの場合", () => {
    const firstOptions = { seed: "minesweeper-seed-a", conditions };
    const secondOptions = { seed: "minesweeper-seed-b", conditions };

    test("異なる地雷配置を生成すること", () => {
      const first = generateMinesweeperProblem(firstOptions);
      const second = generateMinesweeperProblem(secondOptions);

      expect(second.problem.board.mineCellIndices).not.toEqual(
        first.problem.board.mineCellIndices,
      );
    });
  });

  describe.each(["random", "center"] as const)(
    "開始マスの決め方が %s の場合",
    (startCellPlacement) => {
      const seeds = Array.from({ length: 20 }, (_, index) => `start-${index}`);
      const placementConditions = { ...conditions, startCellPlacement };

      test.each(seeds)(
        "開始マスの周囲3×3に地雷を置かず、条件どおりの地雷数にすること: %s",
        (seed) => {
          const { problem } = generateMinesweeperProblem({
            seed,
            conditions: placementConditions,
          });

          const mines = new Set(problem.board.mineCellIndices);
          const zeroCells = problem.initialRevealedCellIndices.filter(
            (cellIndex) =>
              getMinesweeperNeighborCellIndices(problem.board, cellIndex).every(
                (neighbor) => !mines.has(neighbor),
              ),
          );
          expect(mines.size).toBe(placementConditions.mineCount);
          expect(zeroCells.length).toBeGreaterThan(0);
          expect(
            problem.initialRevealedCellIndices.some((cellIndex) =>
              mines.has(cellIndex),
            ),
          ).toBe(false);
        },
      );
    },
  );

  describe("中央開始の場合", () => {
    const centerConditions: MinesweeperGenerationConditions = {
      ...conditions,
      startCellPlacement: "center",
    };
    const centerCellIndex = 7 * 12 + 5;

    test("盤面中央のマスとその周囲を初期開示に含めること", () => {
      const { problem } = generateMinesweeperProblem({
        seed: "minesweeper-center",
        conditions: centerConditions,
      });

      expect(problem.initialRevealedCellIndices).toEqual(
        expect.arrayContaining([
          centerCellIndex,
          ...getMinesweeperNeighborCellIndices(problem.board, centerCellIndex),
        ]),
      );
    });
  });

  describe("採用判定で候補を棄却する場合", () => {
    const options = {
      seed: "minesweeper-acceptance",
      conditions,
      acceptCandidate: ({ attempt }: { attempt: number }) => attempt === 3,
    };

    test("採用された試行を問題識別情報へ記録すること", () => {
      const result = generateMinesweeperProblem(options);

      expect(result.identity.generationAttempt).toBe(3);
    });
  });

  describe("全ての候補を棄却する場合", () => {
    const options = {
      seed: "minesweeper-exhausted",
      conditions,
      maximumAttempts: 2,
      acceptCandidate: () => false,
    };

    test("生成失敗を送出すること", () => {
      const act = () => generateMinesweeperProblem(options);

      expect(act).toThrow(MinesweeperGenerationExhaustedError);
    });
  });

  describe.each([
    ["行数が最大を超える", { ...conditions, rows: 17 }],
    ["列数が最大を超える", { ...conditions, columns: 13 }],
    ["行数が最小を下回る", { ...conditions, rows: 4 }],
    ["地雷が開始3×3以外のマスに収まらない", { ...conditions, mineCount: 184 }],
  ] as const)("%s条件の場合", (_name, invalidConditions) => {
    test("条件を拒否すること", () => {
      const act = () =>
        generateMinesweeperProblem({
          seed: "invalid",
          conditions: invalidConditions,
        });

      expect(act).toThrow(RangeError);
    });
  });
});

describe("restoreMinesweeperProblem", () => {
  const generated = generateMinesweeperProblem({
    seed: "minesweeper-restore",
    conditions: {
      rows: 9,
      columns: 9,
      mineCount: 10,
      startCellPlacement: "random",
    },
    acceptCandidate: ({ attempt }) => attempt === 4,
  });

  test("問題識別情報から同じ問題と分析結果を復元すること", () => {
    const restored = restoreMinesweeperProblem(generated.identity);

    expect(restored).toEqual(generated);
  });
});
