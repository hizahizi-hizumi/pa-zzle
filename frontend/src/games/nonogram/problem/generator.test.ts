import { nonogramSolveCell } from "@/games/nonogram/problem/generation/line-solver";
import {
  createUnknownNonogramSolveGrid,
  propagateNonogramLineReadings,
} from "@/games/nonogram/problem/generation/propagation";
import { countNonogramSolutions } from "@/games/nonogram/problem/generation/solution-count";
import { getNonogramSymmetryKey } from "@/games/nonogram/problem/generation/symmetry";
import {
  _private,
  createNonogramCandidateIdentity,
  generateNonogramProblem,
  type NonogramGeneratedProblem,
} from "@/games/nonogram/problem/generator";
import {
  assertNonogramProblem,
  createNonogramProblemIdentity,
  type NONOGRAM_GENERATOR_VERSION,
  type NonogramProblem,
  type NonogramProblemIdentity,
  nonogramBoardSizes,
  nonogramPatternStyles,
} from "@/games/nonogram/problem/problem";
import { parseNonogramPattern } from "@/games/nonogram/puzzle/pattern";

const { findNonogramPatternRejection } = _private;

const candidatesPerSize = 30;

/** 何も決まっていない盤面から、線の読みを固定点まで進める。 */
function readFromUnknownGrid(problem: NonogramProblem) {
  const grid = createUnknownNonogramSolveGrid(problem);
  const status = propagateNonogramLineReadings(problem.clues, grid);
  return { status, grid };
}

function generateCandidates() {
  return nonogramBoardSizes.flatMap((size) =>
    Array.from({ length: candidatesPerSize }, (_, candidateIndex) => {
      const identity = createNonogramCandidateIdentity(size, candidateIndex);
      return { identity, result: generateNonogramProblem(identity) };
    }),
  );
}

describe("findNonogramPatternRejection", () => {
  describe("研究用 Python の採否との照合", () => {
    // scripts/research/nonogram_experiment.py の passes_pattern_filter と nonogram_core.py の line_solvable で決めた採否。
    const cases: readonly {
      name: string;
      pattern: readonly string[];
      rejection: "pattern-requirements" | "not-line-solvable" | null;
    }[] = [
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
        rejection: "pattern-requirements",
      },
      {
        name: "7×7（候補 1）",
        pattern: [
          "...####",
          "..#####",
          ".######",
          "#######",
          "####...",
          "###....",
          "###....",
        ],
        rejection: null,
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
        rejection: "not-line-solvable",
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
        rejection: "pattern-requirements",
      },
    ];

    test.each(cases)(
      "$name で、同じ採否にすること",
      ({ pattern, rejection }) => {
        const result = findNonogramPatternRejection(
          parseNonogramPattern(pattern),
        );

        expect(result).toBe(rejection);
      },
    );
  });
});

