import { parseIceFloorMazeBoard } from "@/games/ice-floor-maze/puzzle/board";
import { listIceFloorMazeEnclosedOutsideCells } from "@/games/ice-floor-maze/ui/board/terrain-paths";

describe("listIceFloorMazeEnclosedOutsideCells", () => {
  // x . . .
  // . . x .
  // . . . .
  // 左上の角 0 は縁から届く切り欠きで、6 は盤面に囲まれている。
  const board = parseIceFloorMazeBoard(["x...", "..x.", "...."]);

  test("盤面に囲まれた盤面の外だけを選ぶこと", () => {
    const enclosed = listIceFloorMazeEnclosedOutsideCells(board);

    expect([...enclosed]).toEqual([6]);
  });
});
