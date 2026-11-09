import {
  createRecordResultLocationState,
  readIssue690BoardSnapshot,
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

describe("readIssue690BoardSnapshot", () => {
  const snapshot = {
    gameId: "water-sort" as const,
    bottles: [[0, 0, 0, 0], []],
    palette: ["#78aabf"],
    lastMove: { sourceBottleIndex: 1, destinationBottleIndex: 0 },
    reconstructed: false,
  };

  test("クリア直後の実際の完成配置と最後の操作を保持する", () => {
    const state = createRecordResultLocationState(
      { status: "recorded" },
      snapshot,
    );
    expect(readIssue690BoardSnapshot(state)).toEqual(snapshot);
  });

  test("ありえない最終操作の指定は採用しない", () => {
    const invalid = {
      ...snapshot,
      lastMove: { sourceBottleIndex: 4, destinationBottleIndex: 0 },
    };
    expect(
      readIssue690BoardSnapshot({ issue690BoardSnapshot: invalid }),
    ).toBeUndefined();
  });
});
