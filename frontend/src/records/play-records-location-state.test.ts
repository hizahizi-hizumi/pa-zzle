import {
  createPlayRecordsLocationState,
  readPlayRecordsLocationState,
} from "@/records/play-records-location-state";

describe("readPlayRecordsLocationState", () => {
  const cases = [
    [
      "記録画面の state",
      createPlayRecordsLocationState(80, 1200.5),
      { shownEntryCount: 80, scrollY: 1200.5 },
    ],
    ["state が無い", null, null],
    ["描いていた数が0", { shownEntryCount: 0, scrollY: 0 }, null],
    ["スクロール位置が負", { shownEntryCount: 40, scrollY: -1 }, null],
    ["ほかの画面向けの state", { avoidedProblemId: "abc" }, null],
  ] as const;

  test.each(cases)("形を確かめて読むこと: %s", (_, state, expected) => {
    const read = readPlayRecordsLocationState(state);

    expect(read).toEqual(expected);
  });
});
