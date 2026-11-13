import {
  findZukanMilestoneProgress,
  getZukanMilestoneRatio,
  isZukanMilestone,
} from "@/zukan/zukan-milestone";

describe("findZukanMilestoneProgress", () => {
  const cases = [
    ["まだ解いていない", 0, 1000, { solvedCount: 0, previous: 0, next: 10 }],
    ["節目に届いた", 25, 1000, { solvedCount: 25, previous: 25, next: 50 }],
    [
      "次の節目が全問の数より大きい",
      260,
      500,
      { solvedCount: 260, previous: 250, next: 500 },
    ],
    ["全問を解いた", 500, 500, { solvedCount: 500, previous: 500, next: null }],
  ] as const;

  test.each(cases)(
    "前の節目と次の節目を返すこと: %s",
    (_, solved, total, expected) => {
      const progress = findZukanMilestoneProgress(solved, total);

      expect(progress).toEqual(expected);
    },
  );
});

describe("isZukanMilestone", () => {
  const cases = [
    [10, 1000, true],
    [11, 1000, false],
    [500, 500, true],
    [1000, 500, false],
    [0, 500, false],
  ] as const;

  test.each(cases)(
    "解いた数 %i が全問 %i 問の節目かを返すこと",
    (solved, total, expected) => {
      const result = isZukanMilestone(solved, total);

      expect(result).toBe(expected);
    },
  );
});

describe("getZukanMilestoneRatio", () => {
  const cases = [
    ["前の節目から次の節目までの途中", 30, 1000, 0.2],
    ["全問を解いた", 5, 5, 1],
  ] as const;

  test.each(cases)("進みを返すこと: %s", (_, solved, total, expected) => {
    const ratio = getZukanMilestoneRatio(
      findZukanMilestoneProgress(solved, total),
    );

    expect(ratio).toBe(expected);
  });
});
