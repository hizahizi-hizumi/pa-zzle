import {
  type NonogramSolveCell,
  nonogramSolveCell,
  solveNonogramLineByEdges,
} from "@/games/nonogram/problem/generation/line-solver";
import {
  countNonogramReadingsBeyondEdges,
  createUnknownNonogramSolveGrid,
  isNonogramLineSolvable,
  type NonogramReadingTrace,
  type NonogramSolveGrid,
  propagateNonogramLineReadings,
  traceNonogramReadingRounds,
} from "@/games/nonogram/problem/generation/propagation";
import { computeNonogramClues } from "@/games/nonogram/puzzle/clue";
import { parseNonogramPattern } from "@/games/nonogram/puzzle/pattern";

/** 行ごとに `#` が黒、`x` が白、`.` が未確定。 */
function formatGrid(grid: NonogramSolveGrid): string[] {
  return Array.from({ length: grid.height }, (_, row) =>
    grid.cells
      .slice(row * grid.width, (row + 1) * grid.width)
      .map((cell: NonogramSolveCell) =>
        cell === nonogramSolveCell.black
          ? "#"
          : cell === nonogramSolveCell.white
            ? "x"
            : ".",
      )
      .join(""),
  );
}

function toSolvedGridRows(patternRows: readonly string[]): string[] {
  return patternRows.map((row) => row.replaceAll(".", "x"));
}

/** 研究用 Python の `analyze` と同じ量を段の記録から求める。 */
function summarizeRounds({ rounds }: NonogramReadingTrace, cellCount: number) {
  const progressedLineCounts = rounds.map((round) => round.progressedLineCount);
  return {
    roundCount: rounds.length,
    entryLineCount: rounds[0]?.progressedLineCount ?? 0,
    firstRoundRatio: (rounds[0]?.fixedCellCount ?? 0) / cellCount,
    minimumProgressedLineCount:
      rounds.length === 0 ? null : Math.min(...progressedLineCounts),
    narrowRoundCount: progressedLineCounts.filter((count) => count <= 2).length,
  };
}

