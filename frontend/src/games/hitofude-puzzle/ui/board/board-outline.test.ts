import { parseHitofudePuzzleBoard } from "@/games/hitofude-puzzle/puzzle/board";
import {
  formatHitofudePuzzleOutlinePath,
  type HitofudePuzzleOutlineEdge,
  listHitofudePuzzleOutlineEdges,
} from "@/games/hitofude-puzzle/ui/board/board-outline";

/** 向きに依らず比べられるよう、辺の両端を左上から右下の順にそろえた文字列にする。 */
function toEdgeKeys(edges: readonly HitofudePuzzleOutlineEdge[]): string[] {
  return edges
    .map(({ x1, y1, x2, y2 }) =>
      x1 < x2 || (x1 === x2 && y1 <= y2)
        ? `${x1},${y1}-${x2},${y2}`
        : `${x2},${y2}-${x1},${y1}`,
    )
    .sort();
}

describe("listHitofudePuzzleOutlineEdges", () => {
  describe("穴の無い盤面の場合", () => {
    const board = parseHitofudePuzzleBoard(["S .", ". ."]);

    test("枠の四辺を外形にすること", () => {
      const edges = listHitofudePuzzleOutlineEdges(board);

      expect(toEdgeKeys(edges)).toEqual(
        toEdgeKeys([
          { x1: 0, y1: 0, x2: 1, y2: 0 },
          { x1: 1, y1: 0, x2: 2, y2: 0 },
          { x1: 2, y1: 0, x2: 2, y2: 1 },
          { x1: 2, y1: 1, x2: 2, y2: 2 },
          { x1: 0, y1: 2, x2: 1, y2: 2 },
          { x1: 1, y1: 2, x2: 2, y2: 2 },
          { x1: 0, y1: 0, x2: 0, y2: 1 },
          { x1: 0, y1: 1, x2: 0, y2: 2 },
        ]),
      );
    });
  });

  describe("外周に穴がある場合", () => {
    /**
     * 右上の角（2）が穴。
     * S . #
     * . . .
     * . . .
     */
    const board = parseHitofudePuzzleBoard(["S . #", ". . .", ". . ."]);

    test("穴の辺のうち、通れるマスに接する辺だけを外形の欠けとして縁取ること", () => {
      const keys = toEdgeKeys(listHitofudePuzzleOutlineEdges(board));

      expect(keys).toEqual(expect.arrayContaining(["2,0-2,1", "2,1-3,1"]));
      expect(keys).not.toContain("2,0-3,0");
      expect(keys).not.toContain("3,0-3,1");
      expect(keys).toHaveLength(12);
    });
  });

  describe("内側に穴がある場合", () => {
    /**
     * 中央（4）が穴。
     * S . .
     * . # .
     * . . .
     */
    const board = parseHitofudePuzzleBoard(["S . .", ". # .", ". . ."]);

    test("枠の外周に加えて、穴の四辺を縁取ること", () => {
      const keys = toEdgeKeys(listHitofudePuzzleOutlineEdges(board));

      expect(keys).toEqual(
        expect.arrayContaining(["1,1-2,1", "2,1-2,2", "1,2-2,2", "1,1-1,2"]),
      );
      expect(keys).toHaveLength(16);
    });
  });
});

describe("formatHitofudePuzzleOutlinePath", () => {
  const edges: HitofudePuzzleOutlineEdge[] = [
    { x1: 0, y1: 0, x2: 1, y2: 0 },
    { x1: 1, y1: 0, x2: 1, y2: 1 },
  ];

  test("辺ごとに始点へ移って終点まで引く path にすること", () => {
    const path = formatHitofudePuzzleOutlinePath(edges);

    expect(path).toBe("M0 0L1 0M1 0L1 1");
  });
});
