import {
  measureNonogramPatternQuality,
  meetsNonogramPatternRequirements,
} from "@/games/nonogram/problem/generation/pattern-quality";
import { parseNonogramPattern } from "@/games/nonogram/puzzle/pattern";

// scripts/research/nonogram_core.py の pattern_quality と、nonogram_experiment.py の passes_pattern_filter が返した結果。
const pythonPatternQualities = [
  {
    name: "7×7（候補 0）",
    pattern: [
      "...#...",
      "...#...",
      "##.#.##",
      ".#...#.",
      "#.#.#.#",
      ".#...#.",
      ".#...#.",
    ],
    quality: {
      blackRatio: 0.3469387755102041,
      blankRowCount: 0,
      blankColumnCount: 0,
      isolatedBlackRatio: 0.23529411764705882,
      blackComponentCount: 9,
      mirrorSymmetric: true,
    },
    meetsRequirements: false,
  },
  {
    name: "8×8（候補 6）",
    pattern: [
      "........",
      "........",
      "........",
      "..####..",
      ".######.",
      ".#.##.#.",
      ".#....#.",
      "##.##.##",
    ],
    quality: {
      blackRatio: 0.34375,
      blankRowCount: 3,
      blankColumnCount: 0,
      isolatedBlackRatio: 0.0,
      blackComponentCount: 2,
      mirrorSymmetric: true,
    },
    meetsRequirements: false,
  },
  {
    name: "9×9（候補 10）",
    pattern: [
      "...###...",
      "..#####..",
      "..#####..",
      "###.#.###",
      "#.......#",
      "#.......#",
      ".........",
      ".........",
      "..#...#..",
    ],
    quality: {
      blackRatio: 0.32098765432098764,
      blankRowCount: 2,
      blankColumnCount: 0,
      isolatedBlackRatio: 0.07692307692307693,
      blackComponentCount: 3,
      mirrorSymmetric: true,
    },
    meetsRequirements: false,
  },
  {
    name: "10×10（候補 12）",
    pattern: [
      "#.######.#",
      "...#..#...",
      "#.##..##.#",
      "...#..#...",
      "..#.##.#..",
      "....##....",
      "##.#..#.##",
      "#.#.##.#.#",
      "##......##",
      "#.#.##.#.#",
    ],
    quality: {
      blackRatio: 0.46,
      blankRowCount: 0,
      blankColumnCount: 0,
      isolatedBlackRatio: 0.2608695652173913,
      blackComponentCount: 18,
      mirrorSymmetric: true,
    },
    meetsRequirements: false,
  },
  {
    name: "10×12（候補 16）",
    pattern: [
      "..######..",
      ".#..##..#.",
      "..#....#..",
      "#.######.#",
      "##..##..##",
      ".#......#.",
      ".#..##..#.",
      ".#.####.#.",
      "#.######.#",
      ".#.#..#.#.",
      "#.#....#.#",
      "..#....#..",
    ],
    quality: {
      blackRatio: 0.4666666666666667,
      blankRowCount: 0,
      blankColumnCount: 0,
      isolatedBlackRatio: 0.14285714285714285,
      blackComponentCount: 15,
      mirrorSymmetric: true,
    },
    meetsRequirements: false,
  },
  {
    name: "10×13（候補 20）",
    pattern: [
      "..#.##.#..",
      ".#.#..#.#.",
      ".#..##..#.",
      "####..####",
      "##.####.##",
      "#.#.##.#.#",
      "..#.##.#..",
      "##.#..#.##",
      "#.#....#.#",
      "#..#..#..#",
      "#.######.#",
      "..##..##..",
      ".#..##..#.",
    ],
    quality: {
      blackRatio: 0.5230769230769231,
      blankRowCount: 0,
      blankColumnCount: 0,
      isolatedBlackRatio: 0.14705882352941177,
      blackComponentCount: 19,
      mirrorSymmetric: true,
    },
    meetsRequirements: false,
  },
  {
    name: "10×15（候補 24）",
    pattern: [
      "..#....#..",
      "#........#",
      "..........",
      "#.#.##.#.#",
      "##..##..##",
      ".##.##.##.",
      ".###..###.",
      "###.##.###",
      "#..#..#..#",
      "...#..#...",
      "...####...",
      "...####...",
      "..######..",
      "..........",
      "###....###",
    ],
    quality: {
      blackRatio: 0.41333333333333333,
      blankRowCount: 2,
      blankColumnCount: 0,
      isolatedBlackRatio: 0.0967741935483871,
      blackComponentCount: 13,
      mirrorSymmetric: true,
    },
    meetsRequirements: false,
  },
  {
    name: "7×7（候補 2）",
    pattern: [
      "...#...",
      "#######",
      "###.###",
      "##.#.##",
      "#.#.#.#",
      ".#...#.",
      ".##.##.",
    ],
    quality: {
      blackRatio: 0.5918367346938775,
      blankRowCount: 0,
      blankColumnCount: 0,
      isolatedBlackRatio: 0.10344827586206896,
      blackComponentCount: 6,
      mirrorSymmetric: true,
    },
    meetsRequirements: true,
  },
  {
    name: "8×8（候補 7）",
    pattern: [
      "##.....#",
      "###..###",
      "..#.####",
      ".######.",
      "###.###.",
      "###..##.",
      "###.....",
      "###.....",
    ],
    quality: {
      blackRatio: 0.578125,
      blankRowCount: 0,
      blankColumnCount: 0,
      isolatedBlackRatio: 0.0,
      blackComponentCount: 1,
      mirrorSymmetric: false,
    },
    meetsRequirements: true,
  },
  {
    name: "10×13（候補 23）",
    pattern: [
      "##########",
      "##########",
      "##.####.##",
      "##########",
      "##########",
      "##########",
      "..######..",
      "..######..",
      "..##..##..",
      "..######..",
      "..........",
      "....##....",
      "....##....",
    ],
    quality: {
      blackRatio: 0.6461538461538462,
      blankRowCount: 1,
      blankColumnCount: 0,
      isolatedBlackRatio: 0.0,
      blackComponentCount: 2,
      mirrorSymmetric: true,
    },
    meetsRequirements: true,
  },
].map((testCase) => ({
  ...testCase,
  parsedPattern: parseNonogramPattern(testCase.pattern),
}));