// scripts/research/nonogram_core.py で seed 17 から作った候補と、propagate・line_solvable・analyze が返した結果。
// 大きさごとに、線の読みで解ける候補と止まる候補を1つずつ含む。
const pythonPropagations = [
  {
    name: "7×7・線の読みで解ける（候補 1）",
    pattern: [
      "...####",
      "..#####",
      ".######",
      "#######",
      "####...",
      "###....",
      "###....",
    ],
    stalledGrid: null,
    rounds: {
      roundCount: 5,
      entryLineCount: 12,
      firstRoundRatio: 0.40816326530612246,
      minimumProgressedLineCount: 2,
      narrowRoundCount: 1,
    },
  },
  {
    name: "7×7・線の読みで止まる（候補 3）",
    pattern: [
      "...#...",
      "...#...",
      "##.#.##",
      "#######",
      "#######",
      "#.....#",
      "#.....#",
    ],
    stalledGrid: [
      ".xx.xx.",
      ".xx.xx.",
      "##x#x##",
      "#######",
      "#######",
      ".xx.xx.",
      ".xx.xx.",
    ],
    rounds: {
      roundCount: 2,
      entryLineCount: 6,
      firstRoundRatio: 0.42857142857142855,
      minimumProgressedLineCount: 4,
      narrowRoundCount: 0,
    },
  },
  {
    name: "8×8・線の読みで解ける（候補 4）",
    pattern: [
      ".#....#.",
      ".#.##.#.",
      "........",
      "###..###",
      "#..##..#",
      "..#..#..",
      "#.#..#.#",
      "##....##",
    ],
    stalledGrid: null,
    rounds: {
      roundCount: 6,
      entryLineCount: 2,
      firstRoundRatio: 0.1875,
      minimumProgressedLineCount: 2,
      narrowRoundCount: 3,
    },
  },
  {
    name: "8×8・線の読みで止まる（候補 5）",
    pattern: [
      "######..",
      ".#.#....",
      "..#...##",
      ".#...##.",
      "##.##...",
      "####....",
      "#....###",
      ".#..#.##",
    ],
    stalledGrid: [
      "######xx",
      "x#x#xxxx",
      "xx#xx.#.",
      "x#xxx.#.",
      "##x##xxx",
      "####xxxx",
      "#xxxx###",
      "x#xx#x##",
    ],
    rounds: {
      roundCount: 7,
      entryLineCount: 2,
      firstRoundRatio: 0.1875,
      minimumProgressedLineCount: 1,
      narrowRoundCount: 3,
    },
  },
  {
    name: "9×9・線の読みで解ける（候補 9）",
    pattern: [
      "#..##....",
      "####....#",
      ".###.#...",
      "#..###..#",
      "#...####.",
      "#.#......",
      "......###",
      "...##.#.#",
      "#..##..##",
    ],
    stalledGrid: null,
    rounds: {
      roundCount: 9,
      entryLineCount: 6,
      firstRoundRatio: 0.1111111111111111,
      minimumProgressedLineCount: 2,
      narrowRoundCount: 2,
    },
  },
  {
    name: "9×9・線の読みで止まる（候補 11）",
    pattern: [
      "#....##..",
      "..#..##..",
      "....##.##",
      "#.#..#..#",
      "#...##.#.",
      ".##.##.##",
      "##...#.##",
      "#..###..#",
      ".#..##...",
    ],
    stalledGrid: [
      ".....#...",
      ".....#...",
      ".....#...",
      "....x#x..",
      "...x##x..",
      ".#.x##x##",
      "....x#...",
      "....##...",
      "...x##xxx",
    ],
    rounds: {
      roundCount: 3,
      entryLineCount: 3,
      firstRoundRatio: 0.16049382716049382,
      minimumProgressedLineCount: 3,
      narrowRoundCount: 0,
    },
  },
  {
    name: "10×10・線の読みで解ける（候補 13）",
    pattern: [
      ".######..#",
      "#######...",
      "##...####.",
      "#..#######",
      "##.#.#.###",
      "##########",
      "###....###",
      ".###..####",
      ".###....##",
      "..##...###",
    ],
    stalledGrid: null,
    rounds: {
      roundCount: 3,
      entryLineCount: 16,
      firstRoundRatio: 0.57,
      minimumProgressedLineCount: 8,
      narrowRoundCount: 0,
    },
  },
  {
    name: "10×10・線の読みで止まる（候補 15）",
    pattern: [
      "##..##..##",
      "..#.##.#..",
      ".###..###.",
      "#.##..##.#",
      "#..#..#..#",
      ".#.#..#.#.",
      "##.#..#.##",
      "..#.##.#..",
      "....##....",
      "...#..#...",
    ],
    stalledGrid: [
      "..........",
      "..........",
      "..........",
      "...#..#...",
      "..x#xx#x..",
      "..........",
      ".#......#.",
      "..........",
      "..........",
      "..........",
    ],
    rounds: {
      roundCount: 2,
      entryLineCount: 4,
      firstRoundRatio: 0.06,
      minimumProgressedLineCount: 1,
      narrowRoundCount: 1,
    },
  },
  {
    name: "10×12・線の読みで解ける（候補 17）",
    pattern: [
      "#.##..#...",
      "####.#.##.",
      "###.......",
      ".#...##.##",
      "##..###.##",
      "#.#...#..#",
      "#....###.#",
      "#....#..##",
      "#..##..#..",
      ".##.###.##",
      "##..#.###.",
      "##.#..##..",
    ],
    stalledGrid: null,
    rounds: {
      roundCount: 7,
      entryLineCount: 6,
      firstRoundRatio: 0.23333333333333334,
      minimumProgressedLineCount: 2,
      narrowRoundCount: 1,
    },
  },
  {
    name: "10×12・線の読みで止まる（候補 19）",
    pattern: [
      ".##..####.",
      "#.#.#.....",
      "..#.##.###",
      ".#..####..",
      ".#.#.....#",
      ".###...###",
      "##....#..#",
      "..##.#####",
      "#.#.#..#.#",
      ".##..#.#.#",
      ".##..#.###",
      "#....#.###",
    ],
    stalledGrid: [
      "x##xx####x",
      "#x#x#xxxxx",
      "xx#x##x###",
      "..xx####xx",
      "x#x#xxxxx#",
      "x###xxx###",
      "##xxxx#xx#",
      "x.#.x#####",
      "#x#x#xx#x#",
      "x.#.x#x#x#",
      "x##xx#x###",
      "..x.x#x###",
    ],
    rounds: {
      roundCount: 9,
      entryLineCount: 9,
      firstRoundRatio: 0.21666666666666667,
      minimumProgressedLineCount: 1,
      narrowRoundCount: 3,
    },
  },
  {
    name: "10×13・線の読みで解ける（候補 21）",
    pattern: [
      "###.......",
      "###....#..",
      "....#####.",
      ".......##.",
      ".....#####",
      "###....###",
      "##....####",
      "##...#####",
      "#######...",
      "###..#....",
      "###.......",
      "##.......#",
      "##........",
    ],
    stalledGrid: null,
    rounds: {
      roundCount: 8,
      entryLineCount: 6,
      firstRoundRatio: 0.16153846153846155,
      minimumProgressedLineCount: 2,
      narrowRoundCount: 3,
    },
  },
  {
    name: "10×13・線の読みで止まる（候補 22）",
    pattern: [
      "..#.####..",
      "#.##..#...",
      ".#.#..###.",
      "####..##..",
      "#.##....#.",
      "..##......",
      "#.##.##..#",
      ".#...#...#",
      "#..###.#..",
      "#.##..###.",
      "#.#..##..#",
      ".####..#..",
      ".##....#.#",
    ],
    stalledGrid: [
      "xx#x.###.x",
      "#x##xx#xxx",
      "x#x#xx###x",
      "####xx##xx",
      "#x##xxxx#x",
      "xx##xxxxxx",
      "#x##x.#...",
      "x.xx..x.x#",
      "..x#.#....",
      "#x##x..#..",
      "#x#x......",
      ".###......",
      "x##x......",
    ],
    rounds: {
      roundCount: 8,
      entryLineCount: 5,
      firstRoundRatio: 0.1076923076923077,
      minimumProgressedLineCount: 1,
      narrowRoundCount: 2,
    },
  },
  {
    name: "10×15・線の読みで解ける（候補 25）",
    pattern: [
      "##.##.###.",
      ".####..#.#",
      "#.#.#.###.",
      "#..####...",
      "#...#...##",
      "##.###.#.#",
      ".....#.#..",
      "...#.###.#",
      "#.#.#.#.#.",
      "#.####.#.#",
      ".#.....#.#",
      ".#.###.#.#",
      "#.#..##.##",
      "#.#.#....#",
      "#.#.#.#.##",
    ],
    stalledGrid: null,
    rounds: {
      roundCount: 5,
      entryLineCount: 11,
      firstRoundRatio: 0.35333333333333333,
      minimumProgressedLineCount: 2,
      narrowRoundCount: 1,
    },
  },
  {
    name: "10×15・線の読みで止まる（候補 27）",
    pattern: [
      "##..##..##",
      "..##..##..",
      ".###..###.",
      "##.#..#.##",
      "#........#",
      "#.######.#",
      ".##....##.",
      "#..#..#..#",
      "....##....",
      "..######..",
      "####..####",
      "###.##.###",
      "....##....",
      "###.##.###",
      "..######..",
    ],
    stalledGrid: [
      "##x....x##",
      "xx##xx##xx",
      "x###xx###x",
      "##x....x##",
      "#xxxxxxxx#",
      "#x######x#",
      "x##xxxx##x",
      "#xx#xx#xx#",
      "xxxx##xxxx",
      "xx######xx",
      "####xx####",
      "###x##x###",
      "xxxx##xxxx",
      "###x##x###",
      "xx######xx",
    ],
    rounds: {
      roundCount: 7,
      entryLineCount: 7,
      firstRoundRatio: 0.28,
      minimumProgressedLineCount: 1,
      narrowRoundCount: 3,
    },
  },
].map((testCase) => {
  const pattern = parseNonogramPattern(testCase.pattern);
  return {
    ...testCase,
    clues: computeNonogramClues(pattern),
    cellCount: pattern.width * pattern.height,
  };
});

