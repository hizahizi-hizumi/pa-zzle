import {
  calculateSolitairePlayScore,
  calculateSolitaireSpeedScoreRule,
  calculateSolitaireTimeDeltaMs,
  SOLITAIRE_SCORE_MAXIMUMS,
} from "@/games/solitaire/score";

describe("calculateSolitaireSpeedScoreRule", () => {
  test("6分で満点、その2倍の12分で0点になる規則を返すこと", () => {
    const rule = calculateSolitaireSpeedScoreRule();

    expect(rule).toMatchObject({ fullScoreMs: 360_000, zeroScoreMs: 720_000 });
  });
});

describe("calculateSolitaireTimeDeltaMs", () => {
  const cases = [
    ["基準時間より遅い", 400_000, 40_000],
    ["基準時間より速い", 300_000, -60_000],
  ] as const;

  test.each(cases)("%s時間との差を返すこと", (_, elapsedMs, expected) => {
    const delta = calculateSolitaireTimeDeltaMs(elapsedMs);

    expect(delta).toBe(expected);
  });
});

describe("calculateSolitairePlayScore", () => {
  const cases = [
    [
      "取り消さずに基準時間以内で運び切ると満点",
      { elapsedMs: 360_000, retractedMoveCount: 0 },
      { stability: 60, speed: 40 },
      100,
    ],
    [
      "取り消した手1手ごとに安定性を2点引く",
      { elapsedMs: 200_000, retractedMoveCount: 5 },
      { stability: 50, speed: 40 },
      90,
    ],
    [
      "安定性は0点より下げない",
      { elapsedMs: 200_000, retractedMoveCount: 31 },
      { stability: 0, speed: 40 },
      40,
    ],
    [
      "速さは基準時間と0点の時間の間で直線に下げる",
      { elapsedMs: 540_000, retractedMoveCount: 0 },
      { stability: 60, speed: 20 },
      80,
    ],
    [
      "基準時間の2倍で速さを0点にする",
      { elapsedMs: 720_000, retractedMoveCount: 0 },
      { stability: 60, speed: 0 },
      60,
    ],
  ] as const;

  test.each(cases)("%sこと", (_, input, expectedBreakdown, expectedTotal) => {
    const score = calculateSolitairePlayScore(input);

    expect(score.breakdown).toEqual(expectedBreakdown);
    expect(score.total).toBe(expectedTotal);
  });

  test("満点の内訳が安定性60点・速さ40点の順であること", () => {
    const items = Object.entries(SOLITAIRE_SCORE_MAXIMUMS);

    expect(items).toEqual([
      ["stability", 60],
      ["speed", 40],
    ]);
  });
});
