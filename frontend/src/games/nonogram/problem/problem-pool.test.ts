import { difficultyLevels } from "@/games/difficulty";
import { assessNonogramDifficulty } from "@/games/nonogram/difficulty";
import { getNonogramSymmetryKey } from "@/games/nonogram/problem/generation/symmetry";
import { generateNonogramProblem } from "@/games/nonogram/problem/generator";
import {
  createNonogramProblemIdentity,
  nonogramPatternStyles,
} from "@/games/nonogram/problem/problem";
import {
  decodeNonogramPoolEntry,
  decodeNonogramPoolSolution,
  encodeNonogramPoolSolution,
  findNonogramPooledProblemByProblemId,
  formatNonogramPoolProblemId,
  listNonogramPoolEntries,
  restoreNonogramPoolEntry,
  toNonogramPooledProblem,
} from "@/games/nonogram/problem/problem-pool";
import { parseNonogramPattern } from "@/games/nonogram/puzzle/pattern";
import { createProblemId } from "@/games/problem-id";

describe("encodeNonogramPoolSolution", () => {
  const solution = parseNonogramPattern(["##....#", ".......", "#######"]);

  test("各行を左のマスを上位の桁とした16進2桁で表し、上の行から並べること", () => {
    const encoded = encodeNonogramPoolSolution(solution);

    expect(encoded).toBe("61007f");
  });
});

describe("decodeNonogramPoolSolution", () => {
  describe("encodeNonogramPoolSolution で表した解", () => {
    const solution = parseNonogramPattern([
      "#........#",
      ".#.####...",
      "##########",
      "..........",
      "#.#.#.#.#.",
      ".#.#.#.#.#",
      "###...###.",
      "....#.....",
      "#########.",
      ".........#",
      "##..##..##",
      "#.........",
    ]);
    const encoded = encodeNonogramPoolSolution(solution);

    test("元の解へ戻すこと", () => {
      const decoded = decodeNonogramPoolSolution(
        { width: 10, height: 12 },
        encoded,
      );

      expect(decoded).toEqual(solution);
    });
  });

  const invalidCases = [
    ["扱わない盤面の大きさ", { width: 6, height: 6 }, "0".repeat(12)],
    ["高さに合わない桁数", { width: 7, height: 7 }, "0".repeat(13)],
    ["16進でない文字", { width: 7, height: 7 }, `${"0".repeat(13)}g`],
    ["幅より大きい行", { width: 7, height: 7 }, `80${"0".repeat(12)}`],
  ] as const;

  test.each(invalidCases)("%s を拒否すること", (_, size, encoded) => {
    const act = () => decodeNonogramPoolSolution(size, encoded);

    expect(act).toThrow();
  });
});

describe("decodeNonogramPoolEntry", () => {
  const style = nonogramPatternStyles[7]!;

  test("盤面の大きさ・図柄の作り方の位置・候補番号から identity を作り、難易度の特徴を読み出すこと", () => {
    const decoded = decodeNonogramPoolEntry([
      10,
      13,
      7,
      42,
      "0".repeat(39),
      12,
      5,
      10,
      1,
      3,
      0,
    ]);

    expect(decoded).toEqual({
      identity: createNonogramProblemIdentity(
        { width: 10, height: 13 },
        style,
        42,
      ),
      features: {
        roundCount: 12,
        entryLineCount: 5,
        firstRoundFixedCellCount: 10,
        minimumProgressedLineCount: 1,
        narrowRoundCount: 3,
        readingsBeyondEdgesCount: 0,
      },
    });
  });

  test("扱わない図柄の作り方の位置を拒否すること", () => {
    const act = () =>
      decodeNonogramPoolEntry([
        8,
        8,
        nonogramPatternStyles.length,
        0,
        "0".repeat(16),
        1,
        16,
        64,
        16,
        0,
        0,
      ]);

    expect(act).toThrow();
  });
});

describe("restoreNonogramPoolEntry", () => {
  const style = nonogramPatternStyles[3]!;
  const generated = generateNonogramProblem(
    createNonogramProblemIdentity({ width: 8, height: 8 }, style, 2),
  );
  if (generated.status !== "accepted") {
    throw new Error("the fixture candidate must be accepted");
  }
  const { problem, identity } = generated.generated;
  const reference = { poolVersion: "1", problemId: "2-9" };

  test("解からヒントを求めた問題と identity に、問題集の中の位置を添えること", () => {
    const pooled = restoreNonogramPoolEntry(
      [
        8,
        8,
        3,
        2,
        encodeNonogramPoolSolution(problem.solution),
        5,
        8,
        20,
        2,
        1,
        0,
      ],
      reference,
    );

    expect(pooled).toEqual({ problem, identity, poolReference: reference });
  });
});

