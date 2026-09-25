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
const solvedBoard = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0];

afterEach(() => {
  cleanup();
});

describe("SlidePuzzleBoard", () => {
  let onSlideTile: ReturnType<typeof vi.fn<(tileIndex: number) => void>>;
  let onClearingComplete: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    onSlideTile = vi.fn<(tileIndex: number) => void>();
    onClearingComplete = vi.fn<() => void>();
  });

  describe("プレイ中の場合", () => {
    let boardGroup: HTMLElement;

    beforeEach(() => {
      render(
        <SlidePuzzleBoard
          board={board}
          operation={null}
          interactionDisabled={false}
          clearing={false}
          onSlideTile={onSlideTile}
          onClearingComplete={onClearingComplete}
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

  describe("完成した場合", () => {
    let rerender: ReturnType<typeof render>["rerender"];

    beforeEach(() => {
      ({ rerender } = render(
        <SlidePuzzleBoard
          board={solvedBoard}
          operation={null}
          interactionDisabled
          clearing={false}
          onSlideTile={onSlideTile}
          onClearingComplete={onClearingComplete}
        />,
      ));
    });

    describe("演出を再生できない環境の場合", () => {
      test("完成演出に入るとすぐに完成演出の完了を通知すること", () => {
        rerender(
          <SlidePuzzleBoard
            board={solvedBoard}
            operation={null}
            interactionDisabled
            clearing
            onSlideTile={onSlideTile}
            onClearingComplete={onClearingComplete}
          />,
        );

        expect(onClearingComplete).toHaveBeenCalledOnce();
      });
    });
  });
});
