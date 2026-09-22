describe("calculateWaterSortPlayScore", () => {
  test("基準時間の1.5倍なら速さを半分にすること", () => {
    const score = calculateWaterSortPlayScore({
      elapsedMs: 96_000,
      moveCount: 10,
      completionMoveCount: 10,
      optimalMoveCount: 10,
      colorCount: 6,
    });

    expect(score.breakdown.speed).toBe(20);
  });

  test("基準時間の2倍以上なら速さを0点にすること", () => {
    const score = calculateWaterSortPlayScore({
      elapsedMs: 128_000,
      moveCount: 10,
      completionMoveCount: 10,
      optimalMoveCount: 10,
      colorCount: 6,
    });

    expect(score.breakdown.speed).toBe(0);
  });
});
