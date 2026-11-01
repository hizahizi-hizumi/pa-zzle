import {
  assertNonogramProblem,
  createNonogramProblem,
  createNonogramProblemIdentity,
  isNonogramProblemIdentity,
  isNonogramRecordedProblemIdentity,
  NONOGRAM_GENERATOR_VERSION,
  nonogramPatternStyles,
} from "@/games/nonogram/problem/problem";
import { parseNonogramPattern } from "@/games/nonogram/puzzle/pattern";
import { createProblemId } from "@/games/problem-id";

describe("nonogramPatternStyles", () => {
  test("黒の確率5通り・平滑化3通り・左右対称の有無2通りの30通りを重ならずに持つこと", () => {
    const keys = new Set(
      nonogramPatternStyles.map(
        ({ blackProbability, smoothingCount, mirrored }) =>
          `${blackProbability}-${smoothingCount}-${mirrored}`,
      ),
    );

    expect(keys.size).toBe(30);
  });
});

describe("createNonogramProblemIdentity", () => {
  const size = { width: 10, height: 12 };
  const style = {
    blackProbability: 0.45,
    smoothingCount: 1,
    mirrored: false,
  } as const;

  test("大きさ・作り方・候補番号を seed に含めた identity を作ること", () => {
    const identity = createNonogramProblemIdentity(size, style, 3);

    expect(identity).toEqual({
      generatorVersion: NONOGRAM_GENERATOR_VERSION,
      seed: "ng-10x12-d0.45-s1-n-3",
      conditions: {
        width: 10,
        height: 12,
        blackProbability: 0.45,
        smoothingCount: 1,
        mirrored: false,
      },
    });
  });

  test("候補番号が違えば問題 ID も違うこと", () => {
    const firstId = createProblemId(
      createNonogramProblemIdentity(size, style, 0),
    );
    const secondId = createProblemId(
      createNonogramProblemIdentity(size, style, 1),
    );

    expect(firstId).not.toBe(secondId);
  });
});

describe("createNonogramProblem", () => {
  const solution = parseNonogramPattern(["##.", "...", "#.#"]);

  test("図柄から行ヒントと列ヒントを求めること", () => {
    const problem = createNonogramProblem(solution);

    expect(problem).toEqual({
      width: 3,
      height: 3,
      clues: {
        rows: [[2], [], [1, 1]],
        columns: [[1, 1], [1], [1]],
      },
      solution,
    });
  });
});

describe("assertNonogramProblem", () => {
  const solution = parseNonogramPattern(["##.", "...", "#.#"]);
  const problem = createNonogramProblem(solution);
  const invalidCases = [
    [
      "ヒントが図柄と食い違う問題",
      { ...problem, clues: { ...problem.clues, rows: [[1], [], [1, 1]] } },
    ],
    ["大きさが図柄と食い違う問題", { ...problem, width: 4 }],
  ] as const;

  test("図柄とヒントが合う問題を受け入れること", () => {
    const act = () => assertNonogramProblem(problem);

    expect(act).not.toThrow();
  });

  test.each(invalidCases)("%sを拒否すること", (_, invalidProblem) => {
    const act = () => assertNonogramProblem(invalidProblem);

    expect(act).toThrow();
  });
});

describe("isNonogramProblemIdentity", () => {
  const identity = createNonogramProblemIdentity(
    { width: 10, height: 15 },
    { blackProbability: 0.65, smoothingCount: 2, mirrored: true },
    12,
  );
  const invalidCases = [
    ["生成器の版が違う", { ...identity, generatorVersion: "0" }],
    ["seed が空", { ...identity, seed: "" }],
    [
      "扱わない大きさ",
      { ...identity, conditions: { ...identity.conditions, height: 16 } },
    ],
    [
      "横長の大きさ",
      {
        ...identity,
        conditions: { ...identity.conditions, width: 12, height: 10 },
      },
    ],
    [
      "扱わない平滑化の回数",
      {
        ...identity,
        conditions: { ...identity.conditions, smoothingCount: 3 },
      },
    ],
    [
      "左右対称の有無が真偽値でない",
      { ...identity, conditions: { ...identity.conditions, mirrored: "yes" } },
    ],
    ["生成条件が無い", { generatorVersion: "1", seed: "ng-1" }],
  ] as const;

  test("今の生成器の identity を受け入れること", () => {
    const accepted = isNonogramProblemIdentity(identity);

    expect(accepted).toBe(true);
  });

  test.each(invalidCases)("%s identity を拒否すること", (_, value) => {
    const accepted = isNonogramProblemIdentity(value);

    expect(accepted).toBe(false);
  });
});

describe("isNonogramRecordedProblemIdentity", () => {
  const identity = createNonogramProblemIdentity(
    { width: 8, height: 8 },
    { blackProbability: 0.5, smoothingCount: 0, mirrored: false },
    0,
  );
  const cases = [
    ["今の版の identity", identity, true],
    [
      "別の版の、今は扱わない生成条件の identity",
      {
        generatorVersion: "0",
        seed: "old",
        conditions: { width: 15, height: 15 },
      },
      true,
    ],
    [
      "今の版で、今は扱わない生成条件の identity",
      { ...identity, conditions: { ...identity.conditions, width: 15 } },
      false,
    ],
    ["形の違う値", { seed: "ng-1" }, false],
  ] as const;

  test.each(cases)("%s を読めるか決めること", (_, value, expected) => {
    const readable = isNonogramRecordedProblemIdentity(value);

    expect(readable).toBe(expected);
  });
});
