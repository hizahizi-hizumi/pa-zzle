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

  describe("木工の盤面の場合", () => {
    let boardGroup: HTMLElement;
    let lastTile: HTMLElement;

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
      lastTile = within(boardGroup).getByRole("button", { name: "15" });
      Object.defineProperty(lastTile, "clientWidth", {
        configurable: true,
        value: 100,
      });
    });

    test("タイル列を指で滑らせる途中は間の駒も一緒に動くこと", () => {
      fireEvent.pointerDown(lastTile, {
        isPrimary: true,
        pointerId: 1,
        pointerType: "touch",
        clientX: 300,
        clientY: 100,
      });
      fireEvent.pointerMove(lastTile, {
        pointerId: 1,
        clientX: 260,
        clientY: 100,
      });

      for (const number of ["13", "14", "15"]) {
        const face = within(boardGroup).getByRole("button", {
          name: number,
        }).firstElementChild as HTMLElement;
        expect(face.style.translate).toBe("-40px 0px");
        expect(face.getAttribute("data-slide-dragging")).toBe("true");
      }
    });

    test("駒を押し送って離すと一度だけ移動すること", () => {
      fireEvent.pointerDown(lastTile, {
        isPrimary: true,
        pointerId: 1,
        pointerType: "touch",
        clientX: 300,
        clientY: 100,
      });
      fireEvent.pointerMove(lastTile, {
        pointerId: 1,
        clientX: 260,
        clientY: 100,
      });
      fireEvent.pointerUp(lastTile, {
        pointerId: 1,
        clientX: 260,
        clientY: 100,
      });
      fireEvent.click(lastTile, { detail: 1 });

      expect(onSlideTile).toHaveBeenCalledExactlyOnceWith(15);
    });

    test("小さく滑らせて離すとタップ扱いせず木片が戻ること", () => {
      fireEvent.pointerDown(lastTile, {
        isPrimary: true,
        pointerId: 1,
        pointerType: "touch",
        clientX: 300,
        clientY: 100,
      });
      fireEvent.pointerMove(lastTile, {
        pointerId: 1,
        clientX: 288,
        clientY: 100,
      });
      fireEvent.pointerUp(lastTile, {
        pointerId: 1,
        clientX: 288,
        clientY: 100,
      });
      fireEvent.click(lastTile, { detail: 1 });

      const face = lastTile.firstElementChild as HTMLElement;
      expect(face.style.translate).toBe("");
      expect(onSlideTile).not.toHaveBeenCalled();
    });

    test("横へ逸れてから戻した操作もタップ扱いしないこと", () => {
      fireEvent.pointerDown(lastTile, {
        isPrimary: true,
        pointerId: 1,
        pointerType: "touch",
        clientX: 300,
        clientY: 100,
      });
      fireEvent.pointerMove(lastTile, {
        pointerId: 1,
        clientX: 300,
        clientY: 120,
      });
      fireEvent.pointerMove(lastTile, {
        pointerId: 1,
        clientX: 300,
        clientY: 100,
      });
      fireEvent.pointerUp(lastTile, {
        pointerId: 1,
        clientX: 300,
        clientY: 100,
      });
      fireEvent.click(lastTile, { detail: 1 });

      expect(onSlideTile).not.toHaveBeenCalled();
    });

    test("指が少し揺れたタップは通常どおり移動すること", () => {
      fireEvent.pointerDown(lastTile, {
        isPrimary: true,
        pointerId: 1,
        pointerType: "touch",
        clientX: 300,
        clientY: 100,
      });
      fireEvent.pointerMove(lastTile, {
        pointerId: 1,
        clientX: 296,
        clientY: 100,
      });
      fireEvent.pointerUp(lastTile, {
        pointerId: 1,
        clientX: 296,
        clientY: 100,
      });
      fireEvent.click(lastTile, { detail: 1 });

      expect(onSlideTile).toHaveBeenCalledExactlyOnceWith(15);
    });

    test("ドラッグ取消後もキーボード操作でタイルを動かせること", () => {
      fireEvent.pointerDown(lastTile, {
        isPrimary: true,
        pointerId: 1,
        pointerType: "touch",
        clientX: 300,
        clientY: 100,
      });
      fireEvent.pointerMove(lastTile, {
        pointerId: 1,
        clientX: 260,
        clientY: 100,
      });
      fireEvent.pointerCancel(lastTile, { pointerId: 1 });
      fireEvent.click(lastTile, { detail: 0 });

      expect(onSlideTile).toHaveBeenCalledExactlyOnceWith(15);
    });

    test("途中で操作を取り消しても盤面は移動しないこと", () => {
      fireEvent.pointerDown(lastTile, {
        isPrimary: true,
        pointerId: 1,
        pointerType: "touch",
        clientX: 300,
        clientY: 100,
      });
      fireEvent.pointerMove(lastTile, {
        pointerId: 1,
        clientX: 260,
        clientY: 100,
      });
      fireEvent.pointerCancel(lastTile, { pointerId: 1 });

      const face = within(boardGroup).getByRole("button", {
        name: "15",
      }).firstElementChild as HTMLElement;
      expect(face.style.translate).toBe("");
      expect(onSlideTile).not.toHaveBeenCalled();
    });
  });

  describe("チュートリアルの印を付けた木片をドラッグする場合", () => {
    let tile: HTMLElement;

    beforeEach(() => {
      render(
        <SlidePuzzleBoard
          board={board}
          operation={null}
          interactionDisabled={false}
          clearing={false}
          cues={[{ tile: 15, kind: "hint", id: 0 }]}
          spotlitTiles={[15]}
          onSlideTile={onSlideTile}
          onClearAnimationComplete={onClearAnimationComplete}
        />,
      );
      tile = within(screen.getByRole("group", { name: "盤面" })).getByRole(
        "button",
        { name: "15" },
      );
      Object.defineProperty(tile, "clientWidth", {
        configurable: true,
        value: 100,
      });
    });

    test("木片と操作の印と注目領域が同じ位置へ動くこと", () => {
      fireEvent.pointerDown(tile, {
        isPrimary: true,
        pointerId: 1,
        pointerType: "touch",
        clientX: 300,
        clientY: 100,
      });
      fireEvent.pointerMove(tile, {
        pointerId: 1,
        clientX: 260,
        clientY: 100,
      });

      const movingPiece = tile.firstElementChild as HTMLElement;

      expect(movingPiece.style.translate).toBe("-40px 0px");
      expect(movingPiece.querySelector("[data-tile-cue='hint']")).toBeTruthy();
      expect(
        movingPiece.querySelector("[data-tutorial-spotlight]"),
      ).toBeTruthy();
    });
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
