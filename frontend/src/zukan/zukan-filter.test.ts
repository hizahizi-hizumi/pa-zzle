import type { ProblemFeatureValue } from "@/games/problem-feature";
import type {
  GameZukan,
  ZukanProblem,
  ZukanSolvedProblem,
} from "@/zukan/zukan-collection";
import {
  arrangeZukanProblems,
  collectZukanLevelFeatures,
  countZukanFilterConditions,
  countZukanFilterOptions,
  createZukanFilterMatcher,
  createZukanLevelFeaturesCache,
  getZukanFeatureOptionKey,
  hasZukanFeatureConditions,
  listZukanPerformanceAxes,
  noZukanFilterConditions,
  type ZukanFeatureAxisSource,
  type ZukanFilterConditions,
} from "@/zukan/zukan-filter";

function createSolvedProblem(
  number: number,
  overrides: Partial<ZukanSolvedProblem> = {},
): ZukanSolvedProblem {
  return {
    kind: "solved",
    number,
    difficulty: "3",
    problemId: `p-${number}`,
    bestScore: 100,
    fastestElapsedMs: 60_000,
    fewestMoves: null,
    fewestMistakes: null,
    firstClearedAt: 0,
    ...overrides,
  };
}

function createUnsolvedProblem(
  number: number,
  attempted: boolean,
): ZukanProblem {
  return {
    kind: "unsolved",
    number,
    difficulty: "3",
    problemId: `p-${number}`,
    attempted,
  };
}

function count(value: number): ProblemFeatureValue {
  return { kind: "count", count: value };
}

function boardSize(rows: number, columns: number): ProblemFeatureValue {
  return { kind: "board-size", rows, columns };
}

function listNumbers(problems: readonly ZukanProblem[]): number[] {
  return problems.map(({ number }) => number);
}

describe("collectZukanLevelFeatures", () => {
  describe("値の種類が少ない軸の場合", () => {
    const problems = [1, 2, 3, 4].map((number) => createSolvedProblem(number));
    const axes: ZukanFeatureAxisSource[] = [
      { id: "board" },
      { id: "colors", countRangeWidth: 3 },
      { id: "empty", countRangeWidth: 2 },
    ];
    const values: Record<string, ReadonlyMap<string, ProblemFeatureValue>> = {
      "p-1": new Map([
        ["board", boardSize(10, 9)],
        ["colors", count(6)],
        ["empty", count(2)],
      ]),
      "p-2": new Map([
        ["board", boardSize(9, 9)],
        ["colors", count(4)],
        ["empty", count(2)],
      ]),
      "p-3": new Map([
        ["board", boardSize(10, 9)],
        ["colors", count(5)],
        ["empty", count(2)],
      ]),
      "p-4": new Map([
        ["board", boardSize(10, 10)],
        ["colors", count(4)],
        ["empty", count(2)],
      ]),
    };

    test("レベルの問題集にある値を、まとめずに小さい順の選択肢にし、選択肢が1つの軸は出さないこと", () => {
      const features = collectZukanLevelFeatures(
        problems,
        axes,
        ({ problemId }) => values[problemId] ?? null,
      );

      expect(features.axes).toEqual([
        {
          axisId: "board",
          options: [
            { kind: "board-size", rows: 9, columns: 9 },
            { kind: "board-size", rows: 10, columns: 9 },
            { kind: "board-size", rows: 10, columns: 10 },
          ],
        },
        {
          axisId: "colors",
          options: [
            { kind: "count", min: 4, max: 4 },
            { kind: "count", min: 5, max: 5 },
            { kind: "count", min: 6, max: 6 },
          ],
        },
      ]);
    });
  });

  describe("値の種類が8種類を超える数の軸の場合", () => {
    const counts = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
    const problems = counts.map((_, index) => createSolvedProblem(index + 1));
    const axes: ZukanFeatureAxisSource[] = [
      { id: "pieces", countRangeWidth: 4 },
    ];

    test("ゲームが決めた幅でまとめ、範囲を問題集にある値の最小から最大までにすること", () => {
      const features = collectZukanLevelFeatures(
        problems,
        axes,
        ({ number }) => new Map([["pieces", count(counts[number - 1] ?? 0)]]),
      );

      expect(features.axes).toEqual([
        {
          axisId: "pieces",
          options: [
            { kind: "count", min: 8, max: 11 },
            { kind: "count", min: 12, max: 15 },
            { kind: "count", min: 16, max: 18 },
          ],
        },
      ]);
    });
  });

  describe("値の種類がちょうど8種類の数の軸の場合", () => {
    const problems = [1, 2, 3, 4, 5, 6, 7, 8].map((number) =>
      createSolvedProblem(number),
    );
    const axes: ZukanFeatureAxisSource[] = [
      { id: "mines", countRangeWidth: 5 },
    ];

    test("まとめずに値ごとの選択肢にすること", () => {
      const features = collectZukanLevelFeatures(
        problems,
        axes,
        ({ number }) => new Map([["mines", count(10 + number)]]),
      );

      expect(features.axes[0]?.options).toHaveLength(8);
    });
  });
});

