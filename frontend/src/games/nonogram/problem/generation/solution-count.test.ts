import { isNonogramLineSolvable } from "@/games/nonogram/problem/generation/propagation";
import { countNonogramSolutions } from "@/games/nonogram/problem/generation/solution-count";
import { computeNonogramClues } from "@/games/nonogram/puzzle/clue";
import {
  type NonogramPattern,
  parseNonogramPattern,
} from "@/games/nonogram/puzzle/pattern";
import { createProblemSeededRandom } from "@/games/problem-seed";

function createRandomSmallPatterns(count: number): NonogramPattern[] {
  const random = createProblemSeededRandom("nonogram-solution-count");
  return Array.from({ length: count }, function createPattern() {
    const width = 2 + Math.floor(random() * 3);
    const height = 2 + Math.floor(random() * 3);
    return {
      width,
      height,
      black: Array.from({ length: width * height }, () => random() < 0.5),
    };
  });
}

function encodeLineClue(
  isBlackAt: (position: number) => boolean,
  length: number,
): string {
  const runs: number[] = [];
  let runLength = 0;
  for (let position = 0; position < length; position += 1) {
    if (isBlackAt(position)) {
      runLength += 1;
    } else if (runLength > 0) {
      runs.push(runLength);
      runLength = 0;
    }
  }
  if (runLength > 0) {
    runs.push(runLength);
  }
  return runs.join(",");
}

/** 行優先のビット列で表した図柄のヒントを、比べられる文字列にする。 */
function encodeCluesOfBits(
  width: number,
  height: number,
  bits: number,
): string {
  function isBlackAt(row: number, column: number): boolean {
    return ((bits >> (row * width + column)) & 1) === 1;
  }
  const rows = Array.from({ length: height }, (_, row) =>
    encodeLineClue((column) => isBlackAt(row, column), width),
  );
  const columns = Array.from({ length: width }, (_, column) =>
    encodeLineClue((row) => isBlackAt(row, column), height),
  );
  return `${rows.join("/")}|${columns.join("/")}`;
}

function toBits(pattern: NonogramPattern): number {
  return pattern.black.reduce(
    (bits, isBlack, cellIndex) => (isBlack ? bits | (1 << cellIndex) : bits),
    0,
  );
}

