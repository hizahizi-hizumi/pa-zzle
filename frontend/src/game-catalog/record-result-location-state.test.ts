import {
  createRecordResultLocationState,
  readRecordResultStudyCode,
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

describe("readRecordResultStudyCode", () => {
  test("結果へ保存する試遊識別子を読むこと", () => {
    const state = createRecordResultLocationState(
      { status: "recorded" },
      "nanpure.c.0.p",
    );
    const code = readRecordResultStudyCode(state);

    expect(code).toBe("nanpure.c.0.p");
  });

  test.each([null, {}, { studyCode: 30 }])(
    "不適切なstateから試遊識別子を復元しないこと",
    (value) => {
      const code = readRecordResultStudyCode(value);

      expect(code).toBeNull();
    },
  );
});
