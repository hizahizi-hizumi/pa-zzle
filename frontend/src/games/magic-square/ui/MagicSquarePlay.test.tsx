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
import type { MagicSquareState } from "@/games/magic-square/puzzle/state";
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
const cells = parseMagicSquareBoard([
  "14 4 5 .",
  ". 2 . .",
  ". . 12 1",
  "3 . 10 6",
]);
/** 1行4列の空きマスに、メモ 9・11 を書いた盤面。 */
const board: MagicSquareState = {
  ...cells,
  memos: cells.cells.map((_, cellIndex) => (cellIndex === 3 ? [9, 11] : [])),
};

/** 基準時間 01:40（20秒 + 8 × 10秒）の問題を 02:00 で、置き直し2回で解いた結果。 */
const result: MagicSquareResult = {
  elapsedMs: 120_000,
  correctionCount: 2,
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
    onToggleMemoInput: vi.fn(),
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
        inputMode="value"
        valueStates={listMagicSquareValueStates(givens, board, 0)}
        correctionCount={2}
        operation={null}
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

    test("見出しに置き直しの回数と経過時間を出すこと", () => {
      const correctionMetric = screen.getByText("置き直し").parentElement!;
      const elapsedMetric = screen.getByText("時間").parentElement!;

      const values = [
        within(correctionMetric).queryByText("2"),
        within(elapsedMetric).queryByText("01:05"),
      ];

      expect(values.every((value) => value !== null)).toBe(true);
    });

    test("盤面のマスを押すとそのマスを選ぶ操作を知らせること", () => {
      fireEvent.click(
        screen.getByRole("button", { name: "1行4列 空き メモ 9 11" }),
      );

      expect(callbacks.onSelectCell).toHaveBeenCalledWith(3);
    });

    test("数の欄の数を押すとその数を入れる操作を知らせること", () => {
      fireEvent.click(
        within(
          screen.getByRole("group", { name: "盤面の下に並んだ数" }),
        ).getByText("11"),
      );

      expect(callbacks.onEnterValue).toHaveBeenCalledWith(11);
    });

    test("数の欄の最後の数の後ろの待ったで、待ったを知らせること", () => {
      fireEvent.click(
        within(
          screen.getByRole("group", { name: "盤面の下に並んだ数" }),
        ).getByRole("button", { name: "待った" }),
      );

      expect(callbacks.onUndo).toHaveBeenCalledTimes(1);
    });

    test("待ったの後ろのメモで、入れ方の切り替えを知らせること", () => {
      fireEvent.click(
        within(
          screen.getByRole("group", { name: "盤面の下に並んだ数" }),
        ).getByRole("button", { name: "メモ" }),
      );

      expect(callbacks.onToggleMemoInput).toHaveBeenCalledTimes(1);
    });
  });

  describe("完成演出の場合", () => {
    beforeEach(() => {
      renderPlay("clearing", result);
    });

    test("盤面のマスを押しても選ぶ操作を知らせないこと", () => {
      fireEvent.click(
        screen.getByRole("button", { name: "1行4列 空き メモ 9 11" }),
      );

      expect(callbacks.onSelectCell).not.toHaveBeenCalled();
    });
  });

  describe("結果の場合", () => {
    beforeEach(() => {
      renderPlay("result", result);
    });

    test("結果画面に難易度と置き直しの回数を出すこと", () => {
      const correctionMetric = screen.getByText("置き直し", {
        selector: "dt",
      }).parentElement!;

      const texts = [
        screen.queryByText("レベル 1"),
        within(correctionMetric).queryByText("2回"),
      ];

      expect(texts.every((text) => text !== null)).toBe(true);
    });

    test("採点内訳を開くと、置き直しの減点と数え方を書くこと", () => {
      fireEvent.click(screen.getByRole("button", { name: "採点内訳" }));
      const criteria = screen.getByText(/置き直し1回につき/);

      expect(criteria.textContent).toBe(
        "30点から、置き直し1回につき3点を減らす。置いた数は、外しても、置き換えても、「待った」・「盤面を戻す」で外れても1回と数える。列の端の色を変えなかった数は、ほかのマスを選ぶ前なら、外しても置き換えても数えない。隣の数を押し間違えて、すぐ置き換えたときも数えない。「待った」・「盤面を戻す」は、押しただけでは減らさない。",
      );
    });
  });
});