/** 同じ大きさの黒白の全並びをヒントで分け、図柄ごとに、ヒントが同じになる並びの数を返す。 */
function countSolutionsByEnumeration(
  patterns: readonly NonogramPattern[],
): number[] {
  const countsBySize = new Map<string, Map<string, number>>();
  function countsOfSize(width: number, height: number): Map<string, number> {
    const sizeKey = `${width}x${height}`;
    const cached = countsBySize.get(sizeKey);
    if (cached !== undefined) {
      return cached;
    }
    const counts = new Map<string, number>();
    for (let bits = 0; bits < 1 << (width * height); bits += 1) {
      const key = encodeCluesOfBits(width, height, bits);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    countsBySize.set(sizeKey, counts);
    return counts;
  }
  return patterns.map(function countSameClues(pattern) {
    const { width, height } = pattern;
    const key = encodeCluesOfBits(width, height, toBits(pattern));
    return countsOfSize(width, height).get(key) ?? 0;
  });
}

describe("countNonogramSolutions", () => {
  describe("研究用 Python の解の数え上げとの照合", () => {
    // scripts/research/nonogram_core.py の count_solutions が、既定の上限（解2個・節点 20,000）と
    // 節点3までの上限で返した結果。線の読みで止まる候補（一意だが仮置きが要るものと複数解）を含む。
    const cases = [
      {
        name: "8×8（候補 4）",
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
        expected: { status: "complete", solutionCount: 1, searchNodeCount: 1 },
        expectedWithinThreeNodes: {
          status: "complete",
          solutionCount: 1,
          searchNodeCount: 1,
        },
      },
      {
        name: "7×7（候補 3）",
        pattern: [
          "...#...",
          "...#...",
          "##.#.##",
          "#######",
          "#######",
          "#.....#",
          "#.....#",
        ],
        expected: { status: "complete", solutionCount: 2, searchNodeCount: 4 },
        expectedWithinThreeNodes: {
          status: "aborted",
          solutionCount: 1,
          searchNodeCount: 4,
        },
      },
      {
        name: "8×8（候補 5）",
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
        expected: { status: "complete", solutionCount: 2, searchNodeCount: 3 },
        expectedWithinThreeNodes: {
          status: "complete",
          solutionCount: 2,
          searchNodeCount: 3,
        },
      },
      {
        name: "9×9（候補 11）",
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
        expected: { status: "complete", solutionCount: 2, searchNodeCount: 6 },
        expectedWithinThreeNodes: {
          status: "aborted",
          solutionCount: 1,
          searchNodeCount: 4,
        },
      },
      {
        name: "10×10（候補 15）",
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
        expected: { status: "complete", solutionCount: 1, searchNodeCount: 5 },
        expectedWithinThreeNodes: {
          status: "aborted",
          solutionCount: 0,
          searchNodeCount: 4,
        },
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
        expected: { status: "complete", solutionCount: 2, searchNodeCount: 10 },
        expectedWithinThreeNodes: {
          status: "aborted",
          solutionCount: 0,
          searchNodeCount: 4,
        },
      },
      {
        name: "10×12（候補 19）",
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
        expected: { status: "complete", solutionCount: 2, searchNodeCount: 4 },
        expectedWithinThreeNodes: {
          status: "aborted",
          solutionCount: 1,
          searchNodeCount: 4,
        },
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
        expected: { status: "complete", solutionCount: 2, searchNodeCount: 5 },
        expectedWithinThreeNodes: {
          status: "aborted",
          solutionCount: 1,
          searchNodeCount: 4,
        },
      },
      {
        name: "10×15（候補 27）",
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
        expected: { status: "complete", solutionCount: 1, searchNodeCount: 3 },
        expectedWithinThreeNodes: {
          status: "complete",
          solutionCount: 1,
          searchNodeCount: 3,
        },
      },
    ].map((testCase) => ({
      ...testCase,
      clues: computeNonogramClues(parseNonogramPattern(testCase.pattern)),
    }));

    test.each(cases)(
      "$name で、解の数と探索の節点数が同じになること",
      ({ clues, expected }) => {
        const result = countNonogramSolutions(clues);

        expect(result).toEqual(expected);
      },
    );

    test.each(cases)(
      "$name で、節点3までで打ち切ったときの解の数と節点数が同じになること",
      ({ clues, expectedWithinThreeNodes }) => {
        const result = countNonogramSolutions(clues, { searchNodeLimit: 3 });

        expect(result).toEqual(expectedWithinThreeNodes);
      },
    );
  });

  describe("2×2〜4×4 の無作為な図柄の場合", () => {
    const patterns = createRandomSmallPatterns(150);
    const enumeratedCounts = countSolutionsByEnumeration(patterns);
    const lineSolvableCounts = enumeratedCounts.filter((_, patternIndex) =>
      isNonogramLineSolvable(computeNonogramClues(patterns[patternIndex]!)),
    );
    const limits = { solutionLimit: 99 };

    test("解の数が、黒白の全並びのうちヒントが同じになるものの数と一致すること", () => {
      const solutionCounts = patterns.map(
        (pattern) =>
          countNonogramSolutions(computeNonogramClues(pattern), limits)
            .solutionCount,
      );

      expect(solutionCounts).toEqual(enumeratedCounts);
    });

    test("線の読みだけで解ける図柄は、解がただ1つであること", () => {
      const distinctCounts = new Set(lineSolvableCounts);

      expect(lineSolvableCounts.length).toBeGreaterThan(0);
      expect(distinctCounts).toEqual(new Set([1]));
    });
  });
});
