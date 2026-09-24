import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import type { FifteenPuzzleProgress } from "@/games/fifteen-puzzle/play/use-fifteen-puzzle-play";
import { FifteenPuzzlePlay } from "@/games/fifteen-puzzle/ui/FifteenPuzzlePlay";

const playingBoard = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 0, 13, 14, 15];
const solvedBoard = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0];

afterEach(() => {
  cleanup();
});

describe("FifteenPuzzlePlay", () => {
  const callbacks = {
    onSlideTile: vi.fn(),
    onSlideByKeyboard: vi.fn(),
    onRestart: vi.fn(),
    onReplay: vi.fn(),
    onStartNewProblem: vi.fn(),
    onClearingComplete: vi.fn(),
    onChangeDifficulty: vi.fn(),
    onBackToHome: vi.fn(),
  };

  function renderPlay(
    progress: FifteenPuzzleProgress,
    board: readonly number[],
  ) {
    render(
      <FifteenPuzzlePlay
        progress={progress}
        board={board}
        elapsedMs={65_000}
        moveCount={7}
        operation={null}
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
      const heading = screen.getByRole("heading", { name: "15パズル" });
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

    test("完成の表示を出さないこと", () => {
      const result = screen.queryByRole("status");

      expect(result).toBeNull();
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

    test("完成の表示をまだ出さないこと", () => {
      const result = screen.queryByRole("status");

      expect(result).toBeNull();
    });
  });

  describe("完成演出が終わった場合", () => {
    beforeEach(() => {
      renderPlay("result", solvedBoard);
    });

    test("完成を知らせること", () => {
      const result = screen.getByRole("status");

      expect(result.textContent).toContain("完成！");
    });

    const actionCases = [
      ["同じ問題をもう一度", "onReplay"],
      ["別の問題", "onStartNewProblem"],
    ] as const;

    test.each(actionCases)(
      "%s ボタンで対応する操作を通知すること",
      (buttonName, callbackName) => {
        fireEvent.click(
          within(screen.getByRole("status")).getByRole("button", {
            name: buttonName,
          }),
        );

        expect(callbacks[callbackName]).toHaveBeenCalledOnce();
      },
    );
  });
});