describe("generateNonogramProblem", () => {
  describe("全大きさの候補の場合", () => {
    const candidates = generateCandidates();
    const accepted = candidates.flatMap(({ result }) =>
      result.status === "accepted" ? [result.generated] : [],
    );
    const rejected = candidates.flatMap(({ result }) =>
      result.status === "rejected" ? [result] : [],
    );
    const acceptedCases = accepted.map(
      (generated) => [generated.identity.seed, generated] as const,
    );

    test("どの大きさでも問題を採り、図柄の条件と線の読みの両方の理由で除く候補もあること", () => {
      const acceptedSizes = new Set(
        accepted.map(({ problem }) => `${problem.width}x${problem.height}`),
      );
      const reasons = new Set(rejected.map(({ reason }) => reason));

      expect(acceptedSizes.size).toBe(nonogramBoardSizes.length);
      expect(reasons).toEqual(
        new Set(["pattern-requirements", "not-line-solvable"]),
      );
    });

    test.each(acceptedCases)(
      "%s で、成立した問題を identity の大きさで作ること",
      (_, { problem, identity }) => {
        const act = () => assertNonogramProblem(problem);

        expect(act).not.toThrow();
        expect(problem.width).toBe(identity.conditions.width);
        expect(problem.height).toBe(identity.conditions.height);
      },
    );

    test.each(acceptedCases)(
      "%s で、線の読みだけで図柄どおりに全マスが決まること",
      (_, { problem }) => {
        const { status, grid } = readFromUnknownGrid(problem);

        expect(status).toBe("complete");
        expect(grid.cells).toEqual(
          problem.solution.black.map((isBlack) =>
            isBlack ? nonogramSolveCell.black : nonogramSolveCell.white,
          ),
        );
      },
    );

    test.each(acceptedCases)(
      "%s で、仮置きを含む探索でも解がただ1つであること",
      (_, { problem }) => {
        const count = countNonogramSolutions(problem.clues);

        expect(count).toEqual({
          status: "complete",
          solutionCount: 1,
          searchNodeCount: 1,
        });
      },
    );

    test.each(acceptedCases)(
      "%s で、図柄の正規化キーを添えること",
      (_, generated: NonogramGeneratedProblem) => {
        const symmetryKey = getNonogramSymmetryKey(generated.problem.solution);

        expect(generated.symmetryKey).toBe(symmetryKey);
      },
    );

    test("除いた候補は、除いた理由と同じ判定を図柄に返すこと", () => {
      const reasons = rejected.map(({ pattern }) =>
        findNonogramPatternRejection(pattern),
      );

      expect(reasons).toEqual(rejected.map(({ reason }) => reason));
    });
  });

  describe("同じ identity の場合", () => {
    const identity = createNonogramCandidateIdentity(
      { width: 10, height: 12 },
      7,
    );

    test("同じ結果を返すこと", () => {
      const first = generateNonogramProblem(identity);
      const second = generateNonogramProblem({
        ...identity,
        conditions: { ...identity.conditions },
      });

      expect(second).toEqual(first);
    });
  });

  describe("今の生成器で扱えない identity の場合", () => {
    const valid = createNonogramCandidateIdentity({ width: 8, height: 8 }, 0);
    const cases: readonly [string, NonogramProblemIdentity][] = [
      [
        "横長の盤面",
        { ...valid, conditions: { ...valid.conditions, width: 10, height: 8 } },
      ],
      [
        "扱わない黒の確率",
        {
          ...valid,
          conditions: {
            ...valid.conditions,
            blackProbability:
              0.4 as NonogramProblemIdentity["conditions"]["blackProbability"],
          },
        },
      ],
      [
        "別の生成器の版",
        {
          ...valid,
          generatorVersion: "0" as typeof NONOGRAM_GENERATOR_VERSION,
        },
      ],
    ];

    test.each(cases)("%s を拒否すること", (_, identity) => {
      const act = () => generateNonogramProblem(identity);

      expect(act).toThrow();
    });
  });
});

describe("createNonogramCandidateIdentity", () => {
  const size = { width: 9, height: 9 };
  const identities = Array.from(
    { length: nonogramPatternStyles.length },
    (_, candidateIndex) =>
      createNonogramCandidateIdentity(size, candidateIndex),
  );

  test("続く候補番号で、図柄の作り方を1つずつ順に使うこと", () => {
    const styles = identities.map(
      ({ conditions: { blackProbability, smoothingCount, mirrored } }) => ({
        blackProbability,
        smoothingCount,
        mirrored,
      }),
    );

    expect(styles).toEqual(nonogramPatternStyles);
  });

  test("候補番号ごとに別の seed を使うこと", () => {
    const seeds = new Set(identities.map(({ seed }) => seed));

    expect(seeds.size).toBe(identities.length);
  });

  describe("作り方を絞って渡した場合", () => {
    const styles = nonogramPatternStyles.filter(
      (style) => !style.mirrored && style.blackProbability === 0.45,
    );

    test("渡した作り方だけを巡回すること", () => {
      const identity = createNonogramCandidateIdentity(size, 4, styles);

      expect(identity).toEqual(
        createNonogramProblemIdentity(size, styles[4 % styles.length]!, 4),
      );
    });
  });
});
