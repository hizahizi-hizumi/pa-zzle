import {
  _private,
  generateNonogramPatternCandidate,
} from "@/games/nonogram/problem/generation/pattern-generation";
import type { NonogramPatternStyle } from "@/games/nonogram/problem/problem";
import type { NonogramGridSize } from "@/games/nonogram/puzzle/board";
import {
  _private as nonogramPattern,
  parseNonogramPattern,
} from "@/games/nonogram/puzzle/pattern";
import type { ProblemRandom } from "@/games/problem-seed";

const { smoothNonogramPattern } = _private;
const { formatNonogramPattern } = nonogramPattern;

type ReplayedRandom = {
  random: ProblemRandom;
  usedCount: () => number;
};

/** 決めた乱数列を先頭から順に返す。 */
function replayRandoms(values: readonly number[]): ReplayedRandom {
  let index = 0;
  return {
    random() {
      const value = values[index];
      if (value === undefined) {
        throw new RangeError("Replayed randoms ran out");
      }
      index += 1;
      return value;
    },
    usedCount: () => index,
  };
}

describe("generateNonogramPatternCandidate", () => {
  describe("研究用 Python の図柄の生成との照合", () => {
    // scripts/research/nonogram_core.py の generate_pattern に同じ乱数列を与えて作った図柄。
    // 乱数列は小数2桁に丸めた値で、黒の確率と等しい値（黒にしない）を含む。
    const cases: readonly {
      name: string;
      size: NonogramGridSize;
      style: NonogramPatternStyle;
      randoms: readonly number[];
      pattern: readonly string[];
    }[] = [
      {
        name: "7×7・黒の確率 0.45・平滑化 0 回・左右対称",
        size: { width: 7, height: 7 },
        style: { blackProbability: 0.45, smoothingCount: 0, mirrored: true },
        randoms: [
          0.62, 0.74, 0.8, 0.94, 0.74, 0.92, 0.03, 0.47, 0.94, 0.65, 0.9, 0.11,
          0.47, 0.25, 0.54, 0.57, 0.01, 0.22, 0.28, 0.92, 0.77, 0.16, 0.8, 0.14,
          0.62, 0.13, 0.0, 0.87,
        ],
        pattern: [
          ".......",
          "..#.#..",
          "...#...",
          ".#...#.",
          "###.###",
          ".#.#.#.",
          ".##.##.",
        ],
      },
      {
        name: "7×7・黒の確率 0.55・平滑化 1 回・左右対称",
        size: { width: 7, height: 7 },
        style: { blackProbability: 0.55, smoothingCount: 1, mirrored: true },
        randoms: [
          0.21, 0.22, 0.98, 0.87, 0.29, 0.96, 0.54, 0.68, 0.2, 0.94, 0.69, 0.97,
          0.89, 0.3, 0.36, 0.17, 0.15, 0.07, 0.3, 0.6, 0.0, 0.68, 0.34, 0.31,
          0.82, 0.48, 0.32, 0.48,
        ],
        pattern: [
          "##...##",
          "##...##",
          "##.#.##",
          "#######",
          "#######",
          "#######",
          ".#####.",
        ],
      },
      {
        name: "8×8・黒の確率 0.5・平滑化 2 回・対称なし",
        size: { width: 8, height: 8 },
        style: { blackProbability: 0.5, smoothingCount: 2, mirrored: false },
        randoms: [
          0.7, 0.06, 0.98, 0.02, 0.75, 0.84, 0.02, 0.79, 0.37, 0.58, 0.01, 0.05,
          0.18, 0.96, 0.2, 0.76, 0.93, 0.94, 0.34, 0.35, 0.52, 0.78, 0.11, 0.75,
          0.8, 0.86, 0.04, 0.95, 0.09, 0.34, 0.61, 0.92, 0.34, 0.92, 0.55, 0.31,
          0.32, 0.18, 0.08, 0.15, 0.69, 1.0, 0.16, 0.05, 0.99, 0.53, 0.41, 0.24,
          0.59, 0.83, 0.46, 0.42, 0.06, 0.92, 0.03, 0.49, 0.84, 0.13, 0.73,
          0.95, 0.63, 0.79, 0.11, 0.43,
        ],
        pattern: [
          ".###....",
          "..###...",
          "..####..",
          "...####.",
          "...#####",
          "..######",
          "...#.###",
          "......##",
        ],
      },
      {
        name: "9×9・黒の確率 0.6・平滑化 1 回・左右対称",
        size: { width: 9, height: 9 },
        style: { blackProbability: 0.6, smoothingCount: 1, mirrored: true },
        randoms: [
          0.15, 0.84, 0.29, 0.45, 1.0, 0.85, 0.98, 0.45, 0.49, 0.73, 0.48, 0.29,
          0.4, 0.15, 0.38, 0.99, 0.96, 0.63, 0.5, 0.34, 0.09, 0.27, 0.78, 0.87,
          0.36, 0.79, 0.77, 0.69, 0.66, 0.76, 0.36, 0.7, 0.28, 0.49, 0.77, 0.69,
          0.29, 0.95, 0.65, 0.58, 0.01, 0.55, 0.25, 0.67, 0.46,
        ],
        pattern: [
          "..#####..",
          ".#######.",
          "..#####..",
          "#########",
          ".........",
          ".........",
          ".........",
          "####.####",
          "###...###",
        ],
      },
      {
        name: "8×8・黒の確率 0.65・平滑化 0 回・対称なし",
        size: { width: 8, height: 8 },
        style: { blackProbability: 0.65, smoothingCount: 0, mirrored: false },
        randoms: [
          0.82, 0.65, 0.8, 0.35, 0.64, 0.74, 0.83, 0.35, 0.84, 0.87, 0.69, 0.98,
          0.96, 0.52, 0.53, 0.17, 0.84, 0.94, 0.48, 0.69, 0.72, 0.73, 0.17,
          0.78, 0.58, 0.67, 0.42, 0.62, 0.77, 0.64, 0.72, 0.03, 0.16, 0.44,
          0.65, 0.22, 0.69, 0.63, 0.04, 0.47, 0.23, 0.05, 0.13, 0.32, 0.18,
          0.19, 0.04, 0.47, 0.38, 0.61, 0.59, 0.24, 0.9, 0.0, 0.41, 0.28, 0.41,
          0.12, 0.83, 0.37, 0.04, 0.61, 0.09, 0.55,
        ],
        pattern: [
          "...##..#",
          ".....###",
          "..#...#.",
          "#.##.#.#",
          "##.#.###",
          "########",
          "####.###",
          "##.#####",
        ],
      },
      {
        name: "9×9・黒の確率 0.45・平滑化 2 回・左右対称",
        size: { width: 9, height: 9 },
        style: { blackProbability: 0.45, smoothingCount: 2, mirrored: true },
        randoms: [
          0.34, 0.58, 0.96, 0.82, 0.42, 0.81, 0.64, 0.37, 0.14, 0.6, 0.56, 0.96,
          0.97, 0.61, 0.35, 0.89, 0.0, 0.11, 0.57, 0.62, 0.14, 0.63, 0.89, 0.38,
          0.43, 0.23, 0.29, 0.97, 0.38, 0.96, 0.91, 0.6, 0.26, 0.98, 0.5, 0.42,
          0.32, 0.98, 0.49, 0.29, 0.48, 0.12, 0.62, 0.44, 0.29,
        ],
        pattern: [
          ".........",
          ".........",
          ".........",
          ".........",
          "#.......#",
          "##.....##",
          "#.......#",
          "##.....##",
          "##..#..##",
        ],
      },
    ];

    test.each(cases)(
      "$name で、同じ図柄を作り、乱数を同じ数だけ使うこと",
      ({ size, style, randoms, pattern }) => {
        const replayed = replayRandoms(randoms);

        const generated = generateNonogramPatternCandidate(
          size,
          style,
          replayed.random,
        );

        expect(formatNonogramPattern(generated)).toEqual(pattern);
        expect(replayed.usedCount()).toBe(randoms.length);
      },
    );
  });

  describe("左右対称で平滑化しない場合", () => {
    const size = { width: 7, height: 2 };
    const style = {
      blackProbability: 0.5,
      smoothingCount: 0,
      mirrored: true,
    } as const;
    const replayed = replayRandoms([0.1, 0.9, 0.1, 0.9, 0.9, 0.1, 0.9, 0.1]);

    test("左半分と中央の列を乱数で決め、右半分へ写すこと", () => {
      const generated = generateNonogramPatternCandidate(
        size,
        style,
        replayed.random,
      );

      expect(formatNonogramPattern(generated)).toEqual(["#.#.#.#", ".#.#.#."]);
    });
  });
});

describe("smoothNonogramPattern", () => {
  const cases = [
    [
      "周りが黒の多い白マスは黒にする",
      ["###", "#.#", "###"],
      ["###", "###", "###"],
    ],
    ["黒白が同数のマスは元のまま残す", ["#.", ".#"], ["#.", ".#"]],
    ["孤立した黒マスは白にする", ["...", ".#.", "..."], ["...", "...", "..."]],
  ] as const;

  test.each(cases)("%s こと", (_, before, after) => {
    const smoothed = smoothNonogramPattern(parseNonogramPattern(before));

    expect(formatNonogramPattern(smoothed)).toEqual(after);
  });
});
