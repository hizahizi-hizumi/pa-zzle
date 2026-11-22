import { createHakoiriMusumeSpace } from "@/games/hakoiri-musume/problem/generation/general-space";
import { parseHakoiriMusumeArrangement } from "@/games/hakoiri-musume/puzzle/notation";

describe("createHakoiriMusumeSpace", () => {
  describe("出口が3マスの 5 × 5 の盤の場合", () => {
    const space = createHakoiriMusumeSpace({
      layout: parseHakoiriMusumeArrangement(
        "5x5;AA.../AA.../...../...../.....;bottom1-3@3.1,3.2",
      )!.layout,
      types: [{ kind: "square", target: 0, count: 1 }],
    });

    test("娘の距離を、近い方の行き先への歩数にすること", () => {
      const distances = Array.from(space.types[0]!.distances);

      expect(distances).toEqual([
        4, 3, 3, 4, 3, 2, 2, 3, 2, 1, 1, 2, 1, 0, 0, 1,
      ]);
    });
  });

  describe("娘の通り道に壁がある盤の場合", () => {
    // 上から3行目・左から2列目に壁。左上の娘は右へ回って下りる。
    const space = createHakoiriMusumeSpace({
      layout: parseHakoiriMusumeArrangement(
        "4x5;AA../AA../.#../..../....;bottom1-2@3.1",
      )!.layout,
      types: [{ kind: "square", target: 0, count: 1 }],
    });

    test("壁を回る歩数を距離にすること", () => {
      const distances = Array.from(space.types[0]!.distances);

      expect(distances).toEqual([6, 5, 4, 3, 2, 1, 0, 1]);
    });
  });
});