describe("propagateNonogramLineReadings", () => {
  describe("研究用 Python の結果との照合", () => {
    describe.each(pythonPropagations)(
      "$name",
      ({ clues, pattern, stalledGrid }) => {
        let grid: NonogramSolveGrid;

        beforeEach(() => {
          grid = createUnknownNonogramSolveGrid({
            width: clues.columns.length,
            height: clues.rows.length,
          });
        });

        test("行き着く盤面が同じになること", () => {
          const status = propagateNonogramLineReadings(clues, grid);

          expect(status).toBe(stalledGrid === null ? "complete" : "stalled");
          expect(formatGrid(grid)).toEqual(
            stalledGrid ?? toSolvedGridRows(pattern),
          );
        });
      },
    );
  });

  describe("2×2 の対角の図柄の場合", () => {
    const clues = computeNonogramClues(parseNonogramPattern(["#.", ".#"]));
    let grid: NonogramSolveGrid;

    beforeEach(() => {
      grid = createUnknownNonogramSolveGrid({ width: 2, height: 2 });
    });

    test("どのマスも決めずに止まること", () => {
      const status = propagateNonogramLineReadings(clues, grid);

      expect(status).toBe("stalled");
      expect(formatGrid(grid)).toEqual(["..", ".."]);
    });
  });

  describe("ヒントに合わないマスが入っている場合", () => {
    const clues = computeNonogramClues(parseNonogramPattern(["##", "##"]));
    let grid: NonogramSolveGrid;

    beforeEach(() => {
      grid = {
        width: 2,
        height: 2,
        cells: [
          nonogramSolveCell.white,
          nonogramSolveCell.unknown,
          nonogramSolveCell.unknown,
          nonogramSolveCell.unknown,
        ],
      };
    });

    test("矛盾を返すこと", () => {
      const status = propagateNonogramLineReadings(clues, grid);

      expect(status).toBe("contradicted");
    });
  });

  describe("完全な線の読みでは解けて端寄せの読みでは止まる図柄の場合", () => {
    // 研究用 Python の propagate に solve_line_lr を渡して同じ盤面で止まることを確かめた図柄。
    const clues = computeNonogramClues(
      parseNonogramPattern([".###.", "##...", ".####", "#...#", "....#"]),
    );
    let grid: NonogramSolveGrid;

    beforeEach(() => {
      grid = createUnknownNonogramSolveGrid({ width: 5, height: 5 });
    });

    test("既定の完全な線の読みで解き終えること", () => {
      const status = propagateNonogramLineReadings(clues, grid);

      expect(status).toBe("complete");
    });

    test("端寄せの読みを渡すと、端寄せの読みで決まるマスまでで止まること", () => {
      const status = propagateNonogramLineReadings(
        clues,
        grid,
        solveNonogramLineByEdges,
      );

      expect(status).toBe("stalled");
      expect(formatGrid(grid)).toEqual([
        "..#..",
        "..x..",
        "x####",
        "..x..",
        "..x..",
      ]);
    });
  });
});

