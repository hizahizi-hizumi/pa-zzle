import {
  calculateNanpurePlayScore,
  getNanpureGameResultLevel,
  NANPURE_SPEED_FULL_SCORE_MS,
} from "./score";

describe("calculateNanpurePlayScore", () => {
  const perfectFacts = {
    elapsedMs: NANPURE_SPEED_FULL_SCORE_MS,
    mistakeCount: 0,
    undoCount: 0,
    restartCount: 0,
  };
  const mistakeFacts = { ...perfectFacts, mistakeCount: 3 };
  const justOverTimeFacts = {
    ...perfectFacts,
    elapsedMs: NANPURE_SPEED_FULL_SCORE_MS + 1,
  };
  const twoMinutesOverFacts = {
    ...perfectFacts,
    elapsedMs: NANPURE_SPEED_FULL_SCORE_MS + 120_000,
  };
  const unstableFacts = { ...perfectFacts, undoCount: 3, restartCount: 1 };
  const minimumFacts = {
    elapsedMs: NANPURE_SPEED_FULL_SCORE_MS + 10_000_000,
    mistakeCount: 100,
    undoCount: 100,
    restartCount: 100,
  };

  test("ミスも超過時間も待ったもやり直しもなければ100点になること", () => {
    const score = calculateNanpurePlayScore(perfectFacts);

    expect(score).toEqual({
      total: 100,
      breakdown: { accuracy: 40, speed: 40, stability: 20 },
    });
  });

  test("ミス1回につき正確さを5点減点すること", () => {
    const score = calculateNanpurePlayScore(mistakeFacts);

    expect(score.breakdown.accuracy).toBe(25);
    expect(score.total).toBe(85);
  });

  test("15分を超えた時間を1分単位で切り上げて速さを減点すること", () => {
    const justOver = calculateNanpurePlayScore(justOverTimeFacts);
    const twoMinutesOver = calculateNanpurePlayScore(twoMinutesOverFacts);

    expect(justOver.breakdown.speed).toBe(39);
    expect(twoMinutesOver.breakdown.speed).toBe(38);
  });

  test("待ったとやり直しを安定性からそれぞれ減点すること", () => {
    const score = calculateNanpurePlayScore(unstableFacts);

    expect(score.breakdown.stability).toBe(9);
    expect(score.total).toBe(89);
  });

  test("各評価軸を0点未満にしないこと", () => {
    const score = calculateNanpurePlayScore(minimumFacts);

    expect(score).toEqual({
      total: 0,
      breakdown: { accuracy: 0, speed: 0, stability: 0 },
    });
  });
});

describe("getNanpureGameResultLevel", () => {
  const cases = [
    [100, "perfect"],
    [90, "great"],
    [80, "good"],
    [79, "clear"],
  ] as const;

  test.each(cases)("評価点 %i を %s 段階として扱うこと", (score, expected) => {
    const level = getNanpureGameResultLevel(score);

    expect(level).toBe(expected);
  });
});
