import { magicSquareExampleSquares } from "@/games/magic-square/problem/example-squares";
import { goalFigureBoard } from "@/games/magic-square/ui/MagicSquareHowToPlayDialog/figure-boards";

describe("goalFigureBoard", () => {
  test("答えが、問題集から除く例の魔方陣と同じこと", () => {
    expect(goalFigureBoard.board.cells).toEqual(magicSquareExampleSquares[4]);
  });
});