describe("collectZukanLevelFeatures で特徴を求められない問題がある場合", () => {
  const problems = [1, 2, 3].map((number) => createSolvedProblem(number));

  test("求められない問題の値を持たず、求められた問題の値だけから選択肢を作ること", () => {
    const features = collectZukanLevelFeatures(
      problems,
      [{ id: "colors" }],
      ({ number }) =>
        number === 2 ? null : new Map([["colors", count(number + 3)]]),
    );

    expect({
      problemIds: [...features.valuesByProblem.keys()],
      options: features.axes[0]?.options,
    }).toEqual({
      problemIds: ["p-1", "p-3"],
      options: [
        { kind: "count", min: 4, max: 4 },
        { kind: "count", min: 6, max: 6 },
      ],
    });
  });
});

describe("createZukanLevelFeaturesCache", () => {
  const problems = [1, 2].map((number) => createSolvedProblem(number));

  test("レベルごとに一度だけ特徴を求め、同じレベルでは求めた結果を返すこと", () => {
    const findValues = vi.fn(
      ({ number }: ZukanProblem) => new Map([["colors", count(number)]]),
    );
    const findLevelFeatures = createZukanLevelFeaturesCache(
      [{ id: "colors" }],
      findValues,
    );

    const first = findLevelFeatures("3", problems);
    const second = findLevelFeatures("3", [...problems]);
    findLevelFeatures("4", problems);

    expect(second).toBe(first);
    expect(findValues).toHaveBeenCalledTimes(4);
  });
});

