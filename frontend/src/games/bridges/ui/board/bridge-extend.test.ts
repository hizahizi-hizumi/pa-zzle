import { parseBridgesBoard } from "@/games/bridges/puzzle/board";
import { getBridgeExtendMs } from "@/games/bridges/ui/board/bridge-extend";

describe("getBridgeExtendMs", () => {
  // 辺0 = 島0-島1（2マス）、辺1 = 島0-島2（9マス）。
  const board = parseBridgesBoard([
    "1.1.......",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "..........",
    "1.........",
  ]);

  test("隣の島への板は、90ミリ秒に1マスあたり15ミリ秒を足した時間で渡すこと", () => {
    expect(getBridgeExtendMs(board, 0)).toBe(120);
  });

  test("遠い島への板も、220ミリ秒より長くかけないこと", () => {
    expect(getBridgeExtendMs(board, 1)).toBe(220);
  });
});