describe("findNonogramPooledProblemByProblemId", () => {
  const poolEntries = difficultyLevels.flatMap(({ id: difficulty }) =>
    listNonogramPoolEntries(difficulty).map((entry, entryIndex) => ({
      difficulty,
      poolProblemId: formatNonogramPoolProblemId(difficulty, entryIndex),
      problemId: createProblemId(decodeNonogramPoolEntry(entry).identity),
    })),
  );

  test("問題集の全項目の問題IDが互いに異なること", () => {
    const distinctProblemIds = new Set(
      poolEntries.map(({ problemId }) => problemId),
    );

    expect(distinctProblemIds.size).toBe(poolEntries.length);
  });

  test("問題集の全項目をその難易度と問題IDで引けること", () => {
    const unresolvedEntries = poolEntries.filter(
      ({ difficulty, poolProblemId, problemId }) =>
        findNonogramPooledProblemByProblemId(difficulty, problemId)
          ?.poolReference.problemId !== poolProblemId,
    );

    expect(unresolvedEntries).toEqual([]);
  });
});

describe("listNonogramPoolEntries", () => {
  const pooledByLevel = difficultyLevels.map(({ id: difficulty }) => ({
    difficulty,
    pooled: listNonogramPoolEntries(difficulty).map((entry, entryIndex) => ({
      ...toNonogramPooledProblem(difficulty, entryIndex),
      features: decodeNonogramPoolEntry(entry).features,
    })),
  }));
  const allPooled = pooledByLevel.flatMap(({ pooled }) => pooled);

  test("各レベルが200問以上を持つこと", () => {
    const shortLevels = pooledByLevel.filter(
      ({ pooled }) => pooled.length < 200,
    );

    expect(shortLevels).toEqual([]);
  });

  test("各問題を、問題集に持つ特徴でそのレベルに分類すること", () => {
    const misclassified = pooledByLevel.flatMap(({ difficulty, pooled }) =>
      pooled.filter(({ problem, features }) => {
        const assessment = assessNonogramDifficulty({
          status: "analyzed",
          scale: {
            width: problem.width,
            height: problem.height,
            cellCount: problem.width * problem.height,
          },
          features,
        });
        return (
          assessment.status !== "classified" ||
          assessment.difficulty !== difficulty
        );
      }),
    );

    expect(misclassified).toEqual([]);
  });

  test("回転・反転で重なる図柄を、レベルをまたいでも持たないこと", () => {
    const symmetryKeys = new Set(
      allPooled.map(({ problem }) => getNonogramSymmetryKey(problem.solution)),
    );

    expect(symmetryKeys.size).toBe(allPooled.length);
  });

  describe("隣り合うレベルの特徴の中央値", () => {
    function median(values: readonly number[]): number {
      const sorted = [...values].sort((left, right) => left - right);
      return sorted[Math.floor(sorted.length / 2)]!;
    }
    // 上のレベルほど大きくなる向きにそろえた量。入口の広さ・最初の段で決まる割合・進められる行・列の最小は、
    // 少ないほど難しいので符号を反転する（`negated`）。
    const harderWhenLarger = {
      area: ({ problem }) => problem.width * problem.height,
      roundCount: ({ features }) => features.roundCount,
      narrowRoundCount: ({ features }) => features.narrowRoundCount,
      negatedEntryLineCount: ({ features }) => -features.entryLineCount,
      negatedFirstRoundFixedRatio: ({ problem, features }) =>
        -features.firstRoundFixedCellCount / (problem.width * problem.height),
      negatedMinimumProgressedLineCount: ({ features }) =>
        -features.minimumProgressedLineCount,
    } satisfies Record<string, (pooled: (typeof allPooled)[number]) => number>;
    const mediansByLevel = pooledByLevel.map(({ difficulty, pooled }) => ({
      difficulty,
      medians: Object.fromEntries(
        Object.entries(harderWhenLarger).map(([name, measure]) => [
          name,
          median(pooled.map(measure)),
        ]),
      ),
    }));
    const adjacentPairs = mediansByLevel
      .slice(1)
      .map(
        (upper, index) =>
          [
            `${mediansByLevel[index]!.difficulty}→${upper.difficulty}`,
            mediansByLevel[index]!.medians,
            upper.medians,
          ] as const,
      );

    test.each(adjacentPairs)(
      "レベル %s で、上のレベルの中央値がどの量も易しい側へ動かないこと",
      (_, lower, upper) => {
        const easier = Object.keys(harderWhenLarger).filter(
          (name) => upper[name]! < lower[name]!,
        );

        expect(easier).toEqual([]);
      },
    );
  });
});
