import {
  calculateNanpurePlayScore,
  NANPURE_SPEED_FULL_SCORE_MS,
} from "@/games/nanpure/score";

describe("calculateNanpurePlayScore", () => {
  const fullSpeed = NANPURE_SPEED_FULL_SCORE_MS;
  const cleanPlay = { elapsedMs: fullSpeed, mistakeCount: 0 };

  test("正確な数字を時間内に確定したプレイが100点になること", () => {
    const score = calculateNanpurePlayScore(cleanPlay);

    expect(score).toEqual({
      total: 100,
      breakdown: { accuracy: 40, speed: 40, stability: 20 },
    });
  });

  test("完成解と異なる数字の入力1回につき正確さを5点減点すること", () => {
    const score = calculateNanpurePlayScore({
      ...cleanPlay,
      mistakeCount: 3,
    });

    expect(score.breakdown.accuracy).toBe(25);
    expect(score.total).toBe(85);
  });

  test("15分を超えた時間を1分単位で切り上げて速さを減点すること", () => {
    const justOver = calculateNanpurePlayScore({
      ...cleanPlay,
      elapsedMs: fullSpeed + 1,
    });
    const twoMinutesOver = calculateNanpurePlayScore({
      ...cleanPlay,
      elapsedMs: fullSpeed + 120_000,
    });

    expect(justOver.breakdown.speed).toBe(39);
    expect(twoMinutesOver.breakdown.speed).toBe(38);
  });

  test("メモ操作の待ったは減点せず、数字を戻す待ったと盤面を戻す操作は減点すること", () => {
    const memoOnly = calculateNanpurePlayScore({
      ...cleanPlay,
      undoCount: 20,
      digitUndoCount: 0,
    });
    const digitUndo = calculateNanpurePlayScore({
      ...cleanPlay,
      undoCount: 20,
      digitUndoCount: 1,
    });
    const restarted = calculateNanpurePlayScore({
      ...cleanPlay,
      undoCount: 20,
      digitUndoCount: 0,
      restartCount: 1,
    });
    expect(memoOnly.total).toBe(100);
    expect(digitUndo.total).toBe(98);
    expect(restarted.total).toBe(95);
  });

  const comparisonCases = [
    [
      "候補を丁寧に整理して20分で無誤答のプレイは15分で3回当て推量したプレイより高い",
      { elapsedMs: 20 * 60_000, mistakeCount: 0 },
      { elapsedMs: fullSpeed, mistakeCount: 3 },
    ],

    [
      "同じく正確に解いたなら15分のプレイは20分のプレイより高い",
      { elapsedMs: fullSpeed, mistakeCount: 0 },
      { elapsedMs: 20 * 60_000, mistakeCount: 0 },
    ],
  ] as const;

  test.each(comparisonCases)("%sこと", (_label, better, worse) => {
    const betterScore = calculateNanpurePlayScore(better);
    const worseScore = calculateNanpurePlayScore(worse);

    expect(betterScore.total).toBeGreaterThan(worseScore.total);
  });

  test("各評価軸を0点未満にしないこと", () => {
    const score = calculateNanpurePlayScore({
      elapsedMs: fullSpeed + 10_000_000,
      mistakeCount: 100,
      digitUndoCount: 100,
      restartCount: 100,
    });

    expect(score).toEqual({
      total: 0,
      breakdown: { accuracy: 0, speed: 0, stability: 0 },
    });
  });
});
