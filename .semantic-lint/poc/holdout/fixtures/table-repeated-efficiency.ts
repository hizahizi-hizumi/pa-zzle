describe("calculateWaterSortPlayScore", () => {
  test("クリア手数が最短手数の1.5倍なら効率を半分にすること", () => {
    const score = calculateWaterSortPlayScore({
      elapsedMs: 64_000,
      moveCount: 15,
      completionMoveCount: 15,
      optimalMoveCount: 10,
      colorCount: 6,
    });

    expect(score.breakdown.efficiency).toBe(20);
  });

  test("クリア手数が最短手数の2倍以上なら効率を0点にすること", () => {
    const score = calculateWaterSortPlayScore({
      elapsedMs: 64_000,
      moveCount: 20,
      completionMoveCount: 20,
      optimalMoveCount: 10,
      colorCount: 6,
    });

    expect(score.breakdown.efficiency).toBe(0);
  });
});
