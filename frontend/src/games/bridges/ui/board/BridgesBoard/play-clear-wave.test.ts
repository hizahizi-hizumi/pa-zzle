import { parseBridgesBoard } from "@/games/bridges/puzzle/board";
import { listClearWaveDepths } from "@/games/bridges/ui/board/BridgesBoard/play-clear-wave";

describe("listClearWaveDepths", () => {
  // 島: 0 (0,0)、1 (0,4)、2 (4,0)、3 (4,4)。辺0 = 0-1、辺1 = 0-2、辺2 = 1-3、辺3 = 2-3。
  const board = parseBridgesBoard([
    "3...3",
    ".....",
    ".....",
    ".....",
    "2...2",
  ]);

  test("島0 から架かった橋をたどった段数を返すこと", () => {
    const depths = listClearWaveDepths(board, [2, 1, 1, 0]);

    expect(depths).toEqual([0, 1, 1, 2]);
  });

  test("橋でたどれない島には null を返すこと", () => {
    const depths = listClearWaveDepths(board, [1, 0, 0, 0]);

    expect(depths).toEqual([0, 1, null, null]);
  });
});
