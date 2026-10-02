import {
  createPlayLocationState,
  readAvoidedProblemId,
} from "@/game-catalog/play-location-state";

describe("readAvoidedProblemId", () => {
  const avoidedProblemId = "0123456789";

  describe("createPlayLocationState で作った state の場合", () => {
    const state = createPlayLocationState(avoidedProblemId);

    test("避ける問題の ID を返すこと", () => {
      const problemId = readAvoidedProblemId(state);

      expect(problemId).toBe(avoidedProblemId);
    });
  });

  const otherStates = [
    ["state が無い", null],
    ["文字列の state", avoidedProblemId],
    ["避ける問題の ID を持たない state", { from: "records" }],
    ["避ける問題の ID が文字列ではない state", { avoidedProblemId: 1 }],
  ] as const;

  test.each(otherStates)("%sには undefined を返すこと", (_, state) => {
    const problemId = readAvoidedProblemId(state);

    expect(problemId).toBeUndefined();
  });
});
