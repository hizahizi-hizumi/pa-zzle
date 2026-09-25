import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import { SlidePuzzleBoard } from "@/games/slide-puzzle/ui/board/SlidePuzzleBoard";

// 最下段だけが 1 マスずつずれた盤面
const board = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 0, 13, 14, 15];

afterEach(() => {
  cleanup();
});

describe("SlidePuzzleBoard", () => {
  let onSlideTile: ReturnType<typeof vi.fn<(tileIndex: number) => void>>;
  let boardGroup: HTMLElement;

  beforeEach(() => {
    onSlideTile = vi.fn<(tileIndex: number) => void>();
    render(
      <SlidePuzzleBoard
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

  describe.each([
    ["3×3", [1, 2, 3, 4, 5, 6, 0, 7, 8]],
    [
      "5×5",
      [
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
        0, 21, 22, 23, 24,
      ],
    ],
  ] as const)("%s の盤面の場合", (_, sizedBoard) => {
    test("空白を除くすべてのタイルを表示すること", () => {
      cleanup();
      render(
        <SlidePuzzleBoard
          board={sizedBoard}
          interactionDisabled={false}
          onSlideTile={onSlideTile}
        />,
      );

      const result = within(
        screen.getByRole("group", { name: "盤面" }),
      ).getAllByRole("button");

      expect(result).toHaveLength(sizedBoard.length - 1);
    });
  });
});