describe("isNonogramLineSolvable", () => {
  describe("研究用 Python の結果との照合", () => {
    test.each(pythonPropagations)(
      "$name で、線の読みだけで解けるかが同じになること",
      ({ clues, stalledGrid }) => {
        const solvable = isNonogramLineSolvable(clues);

        expect(solvable).toBe(stalledGrid === null);
      },
    );
  });
});

describe("traceNonogramReadingRounds", () => {
  describe("研究用 Python の結果との照合", () => {
    test.each(pythonPropagations)(
      "$name で、段の数・最初の段で進めた行・列の数と決まった割合・進めた行・列の最小・細い段の数が同じになること",
      ({ clues, cellCount, stalledGrid, rounds }) => {
        const trace = traceNonogramReadingRounds(clues);

        expect(trace.status).toBe(
          stalledGrid === null ? "complete" : "stalled",
        );
        expect(summarizeRounds(trace, cellCount)).toEqual(rounds);
      },
    );
  });

  describe("5×5 がすべて黒の図柄の場合", () => {
    const clues = computeNonogramClues(
      parseNonogramPattern(Array.from({ length: 5 }, () => "#####")),
    );

    test("1段で、10本すべての行・列を進めて解き終えること", () => {
      const trace = traceNonogramReadingRounds(clues);

      expect(trace).toEqual({
        status: "complete",
        rounds: [{ progressedLineCount: 10, fixedCellCount: 25 }],
      });
    });
  });
});

describe("countNonogramReadingsBeyondEdges", () => {
  // 研究用 Python の count_full_only_lines が返した回数（止まるときは -1）。
  const cases = (
    [
      [
        "5×5 がすべて黒の図柄",
        ["#####", "#####", "#####", "#####", "#####"],
        0,
      ],
      [
        "端寄せの読みでは止まる図柄",
        [".###.", "##...", ".####", "#...#", "....#"],
        1,
      ],
      ["2×2 の対角の図柄", ["#.", ".#"], null],
    ] as const
  ).map(
    ([name, pattern, expected]) =>
      [
        name,
        computeNonogramClues(parseNonogramPattern(pattern)),
        expected,
      ] as const,
  );

  test.each(cases)(
    "%sで、完全な線の読みで初めて進む読みの回数を返すこと",
    (_, clues, expected) => {
      const count = countNonogramReadingsBeyondEdges(clues);

      expect(count).toBe(expected);
    },
  );
});