describe("createZukanFilterMatcher", () => {
  const perfect = createSolvedProblem(1, {
    bestScore: 100,
    fewestMistakes: 0,
    fewestMoves: { completionMoveCount: 20, optimalMoveCount: 20 },
  });
  const good = createSolvedProblem(2, {
    bestScore: 85,
    fewestMistakes: 2,
    fewestMoves: { completionMoveCount: 24, optimalMoveCount: 20 },
  });
  const great = createSolvedProblem(3, {
    bestScore: 95,
    fewestMistakes: 0,
    fewestMoves: { completionMoveCount: 22, optimalMoveCount: 20 },
  });
  const attempted = createUnsolvedProblem(4, true);
  const untouched = createUnsolvedProblem(5, false);
  const problems = [perfect, good, great, attempted, untouched];
  const colorValues: Record<string, number> = {
    "p-1": 4,
    "p-2": 5,
    "p-3": 6,
    "p-4": 4,
    "p-5": 6,
  };
  const emptyValues: Record<string, number> = {
    "p-1": 1,
    "p-2": 2,
    "p-3": 2,
    "p-4": 2,
    "p-5": 1,
  };
  const levelFeatures = collectZukanLevelFeatures(
    problems,
    [{ id: "colors" }, { id: "empty" }],
    ({ problemId }) =>
      new Map([
        ["colors", count(colorValues[problemId] ?? 0)],
        ["empty", count(emptyValues[problemId] ?? 0)],
      ]),
  );
  const fourColors = getZukanFeatureOptionKey({
    kind: "count",
    min: 4,
    max: 4,
  });
  const sixColors = getZukanFeatureOptionKey({
    kind: "count",
    min: 6,
    max: 6,
  });
  const oneEmpty = getZukanFeatureOptionKey({ kind: "count", min: 1, max: 1 });
  const cases: [string, ZukanFilterConditions, number[]][] = [
    [
      "同じ種類の状態はどれかに当たれば当たる",
      { ...noZukanFilterConditions, statuses: ["good", "attempted"] },
      [2, 4],
    ],
    [
      "同じ軸の特徴はどれかに当たれば当たる",
      {
        ...noZukanFilterConditions,
        features: { colors: [fourColors, sixColors] },
      },
      [1, 3, 4, 5],
    ],
    [
      "別の軸の特徴はすべてに当たる問題だけが当たる",
      {
        ...noZukanFilterConditions,
        features: { colors: [fourColors, sixColors], empty: [oneEmpty] },
      },
      [1, 5],
    ],
    [
      "状態と特徴をまたぐと、両方に当たる問題だけが当たる",
      {
        ...noZukanFilterConditions,
        statuses: ["perfect", "untouched"],
        features: { empty: [oneEmpty] },
      },
      [1, 5],
    ],
    [
      "ミスなしは、最も少ないミスが0の解いた問題だけが当たる",
      { ...noZukanFilterConditions, performances: ["no-mistakes"] },
      [1, 3],
    ],
    [
      "ミスありは、どのクリアでもミスがあった解いた問題だけが当たる",
      { ...noZukanFilterConditions, performances: ["with-mistakes"] },
      [2],
    ],
    [
      "最短手数は、最も少ない手数が最短手数の解いた問題だけが当たる",
      { ...noZukanFilterConditions, performances: ["optimal-moves"] },
      [1],
    ],
    [
      "最短より多いは、最も少ない手数が最短手数より多い解いた問題だけが当たる",
      { ...noZukanFilterConditions, performances: ["over-optimal-moves"] },
      [2, 3],
    ],
    [
      "同じ軸の成績はどれかに当たれば当たる",
      {
        ...noZukanFilterConditions,
        performances: ["optimal-moves", "over-optimal-moves"],
      },
      [1, 2, 3],
    ],
    [
      "別の軸の成績はすべてに当たる問題だけが当たる",
      {
        ...noZukanFilterConditions,
        performances: ["no-mistakes", "over-optimal-moves"],
      },
      [3],
    ],
    [
      "成績の条件をかけると、挑戦中と未挑戦は当たらない",
      {
        ...noZukanFilterConditions,
        statuses: ["attempted", "untouched", "great"],
        performances: ["no-mistakes", "with-mistakes"],
      },
      [3],
    ],
    [
      "状態・特徴・成績をまたぐと、すべてに当たる問題だけが当たる",
      {
        statuses: ["perfect", "great", "good"],
        features: { empty: [oneEmpty] },
        performances: ["no-mistakes"],
      },
      [1],
    ],
  ];

  test.each(cases)("%sこと", (_, conditions, expected) => {
    const matches = createZukanFilterMatcher(conditions, levelFeatures);

    const matchedNumbers = listNumbers(problems.filter(matches));

    expect(matchedNumbers).toEqual(expected);
  });

  describe("特徴を求められない問題がある場合", () => {
    const featuresWithUnknown = collectZukanLevelFeatures(
      problems,
      [{ id: "colors" }],
      ({ problemId }) =>
        problemId === "p-4"
          ? null
          : new Map([["colors", count(colorValues[problemId] ?? 0)]]),
    );

    test("特徴を求められない問題は、特徴の条件に当たらないこと", () => {
      const matches = createZukanFilterMatcher(
        {
          ...noZukanFilterConditions,
          features: { colors: [fourColors, sixColors] },
        },
        featuresWithUnknown,
      );

      const matchedNumbers = listNumbers(problems.filter(matches));

      expect(matchedNumbers).toEqual([1, 3, 5]);
    });

    test("特徴の条件が無ければ、特徴を求められない問題もほかの条件で当たること", () => {
      const matches = createZukanFilterMatcher(
        { ...noZukanFilterConditions, statuses: ["attempted"] },
        featuresWithUnknown,
      );

      const matchedNumbers = listNumbers(problems.filter(matches));

      expect(matchedNumbers).toEqual([4]);
    });
  });

  describe("特徴を求めていない場合", () => {
    const conditions: ZukanFilterConditions = {
      ...noZukanFilterConditions,
      features: { colors: [fourColors] },
    };

    test("特徴の条件にはどの問題も当たらないこと", () => {
      const matches = createZukanFilterMatcher(conditions, null);

      const matchedNumbers = listNumbers(problems.filter(matches));

      expect(matchedNumbers).toEqual([]);
    });
  });
});

