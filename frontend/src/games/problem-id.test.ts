import {
  _private,
  createProblemId,
  createProblemPoolIdLookup,
  isRecordedProblemIdentity,
} from "@/games/problem-id";

const { canonicalizeProblemIdentity } = _private;

const identity = {
  generatorVersion: "1",
  seed: "ms-pool-1-9x9-9-2",
  conditions: { rows: 9, columns: 9, mineCount: 9 },
  generationAttempt: 1,
};

describe("canonicalizeProblemIdentity", () => {
  describe("キーの順序だけが違う identity", () => {
    const reordered = {
      generationAttempt: 1,
      conditions: { mineCount: 9, columns: 9, rows: 9 },
      seed: "ms-pool-1-9x9-9-2",
      generatorVersion: "1",
    };

    test("同じ文字列にすること", () => {
      const canonical = canonicalizeProblemIdentity(reordered);

      expect(canonical).toBe(canonicalizeProblemIdentity(identity));
    });
  });

  describe("値が undefined のキーを持つ identity", () => {
    const withUndefined = { ...identity, removedCondition: undefined };

    test("そのキーが無い identity と同じ文字列にすること", () => {
      const canonical = canonicalizeProblemIdentity(withUndefined);

      expect(canonical).toBe(canonicalizeProblemIdentity(identity));
    });
  });

  describe("JSON で表せない値を含む identity", () => {
    const withFunction = { ...identity, seed: () => "seed" };

    test("拒否すること", () => {
      const act = () => canonicalizeProblemIdentity(withFunction);

      expect(act).toThrow(TypeError);
    });
  });
});

describe("createProblemId", () => {
  test("0-9a-v の10桁にすること", () => {
    const problemId = createProblemId(identity);

    expect(problemId).toMatch(/^[0-9a-v]{10}$/);
  });

  describe("記録へ保存して読み戻した identity", () => {
    const recorded = JSON.parse(JSON.stringify(identity)) as Record<
      string,
      unknown
    >;

    test("元の identity と同じ問題IDにすること", () => {
      const problemId = createProblemId(recorded);

      expect(problemId).toBe(createProblemId(identity));
    });
  });

  const differentIdentities = [
    ["seed が違う", { ...identity, seed: "ms-pool-1-9x9-9-3" }],
    ["生成器の版が違う", { ...identity, generatorVersion: "2" }],
    [
      "生成条件が違う",
      { ...identity, conditions: { ...identity.conditions, mineCount: 10 } },
    ],
    ["生成試行が違う", { ...identity, generationAttempt: 2 }],
  ] as const;

  test.each(differentIdentities)(
    "%s identity には別の問題IDにすること",
    (_, different) => {
      const problemId = createProblemId(different);

      expect(problemId).not.toBe(createProblemId(identity));
    },
  );
});

describe("createProblemPoolIdLookup", () => {
  type Entry = readonly [seed: string];
  const levels: Record<"1" | "2", readonly Entry[]> = {
    "1": [["a"], ["b"]],
    "2": [["c"]],
  };
  const findPosition = createProblemPoolIdLookup(levels, ([seed]) => ({
    seed,
  }));
  const secondEntryId = createProblemId({ seed: "b" });

  test("難易度と問題IDから項目と並び順を引けること", () => {
    const position = findPosition("1", secondEntryId);

    expect(position).toEqual({ entry: ["b"], entryIndex: 1 });
  });

  test("別の難易度の問題IDでは引けないこと", () => {
    const position = findPosition("2", secondEntryId);

    expect(position).toBeNull();
  });

  test("問題集に無い問題IDでは引けないこと", () => {
    const position = findPosition("1", createProblemId({ seed: "z" }));

    expect(position).toBeNull();
  });
});

describe("isRecordedProblemIdentity", () => {
  const current = {
    generatorVersion: "2",
    isProblemIdentity(value: unknown): value is { generatorVersion: "2" } {
      return (
        typeof value === "object" &&
        value !== null &&
        "conditions" in value &&
        typeof value.conditions === "object" &&
        value.conditions !== null &&
        "size" in value.conditions &&
        value.conditions.size === 4
      );
    },
  };
  const cases = [
    [
      "今の版で今の生成器が扱える identity",
      { generatorVersion: "2", seed: "s", conditions: { size: 4 } },
      true,
    ],
    [
      "今の版で今の生成器が扱えない identity",
      { generatorVersion: "2", seed: "s", conditions: { size: 5 } },
      false,
    ],
    [
      "別の版の identity",
      { generatorVersion: "1", seed: "s", conditions: { clueCount: 30 } },
      true,
    ],
    [
      "版の無い identity",
      { generatorVersion: "", seed: "s", conditions: {} },
      false,
    ],
    [
      "seed の無い identity",
      { generatorVersion: "1", seed: "", conditions: {} },
      false,
    ],
    ["生成条件の無い identity", { generatorVersion: "1", seed: "s" }, false],
  ] as const;

  test.each(cases)(
    "記録の identity として読めるかを返すこと: %s",
    (_, value, expected) => {
      const result = isRecordedProblemIdentity(value, current);

      expect(result).toBe(expected);
    },
  );
});
