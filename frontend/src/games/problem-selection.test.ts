import { createProblemId } from "@/games/problem-id";
import * as problemSeed from "@/games/problem-seed";
import {
  selectProblemAvoiding,
  selectProblemPoolEntry,
} from "@/games/problem-selection";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("selectProblemPoolEntry", () => {
  const entries = ["a", "b", "c", "d", "e"] as const;
  const seeds = Array.from({ length: 20 }, (_, index) => `seed-${index}`);

  test("同じ seed から同じ問題を選ぶこと", () => {
    const first = seeds.map((seed) =>
      selectProblemPoolEntry(entries, seed, "test"),
    );
    const second = seeds.map((seed) =>
      selectProblemPoolEntry(entries, seed, "test"),
    );

    expect(second).toEqual(first);
  });

  test("seed に応じて問題集の中から選ぶこと", () => {
    const selected = new Set(
      seeds.map((seed) => selectProblemPoolEntry(entries, seed, "test")),
    );

    expect([...selected].every((entry) => entries.includes(entry))).toBe(true);
    expect(selected.size).toBeGreaterThan(1);
  });

  describe("問題集が空の場合", () => {
    const emptyEntries: readonly string[] = [];

    test("どの問題集かを示して例外を送出すること", () => {
      const act = () =>
        selectProblemPoolEntry(emptyEntries, "seed", "level easy test");

      expect(act).toThrow("No level easy test problem is available");
    });
  });
});

describe("selectProblemAvoiding", () => {
  function selectProblemBySeed(seed: string) {
    return { identity: { seed } };
  }

  beforeEach(() => {
    vi.spyOn(problemSeed, "createProblemSeed")
      .mockReturnValueOnce("first")
      .mockReturnValueOnce("second")
      .mockReturnValue("later");
  });

  describe("避ける問題が無い場合", () => {
    test("新しい seed で選んだ問題をその seed と返すこと", () => {
      const selected = selectProblemAvoiding(selectProblemBySeed);

      expect(selected).toEqual({
        seed: "first",
        problem: { identity: { seed: "first" } },
      });
    });
  });

  describe("最初に選んだ問題が避ける問題の場合", () => {
    const avoidedProblemId = createProblemId({ seed: "first" });

    test("seed を変えて選び直した問題を返すこと", () => {
      const selected = selectProblemAvoiding(
        selectProblemBySeed,
        avoidedProblemId,
      );

      expect(selected).toEqual({
        seed: "second",
        problem: { identity: { seed: "second" } },
      });
    });
  });

  describe("避ける問題しか選べない場合", () => {
    const onlyProblem = { identity: { seed: "only" } };
    const selectOnlyProblem = vi.fn(() => onlyProblem);
    const avoidedProblemId = createProblemId(onlyProblem.identity);

    beforeEach(() => {
      selectOnlyProblem.mockClear();
    });

    test("選び直しの上限で選択を終えてその問題を返すこと", () => {
      const selected = selectProblemAvoiding(
        selectOnlyProblem,
        avoidedProblemId,
      );

      expect(selected.problem).toBe(onlyProblem);
      expect(selectOnlyProblem).toHaveBeenCalledTimes(8);
    });
  });
});
