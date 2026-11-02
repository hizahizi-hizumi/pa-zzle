import {
  canSelectBridgesProblemById,
  selectBridgesProblemById,
  selectBridgesProblemForDifficulty,
} from "@/games/bridges/problem-selection";
import { createProblemId } from "@/games/problem-id";

describe("selectBridgesProblemById", () => {
  const selected = selectBridgesProblemForDifficulty("1", "seed");
  const problemId = createProblemId(selected.identity);

  test.each(["1", "5"] as const)(
    "レベル %s で、選んだ問題をその問題 ID で引けること",
    (difficulty) => {
      const found = selectBridgesProblemById(difficulty, problemId);

      expect(found).toBe(selected);
    },
  );

  test("問題に無い ID には null を返すこと", () => {
    const found = selectBridgesProblemById("1", "unknown");

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
