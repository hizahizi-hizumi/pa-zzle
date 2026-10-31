import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import type { IceFloorMazeOperation } from "@/games/ice-floor-maze/play/use-ice-floor-maze-play";
import { parseIceFloorMazeBoard } from "@/games/ice-floor-maze/puzzle/board";
import { IceFloorMazePlay } from "@/games/ice-floor-maze/ui/IceFloorMazePlay";
import type { GameProgress } from "@/games/play";

// #  1  #  3  4
// 5  6  7  #  #
// 10 11 #  #  #
// 15 16 S  G  19
// #  21 22 23 #
const board = parseIceFloorMazeBoard([
  "#.#..",
  "...##",
  "..###",
  ".....",
  "#...#",
]);

afterEach(() => {
  cleanup();
});

describe("IceFloorMazePlay", () => {
  const callbacks = {
    onSlide: vi.fn(),
    onUndo: vi.fn(),
    onRestart: vi.fn(),
    onReplay: vi.fn(),
    onStartNewProblem: vi.fn(),
    onClearAnimationComplete: vi.fn(),
    onChangeDifficulty: vi.fn(),
    onBackToHome: vi.fn(),
  };

  type RenderOptions = {
    progress?: GameProgress;
    isTrapped?: boolean;
    operation?: IceFloorMazeOperation | null;
  };

  function renderPlay({
    progress = "playing",
    isTrapped = false,
    operation = null,
  }: RenderOptions = {}) {
    render(
      <IceFloorMazePlay
        progress={progress}
        elapsedMs={65_000}
        board={board}
        goal={18}
        position={17}
        moveCount={7}
        isTrapped={isTrapped}
        operation={operation}
        canUndo
        canRestart
        {...callbacks}
      />,
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("プレイ中の場合", () => {
    beforeEach(() => {
      renderPlay();
    });

    test("ゲーム名と手数・経過時間を表示すること", () => {
      const heading = screen.getByRole("heading", { name: "氷の床迷路" });
      const moveCount = screen.getByText("手数").parentElement;
      const elapsedTime = screen.getByText("時間").parentElement;

      expect(heading).toBeTruthy();
      expect(moveCount?.textContent).toBe("手数7");
      expect(elapsedTime?.textContent).toBe("時間01:05");
    });

    test("盤面を表示すること", () => {
      const boardImage = screen.getByRole("img", { name: "盤面" });

      expect(boardImage).toBeTruthy();
    });

    const directionButtonCases = [
      ["上へ滑らせる", "up"],
      ["右へ滑らせる", "right"],
      ["下へ滑らせる", "down"],
      ["左へ滑らせる", "left"],
    ] as const;

    test.each(directionButtonCases)(
      "%s ボタンでその向きへ滑らせる操作を通知すること",
      (name, direction) => {
        fireEvent.click(screen.getByRole("button", { name }));

        expect(callbacks.onSlide).toHaveBeenCalledWith(direction);
      },
    );

    test("待ったボタンで待ったを通知すること", () => {
      fireEvent.click(screen.getByRole("button", { name: "待った" }));

      expect(callbacks.onUndo).toHaveBeenCalledOnce();
    });

    const arrowKeyCases = [
      ["ArrowUp", "up"],
      ["ArrowDown", "down"],
      ["ArrowLeft", "left"],
      ["ArrowRight", "right"],
    ] as const;

    test.each(arrowKeyCases)(
      "%s キーで押した向きへ滑らせる操作を通知すること",
      (key, direction) => {
        fireEvent.keyDown(document.body, { key });

        expect(callbacks.onSlide).toHaveBeenCalledWith(direction);
      },
    );

    test("修飾キー付きの矢印キーは盤面へ流さないこと", () => {
      fireEvent.keyDown(document.body, { key: "ArrowLeft", altKey: true });

      expect(callbacks.onSlide).not.toHaveBeenCalled();
    });

    test("押し続けたときの繰り返しの矢印キーでは滑らせないこと", () => {
      fireEvent.keyDown(document.body, { key: "ArrowLeft", repeat: true });

      expect(callbacks.onSlide).not.toHaveBeenCalled();
    });

    describe("盤面の領域でのスワイプ", () => {
      const swipeCases = [
        ["左上へ斜めでも縦の動きが大きい", -10, -24, "up"],
        ["右", 30, 4, "right"],
        ["下", 0, 18, "down"],
        ["左", -40, 12, "left"],
      ] as const;

      test.each(swipeCases)(
        "%sスワイプで、その向きへ滑らせる操作を1回だけ通知すること",
        (_, deltaX, deltaY, direction) => {
          const area = screen.getAllByRole("main").at(-1)!;

          fireEvent.pointerDown(area, {
            pointerId: 1,
            isPrimary: true,
            button: 0,
            clientX: 100,
            clientY: 100,
          });
          fireEvent.pointerMove(area, {
            pointerId: 1,
            clientX: 100 + deltaX,
            clientY: 100 + deltaY,
          });
          fireEvent.pointerMove(area, {
            pointerId: 1,
            clientX: 100 + deltaX * 2,
            clientY: 100 + deltaY * 2,
          });
          fireEvent.pointerUp(area, { pointerId: 1 });

          expect(callbacks.onSlide).toHaveBeenCalledExactlyOnceWith(direction);
        },
      );

      test("閾値に届かない指の動きでは滑らせないこと", () => {
        const area = screen.getAllByRole("main").at(-1)!;

        fireEvent.pointerDown(area, {
          pointerId: 1,
          isPrimary: true,
          button: 0,
          clientX: 100,
          clientY: 100,
        });
        fireEvent.pointerMove(area, {
          pointerId: 1,
          clientX: 112,
          clientY: 110,
        });
        fireEvent.pointerUp(area, { pointerId: 1 });

        expect(callbacks.onSlide).not.toHaveBeenCalled();
      });
    });

    test("閉じ込めの知らせを出さないこと", () => {
      const notice = screen.queryByText("閉じ込められた");

      expect(notice).toBeNull();
    });

    const menuCases = [
      ["盤面を戻す", "onRestart"],
      ["リセット", "onReplay"],
      ["別の問題", "onStartNewProblem"],
      ["難易度変更", "onChangeDifficulty"],
      ["ホーム", "onBackToHome"],
    ] as const;

    test.each(menuCases)(
      "メニューの %s で対応する操作を通知すること",
      (itemName, callbackName) => {
        fireEvent.pointerDown(
          screen.getByRole("button", { name: "その他の操作" }),
          { button: 0, ctrlKey: false },
        );
        fireEvent.click(screen.getByRole("menuitem", { name: itemName }));

        expect(callbacks[callbackName]).toHaveBeenCalledOnce();
      },
    );

    test("メニューの 遊び方 で遊び方を開くこと", () => {
      fireEvent.pointerDown(
        screen.getByRole("button", { name: "その他の操作" }),
        { button: 0, ctrlKey: false },
      );
      fireEvent.click(screen.getByRole("menuitem", { name: "遊び方" }));

      const dialog = screen.getByRole("dialog", { name: "遊び方" });

      expect(within(dialog).queryByText(/スライド/)).toBeNull();
    });
  });

  describe("閉じ込められた場合", () => {
    beforeEach(() => {
      renderPlay({ isTrapped: true });
    });

    test("閉じ込められたことを知らせ、待ったと盤面を戻すへ導くこと", () => {
      const notice = screen.getByRole("status");

      fireEvent.click(within(notice).getByRole("button", { name: "待った" }));
      fireEvent.click(
        within(notice).getByRole("button", { name: "盤面を戻す" }),
      );

      expect(within(notice).getByText("閉じ込められた")).toBeTruthy();
      expect(callbacks.onUndo).toHaveBeenCalledOnce();
      expect(callbacks.onRestart).toHaveBeenCalledOnce();
    });
  });

  describe("直前に滑らせた場合", () => {
    const operation: IceFloorMazeOperation = {
      id: 1,
      type: "slid",
      direction: "right",
      from: 15,
      to: 17,
      path: [16, 17],
      passedGoal: false,
      isClearingMove: false,
    };

    beforeEach(() => {
      renderPlay({ operation });
    });

    test("通った跡を盤面に残すこと", () => {
      const trail = screen
        .getByRole("img", { name: "盤面" })
        .querySelector("[data-trail]");

      expect(trail).not.toBeNull();
    });
  });

  describe("完成演出中の場合", () => {
    beforeEach(() => {
      renderPlay({ progress: "clearing" });
    });

    test("方向ボタンを押せないこと", () => {
      const button = screen.getByRole("button", { name: "右へ滑らせる" });

      expect((button as HTMLButtonElement).disabled).toBe(true);
    });

    test("矢印キーを盤面へ流さないこと", () => {
      fireEvent.keyDown(document.body, { key: "ArrowLeft" });

      expect(callbacks.onSlide).not.toHaveBeenCalled();
    });
  });

  describe("クリアして結果表示へ進んだ場合", () => {
    beforeEach(() => {
      renderPlay({ progress: "result" });
    });

    test("盤面を見せ続けること", () => {
      const boardImage = screen.getByRole("img", { name: "盤面" });

      expect(boardImage).toBeTruthy();
    });
  });
});
