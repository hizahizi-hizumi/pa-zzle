import {
  analyzeMinesweeperDifficulty,
  type MinesweeperHumanSolveFeatures,
} from "./difficulty-analysis";
import { minesweeperDifficultyReviewProblems } from "./difficulty-review-problems";
import {
  generateMinesweeperProblem,
  restoreMinesweeperProblem,
} from "./generator";
import type { MinesweeperProblem } from "./problem";

function restoreReviewProblem(seed: string): MinesweeperProblem {
  const reviewProblem = minesweeperDifficultyReviewProblems.find(
    (candidate) => candidate.identity.seed === seed,
  )!;
  return restoreMinesweeperProblem(reviewProblem.identity).problem;
}

type CellTransform = (
  row: number,
  column: number,
  rows: number,
  columns: number,
) => [number, number];

function transformProblem(
  problem: MinesweeperProblem,
  transform: CellTransform,
  transposes: boolean,
): MinesweeperProblem {
  const { rows, columns } = problem.board;
  const nextColumns = transposes ? rows : columns;
  function mapCell(cellIndex: number): number {
    const [nextRow, nextColumn] = transform(
      Math.floor(cellIndex / columns),
      cellIndex % columns,
      rows,
      columns,
    );
    return nextRow * nextColumns + nextColumn;
  }

  return {
    board: {
      rows: transposes ? columns : rows,
      columns: nextColumns,
      mineCellIndices: problem.board.mineCellIndices.map(mapCell),
    },
    initialRevealedCellIndices: problem.initialRevealedCellIndices.map(mapCell),
  };
}

