import {
  getClearedSessionElapsedMs,
  getSessionElapsedMs,
} from "@/games/session";

describe("getSessionElapsedMs", () => {
  const cases = [
    ["プレイ中は現在時刻まで", { startedAt: 1_000, finishedAt: null }, 2_500],
    [
      "クリア後はクリア時刻まで",
      { startedAt: 1_000, finishedAt: 3_000 },
      2_000,
    ],
    ["現在時刻が開始より前なら 0", { startedAt: 5_000, finishedAt: null }, 0],
  ] as const;

  test.each(cases)("経過時間を返すこと: %s", (_, session, expected) => {
    const elapsedMs = getSessionElapsedMs(session, 3_500);

    expect(elapsedMs).toBe(expected);
  });
});

describe("getClearedSessionElapsedMs", () => {
  test("クリアしたプレイはクリアまでの経過時間を返すこと", () => {
    const elapsedMs = getClearedSessionElapsedMs({
      status: "cleared",
      startedAt: 1_000,
      finishedAt: 4_000,
    });

    expect(elapsedMs).toBe(3_000);
  });

  test("プレイ中は null を返すこと", () => {
    const elapsedMs = getClearedSessionElapsedMs({
      status: "playing",
      startedAt: 1_000,
      finishedAt: null,
    });

    expect(elapsedMs).toBeNull();
  });
});
