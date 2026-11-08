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
  let onClearAnimationComplete: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    onSlideTile = vi.fn<(tileIndex: number) => void>();
    onClearAnimationComplete = vi.fn<() => void>();
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
          onClearAnimationComplete={onClearAnimationComplete}
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

  describe("触って滑らせる比較操作の場合", () => {
    function renderGestureBoard() {
      render(
        <SlidePuzzleBoard
          board={board}
          operation={null}
          surface="crafted"
          gestureEnabled
          interactionDisabled={false}
          clearing={false}
          onSlideTile={onSlideTile}
          onClearAnimationComplete={onClearAnimationComplete}
        />,
      );
      return screen.getByRole("group", { name: "盤面" });
    }

    function pointerGesture(tile: HTMLElement, endX: number, endY: number) {
      Object.defineProperty(tile, "clientWidth", {
        configurable: true,
        value: 100,
      });
      fireEvent.pointerDown(tile, {
        pointerId: 1,
        pointerType: "touch",
        clientX: 100,
        clientY: 100,
      });
      fireEvent.pointerMove(tile, {
        pointerId: 1,
        pointerType: "touch",
        clientX: endX,
        clientY: endY,
      });
      fireEvent.pointerUp(tile, {
        pointerId: 1,
        pointerType: "touch",
        clientX: endX,
        clientY: endY,
      });
      fireEvent.click(tile, { detail: 1 });
    }

    test("空白へ向かって滑らせるとタイルが一度だけ移動すること", () => {
      const boardGroup = renderGestureBoard();
      const tile = within(boardGroup).getByRole("button", { name: "13" });
      pointerGesture(tile, 60, 100);
      expect(onSlideTile).toHaveBeenCalledOnce();
      expect(onSlideTile).toHaveBeenCalledWith(13);
    });

    test("複数タイル越しでも空白の方向なら滑らせられること", () => {
      const boardGroup = renderGestureBoard();
      const tile = within(boardGroup).getByRole("button", { name: "15" });
      pointerGesture(tile, 60, 100);
      expect(onSlideTile).toHaveBeenCalledWith(15);
    });

    test("斜めや逆方向へ滑らせても誤って移動しないこと", () => {
      const boardGroup = renderGestureBoard();
      const tile = within(boardGroup).getByRole("button", { name: "13" });
      pointerGesture(tile, 100, 60);
      expect(onSlideTile).not.toHaveBeenCalled();
    });

    test("軽くタップした場合は従来と同じ一回の操作になること", () => {
      const boardGroup = renderGestureBoard();
      const tile = within(boardGroup).getByRole("button", { name: "13" });
      pointerGesture(tile, 98, 100);
      expect(onSlideTile).toHaveBeenCalledOnce();
    });

    test("比較操作を無効にするとスワイプで操作されないこと", () => {
      render(
        <SlidePuzzleBoard
          board={board}
          operation={null}
          gestureEnabled={false}
          interactionDisabled={false}
          clearing={false}
          onSlideTile={onSlideTile}
          onClearAnimationComplete={onClearAnimationComplete}
        />,
      );
      const tile = screen.getByRole("button", { name: "13" });
      Object.defineProperty(tile, "clientWidth", {
        configurable: true,
        value: 100,
      });
      fireEvent.pointerDown(tile, {
        pointerId: 1,
        pointerType: "touch",
        clientX: 100,
        clientY: 100,
      });
      fireEvent.pointerUp(tile, {
        pointerId: 1,
        pointerType: "touch",
        clientX: 60,
        clientY: 100,
      });
      expect(onSlideTile).not.toHaveBeenCalled();
    });
  });

  describe.each([
    ["3×3", [1, 2, 3, 4, 5, 6, 7, 0, 8], "8", 8],
    [
      "5×5",
      [
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
        21, 22, 23, 0, 24,
      ],
      "24",
      24,
    ],
  ] as const)(
    "%s の盤面の場合",
    (_, sizedBoard, lastTileName, lastTileIndex) => {
      let boardGroup: HTMLElement;

      beforeEach(() => {
        render(
          <SlidePuzzleBoard
            board={sizedBoard}
            operation={null}
            interactionDisabled={false}
            clearing={false}
            onSlideTile={onSlideTile}
            onClearAnimationComplete={onClearAnimationComplete}
          />,
        );
        boardGroup = screen.getByRole("group", { name: "盤面" });
      });

      test("空白を除くすべてのタイルを表示すること", () => {
        const result = within(boardGroup).getAllByRole("button");

        expect(result).toHaveLength(sizedBoard.length - 1);
      });

      test("右下のタイルのタップでそのタイルのマスを通知すること", () => {
        fireEvent.click(
          within(boardGroup).getByRole("button", { name: lastTileName }),
        );

        expect(onSlideTile).toHaveBeenCalledWith(lastTileIndex);
      });
    },
  );

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
          onClearAnimationComplete={onClearAnimationComplete}
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
            onClearAnimationComplete={onClearAnimationComplete}
          />,
        );

        expect(onClearAnimationComplete).toHaveBeenCalledOnce();
      });
    });
  });
});
