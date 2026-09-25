import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import type {
  SlidePuzzleProgress,
  SlidePuzzleResult,
} from "@/games/slide-puzzle/play/use-slide-puzzle-play";
import { SlidePuzzlePlay } from "@/games/slide-puzzle/ui/SlidePuzzlePlay";

const playingBoard = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 0, 13, 14, 15];
const solvedBoard = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0];
const result: SlidePuzzleResult = {
  elapsedMs: 80_000,
  moveCount: 42,
  completionMoveCount: 34,
  slideCount: 25,
  restartCount: 1,
  optimalMoveCount: 30,
  moveDelta: 12,
  timeDeltaMs: 10_000,
  speedFullScoreMs: 70_000,
  score: { total: 77, breakdown: { efficiency: 43, speed: 34 } },
};

afterEach(() => {
  cleanup();
});

describe("SlidePuzzlePlay", () => {
  const callbacks = {
    onSlideTile: vi.fn(),
    onSlideByKeyboard: vi.fn(),
    onRestart: vi.fn(),
    onReplay: vi.fn(),
    onStartNewProblem: vi.fn(),
    onOpenRecords: vi.fn(),
    onClearingComplete: vi.fn(),
    onChangeDifficulty: vi.fn(),
    onBackToHome: vi.fn(),
  };

  function renderPlay(progress: SlidePuzzleProgress, board: readonly number[]) {
    render(
      <SlidePuzzlePlay
        difficulty="3"
        status={progress === "playing" ? "playing" : "cleared"}
        progress={progress}
        board={board}
        elapsedMs={65_000}
        moveCount={7}
        operation={null}
        result={progress === "playing" ? null : result}
        recordOutcomeNotice={null}
        {...callbacks}
      />,
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("プレイ中の場合", () => {
    beforeEach(() => {
      renderPlay("playing", playingBoard);
    });

    test("ゲーム名と手数・経過時間を表示すること", () => {
      const heading = screen.getByRole("heading", { name: "スライドパズル" });
      const moveCount = screen.getByText("手数").parentElement;
      const elapsedTime = screen.getByText("時間").parentElement;

      expect(heading).toBeTruthy();
      expect(moveCount?.textContent).toBe("手数7");
      expect(elapsedTime?.textContent).toBe("時間01:05");
    });

    test("タイルのタップでそのタイルのマスを通知すること", () => {
      fireEvent.click(
        within(screen.getByRole("group", { name: "盤面" })).getByText("15"),
      );

      expect(callbacks.onSlideTile).toHaveBeenCalledWith(15);
    });

    test("結果画面を出さないこと", () => {
      const resultHeading = screen.queryByRole("heading", {
        name: "プレイ結果",
      });

      expect(resultHeading).toBeNull();
    });

    test("戻るボタンで難易度変更を通知すること", () => {
      fireEvent.click(screen.getByRole("button", { name: "難易度選択へ戻る" }));

      expect(callbacks.onChangeDifficulty).toHaveBeenCalledOnce();
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

    test("検証情報を渡さなければメニューへ表示しないこと", () => {
      fireEvent.pointerDown(
        screen.getByRole("button", { name: "その他の操作" }),
        { button: 0, ctrlKey: false },
      );

      const diagnosticsItem = screen.queryByRole("menuitem", {
        name: "検証情報",
      });

      expect(diagnosticsItem).toBeNull();
    });

    const arrowKeyCases = [
      ["ArrowUp", "up"],
      ["ArrowDown", "down"],
      ["ArrowLeft", "left"],
      ["ArrowRight", "right"],
    ] as const;

    test.each(arrowKeyCases)(
      "%s キーで押した方向へのスライドを通知すること",
      (key, direction) => {
        fireEvent.keyDown(document.body, { key });

        expect(callbacks.onSlideByKeyboard).toHaveBeenCalledWith(direction);
      },
    );

    test("修飾キー付きの矢印キーは盤面へ流さないこと", () => {
      fireEvent.keyDown(document.body, { key: "ArrowLeft", altKey: true });

      expect(callbacks.onSlideByKeyboard).not.toHaveBeenCalled();
    });
  });

  describe("完成演出中の場合", () => {
    beforeEach(() => {
      renderPlay("clearing", solvedBoard);
    });

    test("タイルを操作できないこと", () => {
      const tiles = within(
        screen.getByRole("group", { name: "盤面" }),
      ).getAllByRole("button");

      expect(tiles.every((tile) => (tile as HTMLButtonElement).disabled)).toBe(
        true,
      );
    });

    test("矢印キーを盤面へ流さないこと", () => {
      fireEvent.keyDown(document.body, { key: "ArrowLeft" });

      expect(callbacks.onSlideByKeyboard).not.toHaveBeenCalled();
    });

    test("結果画面をまだ出さないこと", () => {
      const resultHeading = screen.queryByRole("heading", {
        name: "プレイ結果",
      });

      expect(resultHeading).toBeNull();
    });
  });

  describe("完成演出が終わった場合", () => {
    beforeEach(() => {
      renderPlay("result", solvedBoard);
    });

    test("スコアと手数・時間を基準との差つきで表示すること", () => {
      const score = screen.getByText("77");
      const moveCount = screen.getByText("42");
      const moveDelta = screen.getByText("最短 +12");
      const elapsedTime = screen.getByText("01:20");
      const timeDelta = screen.getByText("基準 +00:10");

      expect(score).toBeTruthy();
      expect(moveCount).toBeTruthy();
      expect(moveDelta).toBeTruthy();
      expect(elapsedTime).toBeTruthy();
      expect(timeDelta).toBeTruthy();
    });

    test("盤面を表示しないこと", () => {
      const board = screen.queryByRole("group", { name: "盤面" });

      expect(board).toBeNull();
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

    test("スコアの内訳と採点基準を開けること", () => {
      fireEvent.click(
        screen.getByRole("button", { name: "スコアの内訳・採点基準" }),
      );

      const efficiency = screen.getByText("43 / 60");
      const speed = screen.getByText("34 / 40");
      const speedCriteria = screen.getByText(
        /基準時間は10秒 \+ 最短30手 × 2秒/,
      );

      expect(efficiency).toBeTruthy();
      expect(speed).toBeTruthy();
      expect(speedCriteria).toBeTruthy();
    });
  });
});