describe("countZukanFilterOptions", () => {
  const problems = [
    createSolvedProblem(1, {
      bestScore: 100,
      fewestMistakes: 0,
      fewestMoves: { completionMoveCount: 20, optimalMoveCount: 20 },
    }),
    createSolvedProblem(2, {
      bestScore: 85,
      fewestMistakes: 2,
      fewestMoves: { completionMoveCount: 24, optimalMoveCount: 20 },
    }),
    createSolvedProblem(3, {
      bestScore: 95,
      fewestMistakes: 0,
      fewestMoves: { completionMoveCount: 22, optimalMoveCount: 20 },
    }),
    createUnsolvedProblem(4, true),
    createUnsolvedProblem(5, false),
  ];
  const colorValues: Record<string, number> = {
    "p-1": 4,
    "p-2": 5,
    "p-3": 6,
    "p-4": 4,
    "p-5": 6,
  };
  const emptyValues: Record<string, number> = {
    "p-1": 1,
    "p-2": 2,
    "p-3": 2,
    "p-4": 2,
    "p-5": 1,
  };
  const levelFeatures = collectZukanLevelFeatures(
    problems,
    [{ id: "colors" }, { id: "empty" }],
    ({ problemId }) =>
      new Map([
        ["colors", count(colorValues[problemId] ?? 0)],
        ["empty", count(emptyValues[problemId] ?? 0)],
      ]),
  );
  function key(value: number): string {
    return getZukanFeatureOptionKey({ kind: "count", min: value, max: value });
  }

  test("条件が無ければ、選択肢ごとにその選択肢だけに当たる問題を数えること", () => {
    const counts = countZukanFilterOptions(
      problems,
      noZukanFilterConditions,
      levelFeatures,
    );

    expect(counts).toEqual({
      statuses: {
        perfect: 1,
        great: 1,
        good: 1,
        clear: 0,
        attempted: 1,
        untouched: 1,
      },
      features: {
        colors: { [key(4)]: 2, [key(5)]: 1, [key(6)]: 2 },
        empty: { [key(1)]: 2, [key(2)]: 3 },
      },
      performances: {
        "no-mistakes": 2,
        "with-mistakes": 1,
        "optimal-moves": 1,
        "over-optimal-moves": 2,
      },
    });
  });

  test("ほかの種類の条件に当たる問題だけを数え、同じ種類で選んでいる選択肢は数に関わらないこと", () => {
    const counts = countZukanFilterOptions(
      problems,
      {
        statuses: ["perfect", "untouched"],
        features: { colors: [key(4)] },
        performances: ["over-optimal-moves"],
      },
      levelFeatures,
    );

    expect(counts).toEqual({
      statuses: {
        perfect: 0,
        great: 0,
        good: 0,
        clear: 0,
        attempted: 0,
        untouched: 0,
      },
      features: {
        colors: { [key(4)]: 0, [key(5)]: 0, [key(6)]: 0 },
        empty: { [key(1)]: 0, [key(2)]: 0 },
      },
      performances: {
        "no-mistakes": 0,
        "with-mistakes": 0,
        "optimal-moves": 1,
        "over-optimal-moves": 0,
      },
    });
  });

  test("成績の選択肢は、同じ軸で選んでいる選択肢に関わらず、ほかの軸の成績の条件をかけて数えること", () => {
    const counts = countZukanFilterOptions(
      problems,
      {
        ...noZukanFilterConditions,
        performances: ["no-mistakes", "optimal-moves"],
      },
      levelFeatures,
    );

    expect(counts.performances).toEqual({
      "no-mistakes": 1,
      "with-mistakes": 0,
      "optimal-moves": 1,
      "over-optimal-moves": 1,
    });
  });

  test("ほかの種類の条件を組み合わせても、選択肢ごとに数えること", () => {
    const counts = countZukanFilterOptions(
      problems,
      {
        statuses: ["perfect", "great", "untouched"],
        features: { empty: [key(1)] },
        performances: [],
      },
      levelFeatures,
    );

    expect(counts).toEqual({
      statuses: {
        perfect: 1,
        great: 0,
        good: 0,
        clear: 0,
        attempted: 0,
        untouched: 1,
      },
      features: {
        colors: { [key(4)]: 1, [key(5)]: 0, [key(6)]: 1 },
        empty: { [key(1)]: 2, [key(2)]: 1 },
      },
      performances: {
        "no-mistakes": 1,
        "with-mistakes": 0,
        "optimal-moves": 1,
        "over-optimal-moves": 0,
      },
    });
  });

  describe("特徴を求めていない場合", () => {
    test("特徴の選択肢を数えないこと", () => {
      const counts = countZukanFilterOptions(
        problems,
        noZukanFilterConditions,
        null,
      );

      expect(counts.features).toEqual({});
    });
  });
});

