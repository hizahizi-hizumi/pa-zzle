import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import {
  createMinesweeperExampleBoard,
  listMinesweeperExampleSolveSteps,
} from "@/games/minesweeper/ui/MinesweeperHowToPlayDialog/example-board";
import { goalFigure } from "@/games/minesweeper/ui/MinesweeperHowToPlayDialog/figure-boards";
import {
  _private,
  GoalPlayback,
} from "@/games/minesweeper/ui/MinesweeperHowToPlayDialog/GoalPlayback";
import { prefersReducedMotion } from "@/lib/motion";

vi.mock("@/lib/motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/motion")>()),
  prefersReducedMotion: vi.fn(() => false),
}));

const { GOAL_START_HOLD_MS, GOAL_OPEN_INTERVAL_MS } = _private;

const start = createMinesweeperExampleBoard(goalFigure);
const steps = listMinesweeperExampleSolveSteps(start);
const initialRevealedCount = start.puzzle.revealedCellIndices.length;
const safeCellCount = 81 - start.board.mineCellIndices.length;
const mineCount = start.board.mineCellIndices.length;

/** ゴールの盤面の絵の中の、マスの見え方ごとの数。 */
function countCells(state: string): number {
  return screen
    .getByRole("img", { name: "ゴールの盤面" })
    .querySelectorAll(`[data-cell-state="${state}"]`).length;
}

function getReplayButton(): HTMLButtonElement {
  return screen.getByRole<HTMLButtonElement>("button", {
    name: "始まりの盤面から見せ直す",
  });
}

/** 開いている途中とクリア演出の途中にだけ盤面に重ねる、最後の姿まで飛ばす所。読み上げには出さないので、名前で探す。 */
function querySkipTarget(): HTMLElement | null {
  return screen.queryByLabelText("開き終えた姿まで飛ばす");
}

function getSkipTarget(): HTMLElement {
  return screen.getByLabelText("開き終えた姿まで飛ばす");
}

function advance(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/** クリア演出の動き。既定では終わらないまま、止められたことだけを記録する。 */
const cancel = vi.fn();
function createUnfinishedAnimation(): Animation {
  return { finished: new Promise(() => {}), cancel } as unknown as Animation;
}
const animate = vi.fn(createUnfinishedAnimation);

beforeEach(() => {
  cancel.mockClear();
  animate.mockReset();
  animate.mockImplementation(createUnfinishedAnimation);
  Element.prototype.animate = animate as unknown as Element["animate"];
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  Reflect.deleteProperty(Element.prototype, "animate");
});

describe("GoalPlayback", () => {
  describe("動きを減らす設定でない場合", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.mocked(prefersReducedMotion).mockReturnValue(false);
      render(<GoalPlayback />);
    });

    test("最初から開いているマスだけの始まりの盤面を見せ、見せ直すボタンを出さないこと", () => {
      const revealed = countCells("revealed");

      expect(revealed).toBe(initialRevealedCount);
      expect(countCells("mine")).toBe(0);
      expect(getReplayButton().disabled).toBe(true);
    });

    test("1つ開くごとに、本番の関数で開いた姿へ進むこと", () => {
      advance(GOAL_START_HOLD_MS + GOAL_OPEN_INTERVAL_MS);

      expect(countCells("revealed")).toBe(
        steps[0]?.puzzle.revealedCellIndices.length,
      );
    });

    test("すべて開くと、閉じていた地雷を見せ、本番のクリア演出を1回だけ返してから見せ直すボタンを出すこと", () => {
      advance(GOAL_START_HOLD_MS + (steps.length + 2) * GOAL_OPEN_INTERVAL_MS);

      expect(countCells("revealed")).toBe(safeCellCount);
      expect(countCells("mine")).toBe(mineCount);
      expect(animate).toHaveBeenCalledTimes(safeCellCount);
      expect(getReplayButton().disabled).toBe(false);
    });

    describe("開いている途中の場合", () => {
      beforeEach(() => {
        advance(GOAL_START_HOLD_MS + GOAL_OPEN_INTERVAL_MS);
      });

      test("盤面を押すと、残りを飛ばして開き終えた姿を見せ、クリア演出を返さないこと", () => {
        fireEvent.click(getSkipTarget());
        advance(
          GOAL_START_HOLD_MS + (steps.length + 2) * GOAL_OPEN_INTERVAL_MS,
        );

        expect(countCells("revealed")).toBe(safeCellCount);
        expect(animate).not.toHaveBeenCalled();
        expect(querySkipTarget()).toBeNull();
      });
    });

    describe("開き終えた姿まで飛ばした場合", () => {
      beforeEach(() => {
        fireEvent.click(getSkipTarget());
      });

      test("見せ直すと、始まりの盤面から開き直すこと", () => {
        fireEvent.click(getReplayButton());

        expect(countCells("revealed")).toBe(initialRevealedCount);
        expect(querySkipTarget()).not.toBeNull();
      });
    });
  });

  describe("動きを減らす設定の場合", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.mocked(prefersReducedMotion).mockReturnValue(true);
      render(<GoalPlayback />);
    });

    test("始まりの盤面を見せてから、開き終えた姿を動かさずに見せること", () => {
      advance(GOAL_START_HOLD_MS);

      expect(countCells("revealed")).toBe(safeCellCount);
      expect(animate).not.toHaveBeenCalled();
      expect(getReplayButton().disabled).toBe(false);
    });
  });
});
