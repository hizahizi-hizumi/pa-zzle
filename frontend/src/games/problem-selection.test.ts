import { selectProblemPoolEntry } from "@/games/problem-selection";

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
