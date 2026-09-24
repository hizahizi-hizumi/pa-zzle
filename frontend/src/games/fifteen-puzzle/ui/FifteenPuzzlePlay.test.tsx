import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import { FifteenPuzzlePlay } from "@/games/fifteen-puzzle/ui/FifteenPuzzlePlay";

const playingBoard = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 0, 13, 14, 15];
const solvedBoard = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0];

afterEach(() => {
  cleanup();
});

describe("FifteenPuzzlePlay", () => {
  const callbacks = {
    onSlideTile: vi.fn(),
    onReplay: vi.fn(),
    onStartNewProblem: vi.fn(),
    onBackToHome: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("プレイ中の場合", () => {
    beforeEach(() => {
      render(
        <FifteenPuzzlePlay
          status="playing"
          progress="playing"
          board={playingBoard}
          moveCount={7}
          {...callbacks}
        />,
      );
    });

    test("ゲーム名と手数を表示すること", () => {
      const heading = screen.getByRole("heading", { name: "15パズル" });
      const moveCount = screen.getByText("手数").parentElement;

      expect(heading).toBeTruthy();
      expect(moveCount?.textContent).toBe("手数7");
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
  });

  describe("完成した場合", () => {
    beforeEach(() => {
      render(
        <FifteenPuzzlePlay
          status="cleared"
          progress="clearing"
          board={solvedBoard}
          moveCount={3}
          {...callbacks}
        />,
      );
    });

    test("完成を知らせること", () => {
      const result = screen.getByRole("status");

      expect(result.textContent).toContain("完成！");
    });

    test("タイルを操作できないこと", () => {
      const tiles = within(
        screen.getByRole("group", { name: "盤面" }),
      ).getAllByRole("button");

      expect(tiles.every((tile) => (tile as HTMLButtonElement).disabled)).toBe(
        true,
      );
    });

    const actionCases = [
      ["同じ問題をもう一度", "onReplay"],
      ["別の問題", "onStartNewProblem"],
    ] as const;

    test.each(actionCases)(
      "%s ボタンで対応する操作を通知すること",
      (buttonName, callbackName) => {
        fireEvent.click(screen.getByRole("button", { name: buttonName }));

        expect(callbacks[callbackName]).toHaveBeenCalledOnce();
      },
    );
  });
});
