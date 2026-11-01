import { measureHamiltonianPathStraightRatio } from "@/games/hamiltonian-path/problem/generation/straightness";

describe("measureHamiltonianPathStraightRatio", () => {
  // 4×4 の盤面のマス番号（行優先）で道を書く。
  const cases: readonly [string, readonly number[], number][] = [
    [
      "行ごとに折り返す蛇行の道は全マスが直進区間に含まれる",
      [0, 1, 2, 3, 7, 6, 5, 4, 8, 9, 10, 11, 15, 14, 13, 12],
      1,
    ],
    [
      "3マスまでの直進しかない道は0になる",
      [0, 1, 2, 6, 5, 9, 10, 11, 15, 14, 13],
      0,
    ],
    [
      "4マスの直進区間を1つだけ含む道は、その4マスの割合になる",
      [0, 4, 8, 12, 13, 9, 10, 14, 15, 11],
      0.4,
    ],
    [
      "折り返しのマスを前後の直進区間の両方に数える",
      [0, 1, 2, 3, 7, 11, 15],
      1,
    ],
    ["2マス以下の道は0になる", [0, 1], 0],
  ];

  test.each(cases)("%sこと", (_, path, expected) => {
    const ratio = measureHamiltonianPathStraightRatio(path);

    expect(ratio).toBeCloseTo(expected);
  });
});
