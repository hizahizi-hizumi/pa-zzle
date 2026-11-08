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

  describe("タイルを押し送る体験の場合", () => {
    let boardGroup: HTMLElement;
    let lastTile: HTMLElement;

    beforeEach(() => {
      render(
        <SlidePuzzleBoard
          board={board}
          experience="kinetic"
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

    test("離れたタイルをドラッグすると間のタイルも指と一緒に滑ること", () => {
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
        }).firstElementChild;
        expect((face as HTMLElement).style.translate).toBe("-40px 0px");
      }
    });

    test("十分に滑らせて指を離すと移動を一度だけ確定すること", () => {
      fireEvent.pointerDown(lastTile, {
        isPrimary: true,
        pointerId: 1,
        pointerType: "touch",
        clientX: 300,
        clientY: 100,
      });
      fireEvent.pointerMove(lastTile, {
        pointerId: 1,
        clientX: 240,
        clientY: 100,
      });
      fireEvent.pointerUp(lastTile, {
        pointerId: 1,
        clientX: 240,
        clientY: 100,
      });
      fireEvent.click(lastTile);

      expect(onSlideTile).toHaveBeenCalledExactlyOnceWith(15);
    });

    test("途中でドラッグを取り消すと盤面が戻り手数が増えないこと", () => {
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
      }).firstElementChild;
      expect((face as HTMLElement).style.translate).toBe("");
      expect(onSlideTile).not.toHaveBeenCalled();
    });
  });

  describe("空白を動かす体験の場合", () => {
    let boardGroup: HTMLElement;
    let pocket: HTMLElement;
    let track: HTMLElement;

    beforeEach(() => {
      render(
        <SlidePuzzleBoard
          board={board}
          experience="pocket"
          operation={null}
          interactionDisabled={false}
          clearing={false}
          onSlideTile={onSlideTile}
          onClearAnimationComplete={onClearAnimationComplete}
        />,
      );
      boardGroup = screen.getByRole("group", { name: "盤面" });
      pocket = within(boardGroup).getByRole("button", {
        name: "空白を動かす",
      });
      track = pocket.parentElement as HTMLElement;
      vi.spyOn(track, "getBoundingClientRect").mockReturnValue({
        top: 0,
        left: 0,
        width: 400,
        height: 400,
        right: 400,
        bottom: 400,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });
    });

    test("マスをまたぐ前から空白と隣のタイルが指に追従すること", () => {
      fireEvent.pointerDown(pocket, {
        isPrimary: true,
        pointerId: 1,
        pointerType: "touch",
        clientX: 50,
        clientY: 350,
      });
      fireEvent.pointerMove(track, {
        pointerId: 1,
        clientX: 85,
        clientY: 350,
      });

      const face = within(boardGroup).getByRole("button", {
        name: "13",
      }).firstElementChild;
      expect((face as HTMLElement).style.translate).toBe("-35px 0px");
      expect(pocket.style.transform).toContain("translate(35px, 0px)");
      expect(onSlideTile).not.toHaveBeenCalled();
    });

    test("空白を次のマスまで運ぶと隣のタイルを動かすこと", () => {
      fireEvent.pointerDown(pocket, {
        isPrimary: true,
        pointerId: 1,
        pointerType: "touch",
        clientX: 50,
        clientY: 350,
      });
      fireEvent.pointerMove(track, {
        pointerId: 1,
        clientX: 130,
        clientY: 350,
      });

      expect(onSlideTile).toHaveBeenCalledExactlyOnceWith(13);
    });

    test("空白のドラッグを途中で取り消してもタイルが動かないこと", () => {
      fireEvent.pointerDown(pocket, {
        isPrimary: true,
        pointerId: 1,
        pointerType: "touch",
        clientX: 50,
        clientY: 350,
      });
      fireEvent.pointerMove(track, {
        pointerId: 1,
        clientX: 85,
        clientY: 350,
      });
      fireEvent.pointerCancel(track, { pointerId: 1 });

      const face = within(boardGroup).getByRole("button", {
        name: "13",
      }).firstElementChild;
      expect((face as HTMLElement).style.translate).toBe("");
      expect(onSlideTile).not.toHaveBeenCalled();
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
