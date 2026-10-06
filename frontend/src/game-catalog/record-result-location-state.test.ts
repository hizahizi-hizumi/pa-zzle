import {
  createRecordResultLocationState,
  readRecordSaveOutcome,
} from "@/game-catalog/record-result-location-state";

describe("readRecordSaveOutcome", () => {
  const recordSaveOutcome = {
    status: "updated",
    updates: [{ metricId: "play-score", previousValue: 80, currentValue: 90 }],
  } as const;

  describe("createRecordResultLocationState で作った state の場合", () => {
    const state = createRecordResultLocationState(recordSaveOutcome);

    test("記録の保存結果を返すこと", () => {
      const outcome = readRecordSaveOutcome(state);

      expect(outcome).toEqual(recordSaveOutcome);
    });
  });

  const otherStates = [
    ["state が無い", null],
    ["保存結果を持たない state", { avoidedProblemId: "0123456789" }],
    ["保存結果の形をしていない state", { recordSaveOutcome: { status: 1 } }],
  ] as const;

  test.each(otherStates)("%sには undefined を返すこと", (_, state) => {
    const outcome = readRecordSaveOutcome(state);

    expect(outcome).toBeUndefined();
  });
});
