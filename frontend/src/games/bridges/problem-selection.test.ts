import { createBridgesProblemIdentity } from "@/games/bridges/problem/problem";
import { listBridgesPoolProblemIds } from "@/games/bridges/problem/problem-pool";
import {
  canSelectBridgesProblemById,
  restoreBridgesProblem,
  selectBridgesProblemById,
  selectBridgesProblemForDifficulty,
} from "@/games/bridges/problem-selection";
import { createProblemId } from "@/games/problem-id";

describe("selectBridgesProblemForDifficulty", () => {
  test("同じ seed からは同じ問題を選ぶこと", () => {
    const problems = [0, 1].map(() =>
      selectBridgesProblemForDifficulty("3", "same-seed"),
    );

    expect(problems[0]).toEqual(problems[1]);
  });

  test.each(["1", "5"] as const)(
    "レベル %s の問題集にある問題を選ぶこと",
    (difficulty) => {
      const { identity } = selectBridgesProblemForDifficulty(
        difficulty,
        "seed",
      );

      expect(listBridgesPoolProblemIds(difficulty)).toContain(
        createProblemId(identity),
      );
    },
  );
});

describe("selectBridgesProblemById", () => {
  const selected = selectBridgesProblemForDifficulty("2", "seed");
  const problemId = createProblemId(selected.identity);

  test("選んだ問題をその問題 ID で引けること", () => {
    const found = selectBridgesProblemById("2", problemId);

    expect(found).toEqual(selected);
  });

  test.each([
    ["別の難易度の問題集の ID", "4", problemId],
    ["問題集に無い ID", "2", "unknown"],
  ] as const)("%sには null を返すこと", (_, difficulty, id) => {
    const found = selectBridgesProblemById(difficulty, id);

    expect(found).toBeNull();
  });
});

describe("canSelectBridgesProblemById", () => {
  const { identity } = selectBridgesProblemForDifficulty("3", "seed");

  test.each([
    [createProblemId(identity), true],
    ["unknown", false],
  ])("問題 ID %s を引けるかが %s であること", (problemId, expected) => {
    const selectable = canSelectBridgesProblemById("3", problemId);

    expect(selectable).toBe(expected);
  });
});

describe("restoreBridgesProblem", () => {
  const selected = selectBridgesProblemForDifficulty("5", "seed");

  test("記録の identity から同じ問題を復元すること", () => {
    const restored = restoreBridgesProblem(selected.identity);

    expect(restored).toEqual(selected);
  });

  test.each([
    [
      "問題集に無い候補番号",
      createBridgesProblemIdentity(selected.identity.conditions, 999_999),
    ],
    ["別の生成器の版", { ...selected.identity, generatorVersion: "0" }],
  ])("%sの identity には null を返すこと", (_, identity) => {
    const restored = restoreBridgesProblem(identity);

    expect(restored).toBeNull();
  });
});
