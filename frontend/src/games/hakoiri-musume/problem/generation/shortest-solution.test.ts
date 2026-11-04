import { measureHakoiriMusumeOptimalMoveCount } from "@/games/hakoiri-musume/problem/generation/shortest-solution";
import { parseHakoiriMusumeBoard } from "@/games/hakoiri-musume/puzzle/board";

describe("measureHakoiriMusumeOptimalMoveCount", () => {
  const cases = [
    ["合意の易しい例", parseHakoiriMusumeBoard("vAAvwAAwv..vwhiws..s")!, 13],
    ["横刀立馬", parseHakoiriMusumeBoard("vAAvwAAwvhivwssws..s")!, 81],
    [
      "娘が出口の1段上にいて真下が空いている",
      parseHakoiriMusumeBoard("v..vwssw.AAv.AAws..s")!,
      1,
    ],
  ] as const;

  test.each(cases)(
    "娘を出口の前へ運ぶ最短手数を数えること: %s",
    (_, pieces, expected) => {
      const moveCount = measureHakoiriMusumeOptimalMoveCount(pieces);

      expect(moveCount).toBe(expected);
    },
  );

  describe("娘を出口の前へ運べない盤面の場合", () => {
    // 空いたマスが無く、どの駒も動かせない
    const pieces = parseHakoiriMusumeBoard("AAvvAAwwvhivwhiwhihi")!;

    test("null を返すこと", () => {
      const moveCount = measureHakoiriMusumeOptimalMoveCount(pieces);

      expect(moveCount).toBeNull();
    });
  });
});
