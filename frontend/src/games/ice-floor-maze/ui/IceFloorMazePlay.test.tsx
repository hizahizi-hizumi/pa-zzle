import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import type {
  IceFloorMazeLastSlide,
  IceFloorMazeResult,
} from "@/games/ice-floor-maze/play/use-ice-floor-maze-play";
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

// 10×13 で最短6手の問題。基準時間は 130マス × 0.2秒 + 6手 × 2.5秒 = 41秒。
const result: IceFloorMazeResult = {
  elapsedMs: 51_000,
  moveCount: 9,
  undoCount: 2,
  restartCount: 1,
  speedReference: { drawnCellCount: 130, elementCount: 0 },
  optimalMoveCount: 6,
  moveDelta: 3,
  speedRule: { fullScoreMs: 41_000, zeroScoreMs: 82_000 },
  timeDeltaMs: 10_000,
  score: { total: 70, breakdown: { efficiency: 40, speed: 30 } },
};

afterEach(() => {
  cleanup();
  delete (Element.prototype as { animate?: Element["animate"] }).animate;
});

describe("IceFloorMazePlay", () => {
  const callbacks = {
    onSlide: vi.fn(),
    onUndo: vi.fn(),
    onRestart: vi.fn(),
    onReplay: vi.fn(),
    onStartNewProblem: vi.fn(),
    onOpenRecords: vi.fn(),
    onClearAnimationComplete: vi.fn(),
    onChangeDifficulty: vi.fn(),
    onBackToHome: vi.fn(),
  };

  type RenderOptions = {
    progress?: GameProgress;
    isTrapped?: boolean;
    lastSlide?: IceFloorMazeLastSlide | null;
  };

  function createPlay({
    progress = "playing",
    isTrapped = false,
    lastSlide = null,
  }: RenderOptions = {}) {
    return (
      <IceFloorMazePlay
        difficulty="4"
        progress={progress}
        result={progress === "result" ? result : null}
        recordOutcomeNotice={null}
        elapsedMs={65_000}
        board={board}
        cells={board.cells}
        goal={18}
        position={17}
        moveCount={7}
        isTrapped={isTrapped}
        lastSlide={lastSlide}
        blockedInput={null}
        canUndo
        canRestart
        {...callbacks}
      />
    );
  }

  function renderPlay(options?: RenderOptions) {
    return render(createPlay(options));
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

    test("滑らせる向きを選ぶボタンを置かないこと", () => {
      const directionButtons = screen.queryAllByRole("button", {
        name: /滑らせる/,
      });

      expect(directionButtons).toHaveLength(0);
    });

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

    test("メニューの 遊び方 で、もろい岩・薄い氷とスワイプの操作を説明する遊び方を開くこと", () => {
      fireEvent.pointerDown(
        screen.getByRole("button", { name: "その他の操作" }),
        { button: 0, ctrlKey: false },
      );
      fireEvent.click(screen.getByRole("menuitem", { name: "遊び方" }));

      const dialog = within(screen.getByRole("dialog", { name: "遊び方" }));

      expect(
        dialog.getByText(/もろい岩.*すぐ隣から押しても崩れない/),
      ).toBeTruthy();
      expect(dialog.getByText(/薄い氷.*割れて水面になる/)).toBeTruthy();
      expect(dialog.getByText(/盤面をスワイプして/)).toBeTruthy();
      expect(dialog.queryByText(/スライド|矢印ボタン/)).toBeNull();
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

  describe("駒が滑って見えている場合", () => {
    let finishSlideAnimation: () => void;
    let rerenderPlay: (options: RenderOptions) => void;

    beforeEach(() => {
      const slideAnimationFinished = new Promise<void>((resolve) => {
        finishSlideAnimation = resolve;
      });
      Object.defineProperty(Element.prototype, "animate", {
        configurable: true,
        value: vi.fn(
          () =>
            ({
              finished: slideAnimationFinished,
              cancel: vi.fn(),
            }) as unknown as Animation,
        ),
      });
    });

    describe("閉じ込めの外から閉じ込めへ滑り込む場合", () => {
      const lastSlide: IceFloorMazeLastSlide = {
        id: 1,
        direction: "right",
        from: 17,
        to: 19,
        path: [18, 19],
        crumbledRock: null,
        crackedIce: [],
        passedGoal: true,
        isClearingMove: false,
        entersTrap: true,
      };

      beforeEach(() => {
        const { rerender } = renderPlay();
        rerenderPlay = (options) => rerender(createPlay(options));
      });

      test("駒が滑り着くまで知らせず、滑り着いてから知らせること", async () => {
        rerenderPlay({ isTrapped: true, lastSlide });
        const noticeWhileSliding = screen.queryByText("閉じ込められた");
        await act(async () => finishSlideAnimation());

        const noticeAfterSliding = screen.queryByText("閉じ込められた");

        expect(noticeWhileSliding).toBeNull();
        expect(noticeAfterSliding).not.toBeNull();
      });
    });

    describe("閉じ込めの中で滑る場合", () => {
      const lastSlide: IceFloorMazeLastSlide = {
        id: 2,
        direction: "left",
        from: 19,
        to: 15,
        path: [18, 17, 16, 15],
        crumbledRock: null,
        crackedIce: [],
        passedGoal: true,
        isClearingMove: false,
        entersTrap: false,
      };
      let notice: HTMLElement;

      beforeEach(() => {
        const { rerender } = renderPlay({ isTrapped: true });
        rerenderPlay = (options) => rerender(createPlay(options));
        notice = screen.getByRole("status");
      });

      test("閉じ込めの知らせを出し続けること", () => {
        rerenderPlay({ isTrapped: true, lastSlide });

        const noticeWhileSliding = screen.getByRole("status");

        expect(noticeWhileSliding).toBe(notice);
        expect(Element.prototype.animate).toHaveBeenCalled();
      });
    });
  });

  describe("直前に滑らせた場合", () => {
    const lastSlide: IceFloorMazeLastSlide = {
      id: 1,
      direction: "right",
      from: 15,
      to: 17,
      path: [16, 17],
      crumbledRock: null,
      crackedIce: [],
      passedGoal: false,
      isClearingMove: false,
      entersTrap: false,
    };

    beforeEach(() => {
      renderPlay({ lastSlide });
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

    test("スワイプを盤面へ流さないこと", () => {
      const area = screen.getAllByRole("main").at(-1)!;

      fireEvent.pointerDown(area, {
        pointerId: 1,
        isPrimary: true,
        button: 0,
        clientX: 100,
        clientY: 100,
      });
      fireEvent.pointerMove(area, { pointerId: 1, clientX: 140, clientY: 100 });

      expect(callbacks.onSlide).not.toHaveBeenCalled();
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

    test("スコアと手数・時間を基準との差つきで表示すること", () => {
      const score = screen.getByText("70");
      const moveCount = screen.getByText("9手");
      const moveDelta = screen.getByText("最短 +3");
      const elapsedTime = screen.getByText("00:51");
      const timeDelta = screen.getByText("基準 +00:10");

      expect(score).toBeTruthy();
      expect(moveCount).toBeTruthy();
      expect(moveDelta).toBeTruthy();
      expect(elapsedTime).toBeTruthy();
      expect(timeDelta).toBeTruthy();
    });

    test("盤面を表示しないこと", () => {
      const boardImage = screen.queryByRole("img", { name: "盤面" });

      expect(boardImage).toBeNull();
    });

    const actionCases = [
      ["プレイ！", "onStartNewProblem"],
      ["同じ問題", "onReplay"],
      ["記録を確認", "onOpenRecords"],
      ["難易度変更", "onChangeDifficulty"],
      ["ホーム", "onBackToHome"],
    ] as const;

    test.each(actionCases)(
      "%s ボタンで対応する操作を通知すること",
      (buttonName, callbackName) => {
        fireEvent.click(screen.getByRole("button", { name: buttonName }));

        expect(callbacks[callbackName]).toHaveBeenCalledOnce();
      },
    );

    test("スコアの内訳と、待った・盤面を戻すの回数、採点基準を開けること", () => {
      fireEvent.click(
        screen.getByRole("button", { name: "スコアの内訳・採点基準" }),
      );

      const efficiency = screen.getByText("40 / 60");
      const speed = screen.getByText("30 / 40");
      const undoCount = screen.getByText("待った").parentElement;
      const restartCount = screen.getByText("盤面を戻す").parentElement;
      const efficiencyCriteria = screen.getByText(
        /最短6手で60点.*22手で30点。総手数には「待った」で取り消した手と「盤面を戻す」前の手も含む/,
      );
      const speedCriteria = screen.getByText(
        /基準時間は盤面130マス × 0\.2秒 \+ 最短6手 × 2\.5秒/,
      );

      expect(efficiency).toBeTruthy();
      expect(speed).toBeTruthy();
      expect(undoCount?.textContent).toContain("2回");
      expect(restartCount?.textContent).toContain("1回");
      expect(efficiencyCriteria).toBeTruthy();
      expect(speedCriteria).toBeTruthy();
    });
  });
});
