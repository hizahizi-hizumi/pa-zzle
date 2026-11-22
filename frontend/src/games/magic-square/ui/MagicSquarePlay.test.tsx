import {
  cleanup,
  fireEvent,
  render as renderWithoutRouter,
  screen,
  within,
} from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router";

import type { MagicSquareResult } from "@/games/magic-square/play/use-magic-square-play";
import { parseMagicSquareBoard } from "@/games/magic-square/puzzle/board";
import {
  listMagicSquareLineEvaluations,
  listMagicSquareValueStates,
} from "@/games/magic-square/puzzle/rules";
import { MagicSquarePlay } from "@/games/magic-square/ui/MagicSquarePlay";
import type { GameProgress } from "@/games/play";

/** 結果画面はブランドの帯からホームへ戻るリンクを持つので、ルーターの中で描く。 */
function render(ui: ReactElement) {
  return renderWithoutRouter(ui, { wrapper: MemoryRouter });
}

const givens = parseMagicSquareBoard([
  ". 4 5 .",
  ". 2 . .",
  ". . 12 1",
  "3 . 10 6",
]);
const board = parseMagicSquareBoard([
  "14 4 5 .",
  ". 2 . .",
  ". . 12 1",
  "3 . 10 6",
]);

/** 基準時間 01:40（20秒 + 8 × 10秒）の問題を 02:00 で、取り下げ2回で解いた結果。 */
const result: MagicSquareResult = {
  elapsedMs: 120_000,
  withdrawalCount: 2,
  undoCount: 1,
  restartCount: 0,
  workload: { emptyCellCount: 8 },
  speedRule: { fullScoreMs: 100_000, zeroScoreMs: 200_000 },
  timeDeltaMs: 20_000,
  score: { total: 80, breakdown: { speed: 56, accuracy: 24 } },
};

afterEach(cleanup);

describe("MagicSquarePlay", () => {
  const callbacks = {
    onSelectCell: vi.fn(),
    onEnterValue: vi.fn(),
    onUndo: vi.fn(),
    onRestart: vi.fn(),
    onReplay: vi.fn(),
    onClearAnimationComplete: vi.fn(),
    renderSettingsDialog: () => null,
    onStartNewProblem: vi.fn(),
    onOpenGameHome: vi.fn(),
    onBackToAppHome: vi.fn(),
  };

  function renderPlay(
    progress: GameProgress,
    playResult: MagicSquareResult | null = null,
  ) {
    render(
      <MagicSquarePlay
        difficulty="1"
        progress={progress}
        elapsedMs={65_000}
        result={playResult}
        recordFeedback={{ kind: "first-record" }}
        givens={givens}
        board={board}
        selectedCellIndex={0}
        lineEvaluations={listMagicSquareLineEvaluations(board)}
        valueStates={listMagicSquareValueStates(givens, board, 0)}
        withdrawalCount={2}
        canUndo
        canRestart
        {...callbacks}
      />,
    );
  }

  beforeEach(() => {
    for (const callback of Object.values(callbacks)) {
      if (vi.isMockFunction(callback)) {
        callback.mockClear();
      }
    }
  });

  describe("プレイ中の場合", () => {
    beforeEach(() => {
      renderPlay("playing");
    });

    test("見出しに取り下げの回数と経過時間を出すこと", () => {
      const texts = [screen.getByText("取り下げ"), screen.getByText("01:05")];

      expect(texts.every(Boolean)).toBe(true);
    });

    test("盤面のマスを押すとそのマスを選ぶ操作を知らせること", () => {
      fireEvent.click(screen.getByRole("button", { name: "1行4列 空き" }));

      expect(callbacks.onSelectCell).toHaveBeenCalledWith(3);
    });

    test("数の欄の数を押すとその数を入れる操作を知らせること", () => {
      fireEvent.click(
        within(screen.getByRole("group", { name: "数の欄" })).getByText("11"),
      );

      expect(callbacks.onEnterValue).toHaveBeenCalledWith(11);
    });

    test("数の欄の最後の数の後ろの待ったで、待ったを知らせること", () => {
      fireEvent.click(
        within(screen.getByRole("group", { name: "数の欄" })).getByRole(
          "button",
          { name: "待った" },
        ),
      );

      expect(callbacks.onUndo).toHaveBeenCalledTimes(1);
    });
  });

  describe("完成演出の場合", () => {
    beforeEach(() => {
      renderPlay("clearing", result);
    });

    test("盤面のマスを押しても選ぶ操作を知らせないこと", () => {
      fireEvent.click(screen.getByRole("button", { name: "1行4列 空き" }));

      expect(callbacks.onSelectCell).not.toHaveBeenCalled();
    });
  });

  describe("結果の場合", () => {
    beforeEach(() => {
      renderPlay("result", result);
    });

    test("結果画面に難易度と取り下げの回数を出すこと", () => {
      const texts = [screen.getByText("レベル 1"), screen.getByText("2回")];

      expect(texts.every(Boolean)).toBe(true);
    });
  });
});