describe("arrangeZukanProblems", () => {
  const problems = [1, 2, 3, 4, 5, 6].map((number) =>
    createSolvedProblem(number),
  );

  test("当たった問題を番号の順に前へ、当たらなかった問題を番号の順に後ろへ並べ、当たった数を返すこと", () => {
    const arrangement = arrangeZukanProblems(
      problems,
      ({ number }) => number % 3 === 0 || number === 5,
    );

    expect({
      numbers: listNumbers(arrangement.problems),
      matchedCount: arrangement.matchedCount,
    }).toEqual({ numbers: [3, 5, 6, 1, 2, 4], matchedCount: 3 });
  });
});

describe("countZukanFilterConditions", () => {
  const conditions: ZukanFilterConditions = {
    statuses: ["perfect", "untouched"],
    features: { colors: ["a", "b"], empty: [] },
    performances: ["no-mistakes"],
  };

  test("選んだ選択肢の数を、種類をまたいで数えること", () => {
    const conditionCount = countZukanFilterConditions(conditions);

    expect(conditionCount).toBe(5);
  });
});

describe("hasZukanFeatureConditions", () => {
  const cases: [string, ZukanFilterConditions, boolean][] = [
    ["条件なし", noZukanFilterConditions, false],
    [
      "選択肢の無い軸だけ",
      { ...noZukanFilterConditions, features: { colors: [] } },
      false,
    ],
    [
      "選択肢を選んだ軸あり",
      { ...noZukanFilterConditions, features: { colors: ["a"] } },
      true,
    ],
  ];

  test.each(cases)(
    "特徴の条件をかけているかを返すこと: %s",
    (_, conditions, expected) => {
      const hasFeatureConditions = hasZukanFeatureConditions(conditions);

      expect(hasFeatureConditions).toBe(expected);
    },
  );
});

describe("listZukanPerformanceAxes", () => {
  function createZukan(problems: readonly ZukanProblem[]): GameZukan {
    return {
      sections: [{ difficulty: "3", problems, solvedCount: problems.length }],
      problemCount: problems.length,
      solvedCount: problems.length,
      latestPlayedDifficulty: "3",
    };
  }
  const cases: [string, GameZukan, string[]][] = [
    [
      "ミスを数えるゲーム",
      createZukan([createSolvedProblem(1, { fewestMistakes: 1 })]),
      ["mistakes"],
    ],
    [
      "手数を数えるゲーム",
      createZukan([
        createSolvedProblem(1, {
          fewestMoves: { completionMoveCount: 3, optimalMoveCount: 3 },
        }),
      ]),
      ["moves"],
    ],
    ["どちらも数えないゲーム", createZukan([createSolvedProblem(1)]), []],
    ["解いた問題が無い図鑑", createZukan([createUnsolvedProblem(1, true)]), []],
  ];

  test.each(cases)(
    "解いた問題が持つ成績の軸だけを返すこと: %s",
    (_, zukan, expected) => {
      const axes = listZukanPerformanceAxes(zukan);

      expect(axes).toEqual(expected);
    },
  );
});