describe("analyzeMinesweeperDifficulty", () => {
  describe("推測なしで解ける問題の場合", () => {
    const { problem } = generateMinesweeperProblem({
      seed: "minesweeper-analysis",
      conditions: {
        rows: 16,
        columns: 12,
        mineCount: 35,
        startCellPlacement: "random",
      },
      acceptCandidate: ({ difficultyAnalysis }) =>
        difficultyAnalysis.status === "analyzed" &&
        difficultyAnalysis.features.overlapOrHarderRoundCount > 0,
    });

    test("人間向け推論の特徴と規模指標を返すこと", () => {
      const result = analyzeMinesweeperDifficulty(problem);

      expect(result.status).toBe("analyzed");
      expect(result.scale).toEqual({
        cellCount: 192,
        mineCount: 35,
        mineDensity: 35 / 192,
        initialRevealedCellCount: problem.initialRevealedCellIndices.length,
        initialRevealedSafeCellRatio:
          problem.initialRevealedCellIndices.length / (192 - 35),
        safeCellCountToReveal:
          192 - 35 - problem.initialRevealedCellIndices.length,
      });
      if (result.status === "analyzed") {
        const { features } = result;
        expect(features.highestDeductionLevel).toBeGreaterThanOrEqual(3);
        expect(
          Object.values(features.roundCountByDeductionLevel).reduce(
            (sum, count) => sum + count,
            0,
          ),
        ).toBe(features.roundCount);
        expect(features.minimumDiscoveryCount).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe("盤面を回転・反転した場合", () => {
    const { problem } = generateMinesweeperProblem({
      seed: "minesweeper-symmetry",
      conditions: {
        rows: 12,
        columns: 10,
        mineCount: 22,
        startCellPlacement: "random",
      },
      acceptCandidate: ({ difficultyAnalysis }) =>
        difficultyAnalysis.status === "analyzed" &&
        difficultyAnalysis.features.overlapOrHarderRoundCount > 0,
    });
    const original = analyzeMinesweeperDifficulty(problem);
    const sameShapeTransforms: [string, CellTransform][] = [
      [
        "左右反転",
        (row, column, _rows, columns) => [row, columns - 1 - column],
      ],
      ["上下反転", (row, column, rows) => [rows - 1 - row, column]],
      [
        "180度回転",
        (row, column, rows, columns) => [rows - 1 - row, columns - 1 - column],
      ],
    ];
    const transposedTransforms: [string, CellTransform][] = [
      ["転置", (row, column) => [column, row]],
      ["90度回転", (row, column, rows) => [column, rows - 1 - row]],
    ];

    test.each(sameShapeTransforms)(
      "%sしても同じ分析結果になること",
      (_name, transform) => {
        const result = analyzeMinesweeperDifficulty(
          transformProblem(problem, transform, false),
        );

        expect(result).toEqual(original);
      },
    );

    test.each(transposedTransforms)(
      "%sしても行と列の幅が入れ替わるだけの分析結果になること",
      (_name, transform) => {
        const result = analyzeMinesweeperDifficulty(
          transformProblem(problem, transform, true),
        );

        expect(original.status).toBe("analyzed");
        if (original.status === "analyzed") {
          expect(result).toEqual({
            ...original,
            features: {
              ...original.features,
              maximumDiscoveryRowSpan:
                original.features.maximumDiscoveryColumnSpan,
              maximumDiscoveryColumnSpan:
                original.features.maximumDiscoveryRowSpan,
            },
          });
        }
      },
    );
  });

  describe("段階をまたいで同じ構造の推論を数える場合", () => {
    const cases = (
      [
        [
          "包含1回と総地雷数を1つの数字で突き合わせる終盤",
          "ms-10x10-15-846",
          {
            containmentEquivalentRoundCount: 2,
            overlapEquivalentRoundCount: 0,
            multiNumberTotalMineCountRoundCount: 0,
            chainedGroupRoundCount: 0,
          },
        ],
        [
          "離れた2つの数字の和を総地雷数と突き合わせる終盤",
          "ms-10x10-15-819",
          {
            overlapEquivalentRoundCount: 1,
            multiNumberTotalMineCountRoundCount: 0,
            chainedGroupRoundCount: 0,
          },
        ],
        [
          "2の中に1が2つ収まる3つの数字",
          "ms-10x10-21-311",
          { overlapEquivalentRoundCount: 1, chainedGroupRoundCount: 0 },
        ],
        [
          "離れた3つの数字を総地雷数と突き合わせる終盤",
          "ms-10x10-18-342",
          {
            overlapEquivalentRoundCount: 0,
            multiNumberTotalMineCountRoundCount: 1,
            chainedGroupRoundCount: 0,
          },
        ],
        ["3つの数字の連鎖", "ms-12x10-25-290", { chainedGroupRoundCount: 1 }],
      ] satisfies [string, string, Partial<MinesweeperHumanSolveFeatures>][]
    ).map(
      ([name, seed, expected]) =>
        [name, restoreReviewProblem(seed), expected] as const,
    );

    test.each(cases)("%sのラウンドを数えること", (_name, problem, expected) => {
      const result = analyzeMinesweeperDifficulty(problem);

      expect(result).toMatchObject({ status: "analyzed", features: expected });
    });
  });

  describe("推測が必要な問題の場合", () => {
    const problem: MinesweeperProblem = {
      board: { rows: 3, columns: 2, mineCellIndices: [0] },
      initialRevealedCellIndices: [2, 3, 4, 5],
    };

    test("成立しない問題として返すこと", () => {
      const result = analyzeMinesweeperDifficulty(problem);

      expect(result.status).toBe("unsolvable");
    });
  });

  describe("人間モデルの推論幅を超える問題の場合", () => {
    const problem: MinesweeperProblem = {
      board: { rows: 3, columns: 7, mineCellIndices: [0, 1, 4, 7, 13] },
      initialRevealedCellIndices: [8, 9, 10, 11, 12, 15, 16, 17, 18, 19],
    };

    test("人間モデル範囲外として理由を返すこと", () => {
      const result = analyzeMinesweeperDifficulty(problem, {
        maximumInferenceWidth: 2,
      });

      expect(result).toMatchObject({
        status: "unsupported",
        reason: "technique-limit",
      });
    });
  });
});
