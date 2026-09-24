import { analyzeMinesweeperDifficulty } from "./difficulty-analysis";
import { generateMinesweeperProblem } from "./generator";
import type { MinesweeperProblem } from "./problem";

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