describe("measureNonogramPatternQuality", () => {
  describe("研究用 Python の結果との照合", () => {
    test.each(pythonPatternQualities)(
      "$name で、同じ量を測ること",
      ({ parsedPattern, quality }) => {
        const measured = measureNonogramPatternQuality(parsedPattern);

        expect(measured).toEqual(quality);
      },
    );
  });
});

describe("meetsNonogramPatternRequirements", () => {
  describe("研究用 Python の結果との照合", () => {
    test.each(pythonPatternQualities)(
      "$name で、図柄の条件を満たすかが同じになること",
      ({ quality, meetsRequirements }) => {
        const meets = meetsNonogramPatternRequirements(quality);

        expect(meets).toBe(meetsRequirements);
      },
    );
  });

  const baseQuality = {
    blackRatio: 0.5,
    blankRowCount: 0,
    blankColumnCount: 0,
    isolatedBlackRatio: 0,
    blackComponentCount: 1,
    mirrorSymmetric: false,
  };
  const cases = [
    ["黒の割合が下限ちょうど", { blackRatio: 0.35 }, true],
    ["黒の割合が下限未満", { blackRatio: 0.34 }, false],
    ["黒の割合が上限ちょうど", { blackRatio: 0.72 }, true],
    ["黒の割合が上限超え", { blackRatio: 0.73 }, false],
    ["黒の無い行が1本", { blankRowCount: 1 }, true],
    [
      "黒の無い行と列が1本ずつ",
      { blankRowCount: 1, blankColumnCount: 1 },
      false,
    ],
    ["孤立した黒が上限ちょうど", { isolatedBlackRatio: 0.12 }, true],
    ["孤立した黒が上限超え", { isolatedBlackRatio: 0.13 }, false],
  ] as const;

  test.each(cases)("%s の図柄の採否を決めること", (_, override, expected) => {
    const meets = meetsNonogramPatternRequirements({
      ...baseQuality,
      ...override,
    });

    expect(meets).toBe(expected);
  });
});
