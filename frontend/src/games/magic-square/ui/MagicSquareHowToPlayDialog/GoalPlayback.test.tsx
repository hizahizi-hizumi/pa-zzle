import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import { listMagicSquareLineEvaluations } from "@/games/magic-square/puzzle/rules";
import { goalBoard } from "@/games/magic-square/ui/MagicSquareHowToPlayDialog/figure-boards";
import {
  _private,
  GoalPlayback,
} from "@/games/magic-square/ui/MagicSquareHowToPlayDialog/GoalPlayback";
import { prefersReducedMotion } from "@/lib/motion";

vi.mock("@/lib/motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/motion")>()),
  prefersReducedMotion: vi.fn(() => false),
}));

const { GOAL_START_HOLD_MS, GOAL_PLACE_INTERVAL_MS, GOAL_CLEAR_DELAY_MS } =
  _private;

/** クリア演出の動きが終わってから完了するまでの間より長い時間。 */
const CLEAR_ANIMATION_HOLD_MS = 2000;

const givenCount = goalBoard.givens.cells.filter(
  (cell) => cell !== null,
).length;
const placedCount = goalBoard.givens.cells.length - givenCount;
const fillMs = GOAL_START_HOLD_MS + (placedCount - 1) * GOAL_PLACE_INTERVAL_MS;

function getGoalBoard(): HTMLElement {
  return screen.getByRole("img", { name: "ゴールの盤面" });
}

/** ゴールの盤面に描かれている、最初から置いてある数と置いた数の数。 */
function countDrawnValues(): { given: number; placed: number } {
  const cells = [...getGoalBoard().querySelectorAll("button[aria-label]")];
  const filled = cells.filter(
    (cell) => !cell.getAttribute("aria-label")?.includes("空き"),
  );
  const given = filled.filter((cell) => cell.hasAttribute("data-given")).length;
  return { given, placed: filled.length - given };
}

/** ゴールの盤面の列の端の合計の読み上げ。 */
function readLineSums(): string[] {
  return [...getGoalBoard().querySelectorAll(".sr-only")]
    .map((label) => label.textContent ?? "")
    .filter((text) => text.includes("の合計"));
}

function getReplayButton(): HTMLButtonElement {
  return screen.getByRole<HTMLButtonElement>("button", {
    name: "始まりの盤面から見せ直す",
  });
}

/** 埋めている途中とクリア演出の途中にだけ盤面に重ねる、最後の姿まで飛ばす所。読み上げには出さないので、名前で探す。 */
function querySkipTarget(): HTMLElement | null {
  return screen.queryByLabelText("埋め終えた姿まで飛ばす");
}

function advance(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

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

    test("始まりの盤面の最初から置いてある数だけを見せ、見せ直すボタンを押せなくすること", () => {
      const drawn = countDrawnValues();

      expect(drawn).toEqual({ given: givenCount, placed: 0 });
      expect(getReplayButton().disabled).toBe(true);
    });

    test("始まりの盤面を見せた後、数を1つずつ置いていき、列の端の合計を本番と同じく出し直すこと", () => {
      advance(GOAL_START_HOLD_MS);
      const sumsAfterFirst = readLineSums();

      expect(countDrawnValues().placed).toBe(1);
      expect(sumsAfterFirst).toContain("2行目の合計 34 そろった");
    });

    test("埋まり切ると、どの列もそろったゴールの盤面を見せ、見せ直すボタンを出し、少し置いてクリア演出を始めること", () => {
      advance(fillMs);
      const startedBeforeDelay = animate.mock.calls.length;

      advance(GOAL_CLEAR_DELAY_MS);

      expect(countDrawnValues()).toEqual({
        given: givenCount,
        placed: placedCount,
      });
      expect(readLineSums()).toHaveLength(
        listMagicSquareLineEvaluations(goalBoard.answer).length,
      );
      expect(readLineSums().every((label) => label.endsWith("そろった"))).toBe(
        true,
      );
      expect(getReplayButton().disabled).toBe(false);
      expect(startedBeforeDelay).toBe(0);
      expect(animate).toHaveBeenCalled();
    });

    describe("クリア演出を見終えた場合", () => {
      beforeEach(async () => {
        animate.mockImplementation(
          () =>
            ({ finished: Promise.resolve(), cancel }) as unknown as Animation,
        );
        advance(fillMs + GOAL_CLEAR_DELAY_MS);
        await act(async () => {});
        advance(CLEAR_ANIMATION_HOLD_MS);
      });

      test("埋め終えた姿のまま、盤面を押す所を消し、見せ直すボタンだけを残すこと", () => {
        expect(querySkipTarget()).toBeNull();
        expect(countDrawnValues().placed).toBe(placedCount);
        expect(getReplayButton().disabled).toBe(false);
      });
    });

    describe("置いている途中に盤面を押した場合", () => {
      beforeEach(() => {
        advance(GOAL_START_HOLD_MS + GOAL_PLACE_INTERVAL_MS);
        fireEvent.click(querySkipTarget() as HTMLElement);
      });

      test("すぐ埋め終えた姿にし、見せ直すボタンを出し、盤面を押す所を消すこと", () => {
        expect(countDrawnValues().placed).toBe(placedCount);
        expect(getReplayButton().disabled).toBe(false);
        expect(querySkipTarget()).toBeNull();
      });

      test("その後、クリア演出を再生しないこと", () => {
        advance(fillMs + GOAL_CLEAR_DELAY_MS);

        expect(animate).not.toHaveBeenCalled();
      });
    });

    describe("クリア演出の途中の場合", () => {
      beforeEach(() => {
        advance(fillMs + GOAL_CLEAR_DELAY_MS);
      });

      test("盤面を押すと、クリア演出を止め、盤面を押す所を消すこと", () => {
        fireEvent.click(querySkipTarget() as HTMLElement);

        expect(cancel).toHaveBeenCalled();
        expect(querySkipTarget()).toBeNull();
      });

      test("見せ直すと、始まりの盤面に戻り、盤面を押して飛ばせるようになること", () => {
        fireEvent.click(getReplayButton());

        expect(countDrawnValues().placed).toBe(0);
        expect(getReplayButton().disabled).toBe(true);
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

    test("始まりの盤面を短く見せてから、1つずつ置かずにゴールの盤面を一度に見せ、クリア演出を返さないこと", () => {
      advance(GOAL_START_HOLD_MS - 1);
      const beforeHold = countDrawnValues().placed;

      advance(1);

      expect(beforeHold).toBe(0);
      expect(countDrawnValues().placed).toBe(placedCount);
      expect(animate).not.toHaveBeenCalled();
    });
  });
});
