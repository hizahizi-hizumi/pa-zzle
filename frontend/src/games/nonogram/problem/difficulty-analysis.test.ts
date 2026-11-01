import { analyzeNonogramDifficulty } from "@/games/nonogram/problem/difficulty-analysis";
import { createNonogramProblem } from "@/games/nonogram/problem/problem";
import { parseNonogramPattern } from "@/games/nonogram/puzzle/pattern";

describe("analyzeNonogramDifficulty", () => {
  describe("研究用 Python の analyze と同じ図柄", () => {
    // scripts/research/nonogram_core.py の generate_pattern で作った図柄と、analyze が返した特徴。
    // firstRoundFixedCellCount は first_round_ratio × area、readingsBeyondEdgesCount は full_only_lines。
    // clueShape は analyze に無いので、ヒントの塊の総数 / 行・列の本数を手で数えた値。
    const cases = [
      {
        name: "8×8・端寄せの読みだけで解ける",
        pattern: [
          "##....##",
          "###..###",
          "########",
          "########",
          "########",
          "..####..",
          "...##...",
          "........",
        ],
        expected: {
          scale: { width: 8, height: 8, cellCount: 64 },
          clueShape: { blockCountPerLine: 17 / 16 },
          features: {
            roundCount: 7,
            entryLineCount: 13,
            firstRoundFixedCellCount: 36,
            minimumProgressedLineCount: 1,
            narrowRoundCount: 3,
            readingsBeyondEdgesCount: 0,
          },
        },
      },
      {
        name: "10×10・端寄せの読みでは2回止まる",
        pattern: [
          "###....###",
          "..##.#.##.",
          "..###.####",
          "#..#....#.",
          "#...##.##.",
          ".#.##.....",
          "#.#.#.##.#",
          "##..#...#.",
          "..###...#.",
          "..#.#.##..",
        ],
        expected: {
          scale: { width: 10, height: 10, cellCount: 100 },
          clueShape: { blockCountPerLine: 56 / 20 },
          features: {
            roundCount: 13,
            entryLineCount: 6,
            firstRoundFixedCellCount: 20,
            minimumProgressedLineCount: 1,
            narrowRoundCount: 2,
            readingsBeyondEdgesCount: 2,
          },
        },
      },
      {
        name: "10×12・研究用の組み合わせ案でレベル5に当たる",
        pattern: [
          "##......##",
          "####....##",
          "####...###",
          "####.#####",
          "###...####",
          "##########",
          "....##....",
          "........##",
          ".......###",
          "......####",
          "....####..",
          "..###.#...",
        ],
        expected: {
          scale: { width: 10, height: 12, cellCount: 120 },
          clueShape: { blockCountPerLine: 38 / 22 },
          features: {
            roundCount: 12,
            entryLineCount: 7,
            firstRoundFixedCellCount: 33,
            minimumProgressedLineCount: 1,
            narrowRoundCount: 3,
            readingsBeyondEdgesCount: 1,
          },
        },
      },
      {
        name: "10×13・細い段が11段ある",
        pattern: [
          "##.#..#...",
          "..##.##.##",
          ".#...###..",
          "####.##...",
          "###.#.####",
          ".##.#.##.#",
          "#..##.#.##",
          "#......#.#",
          "..#..#.#..",
          "#...##.#..",
          ".####..#..",
          "#.#....##.",
          "##.#..#..#",
        ],
        expected: {
          scale: { width: 10, height: 13, cellCount: 130 },
          clueShape: { blockCountPerLine: 73 / 23 },
          features: {
            roundCount: 18,
            entryLineCount: 8,
            firstRoundFixedCellCount: 21,
            minimumProgressedLineCount: 1,
            narrowRoundCount: 11,
            readingsBeyondEdgesCount: 2,
          },
        },
      },
      {
        name: "10×15・端寄せの読みでは3回止まる",
        pattern: [
          "....##..##",
          "..#...##.#",
          ".......#..",
          "##..#.###.",
          "###..###..",
          ".......#..",
          "..#.###...",
          "##..#####.",
          "##....##..",
          "#....#####",
          "#.###.#.##",
          ".##.#.###.",
          "#...#.....",
          "..#..###.#",
          "####.#....",
        ],
        expected: {
          scale: { width: 10, height: 15, cellCount: 150 },
          clueShape: { blockCountPerLine: 73 / 25 },
          features: {
            roundCount: 11,
            entryLineCount: 7,
            firstRoundFixedCellCount: 21,
            minimumProgressedLineCount: 2,
            narrowRoundCount: 1,
            readingsBeyondEdgesCount: 3,
          },
        },
      },
    ].map(
      ({ name, pattern, expected }) =>
        [
          name,
          createNonogramProblem(parseNonogramPattern(pattern)),
          expected,
        ] as const,
    );

    test.each(cases)("%s図柄で、同じ特徴を返すこと", (_, problem, expected) => {
      const result = analyzeNonogramDifficulty(problem);

      expect(result).toEqual({ status: "analyzed", ...expected });
    });
  });

  describe("5×5 がすべて黒の図柄", () => {
    const problem = createNonogramProblem(
      parseNonogramPattern(["#####", "#####", "#####", "#####", "#####"]),
    );

    test("1段で10本すべてを進めて解き終えると測ること", () => {
      const result = analyzeNonogramDifficulty(problem);

      expect(result).toEqual({
        status: "analyzed",
        scale: { width: 5, height: 5, cellCount: 25 },
        clueShape: { blockCountPerLine: 1 },
        features: {
          roundCount: 1,
          entryLineCount: 10,
          firstRoundFixedCellCount: 25,
          minimumProgressedLineCount: 10,
          narrowRoundCount: 0,
          readingsBeyondEdgesCount: 0,
        },
      });
    });
  });

  describe("黒の無い行と、塊が2つの行・列がある図柄", () => {
    // 行ヒントは [1 1]・[]・[3]、列ヒントは [1 1]・[1]・[1 1] で、6本に塊が計8個。
    const problem = createNonogramProblem(
      parseNonogramPattern(["#.#", "...", "###"]),
    );

    test("黒の無い行を塊0個と数えて、行・列あたりの塊の数を測ること", () => {
      const result = analyzeNonogramDifficulty(problem);

      expect(result).toMatchObject({
        status: "analyzed",
        clueShape: { blockCountPerLine: 8 / 6 },
      });
    });
  });

  describe("解はただ1つだが線の読みだけでは止まる図柄", () => {
    // 研究用 Python の count_solutions で解が1つ、propagate で14マスが決まらずに止まる。
    const problem = createNonogramProblem(
      parseNonogramPattern([
        "###..##",
        "##...##",
        "#....##",
        ".......",
        "..###..",
        "##.....",
        "##...##",
      ]),
    );

    test("評価不能とすること", () => {
      const result = analyzeNonogramDifficulty(problem);

      expect(result).toEqual({
        status: "unsupported",
        scale: { width: 7, height: 7, cellCount: 49 },
      });
    });
  });

  describe("ヒントに合う解が2つ以上ある図柄", () => {
    // 研究用 Python の count_solutions で解が2つ以上。
    const problem = createNonogramProblem(
      parseNonogramPattern([
        "##.#...#.",
        ".###.####",
        "#.###..#.",
        ".#...####",
        ".##.###..",
        ".....#.#.",
        "#####.##.",
        "#.#....#.",
        ".#.#.#...",
      ]),
    );

    test("成立しない問題とすること", () => {
      const result = analyzeNonogramDifficulty(problem);

      expect(result).toEqual({
        status: "invalid",
        reason: "multiple-solutions",
        scale: { width: 9, height: 9, cellCount: 81 },
      });
    });
  });
});
