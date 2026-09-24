import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import { FifteenPuzzleBoard } from "@/games/fifteen-puzzle/ui/board/FifteenPuzzleBoard";

// 最下段だけが 1 マスずつずれた盤面
const board = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 0, 13, 14, 15];

afterEach(() => {
  cleanup();
});

describe("FifteenPuzzleBoard", () => {
  let onSlideTile: ReturnType<typeof vi.fn<(tileIndex: number) => void>>;
  let boardGroup: HTMLElement;

  beforeEach(() => {
    onSlideTile = vi.fn<(tileIndex: number) => void>();
    render(
      <FifteenPuzzleBoard
        board={board}
        interactionDisabled={false}
        onSlideTile={onSlideTile}
      />,
    );
    boardGroup = screen.getByRole("group", { name: "盤面" });
  });

  test("空白を除く 15 枚のタイルを数字の名前を持つボタンとして表示すること", () => {
    const result = within(boardGroup).getAllByRole("button");

    expect(result.map((tile) => tile.textContent)).toEqual(
      Array.from({ length: 15 }, (_, index) => String(index + 1)),
    );
  });

  const tapCases = [
    ["13", 13],
    ["15", 15],
    ["1", 0],
  ] as const;

  test.each(tapCases)(
    "タイル %s のタップでそのタイルのマスを通知すること",
    (tileName, expectedTileIndex) => {
      fireEvent.click(
        within(boardGroup).getByRole("button", { name: tileName }),
      );

      expect(onSlideTile).toHaveBeenCalledWith(expectedTileIndex);
    },
  );
});
