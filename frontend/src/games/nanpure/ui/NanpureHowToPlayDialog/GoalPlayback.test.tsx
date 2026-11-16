import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import { createNanpureExampleSession } from "@/games/nanpure/ui/NanpureHowToPlayDialog/example-board";
import { goalBoard } from "@/games/nanpure/ui/NanpureHowToPlayDialog/figure-boards";
import {
  _private,
  GoalPlayback,
} from "@/games/nanpure/ui/NanpureHowToPlayDialog/GoalPlayback";
import { prefersReducedMotion } from "@/lib/motion";

vi.mock("@/lib/motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/motion")>()),
  prefersReducedMotion: vi.fn(() => false),
}));

const { GOAL_START_HOLD_MS, GOAL_ENTER_INTERVAL_MS, GOAL_CLEAR_DELAY_MS } =
  _private;

/** クリア演出の動きが終わってから完了するまでの間より長い時間。 */
const CLEAR_ANIMATION_HOLD_MS = 1000;

const { clues } = createNanpureExampleSession(goalBoard).problem;
const clueCount = clues.filter((cell) => cell !== null).length;
const enteredCount = clues.length - clueCount;
const fillMs = GOAL_START_HOLD_MS + enteredCount * GOAL_ENTER_INTERVAL_MS;

/** ゴールの盤面に描かれている、最初からある数字と入れた数字の数。 */
function countDrawnDigits(): { clue: number; entered: number } {
  const board = screen.getByRole("img", { name: "ゴールの盤面" });
  return {
    clue: board.querySelectorAll('[data-nanpure-digit="clue"]').length,
    entered: board.querySelectorAll('[data-nanpure-digit="entered"]').length,
  };
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

    test("始まりの盤面の最初からある数字だけを見せ、見せ直すボタンを押せなくすること", () => {
      const drawn = countDrawnDigits();

      expect(drawn).toEqual({ clue: clueCount, entered: 0 });
      expect(getReplayButton().disabled).toBe(true);
    });

    test("始まりの盤面を見せた後、数字を1つずつ入れていくこと", () => {
      advance(GOAL_START_HOLD_MS + GOAL_ENTER_INTERVAL_MS);

      expect(countDrawnDigits().entered).toBe(1);
    });

    test("埋まり切ると、ゴールの盤面を見せ、見せ直すボタンを出し、少し置いてクリア演出を始めること", () => {
      advance(fillMs);
      const startedBeforeDelay = animate.mock.calls.length;

      advance(GOAL_CLEAR_DELAY_MS);

      expect(countDrawnDigits()).toEqual({
        clue: clueCount,
        entered: enteredCount,
      });
      expect(getReplayButton().disabled).toBe(false);
      expect(startedBeforeDelay).toBe(0);
      expect(animate).toHaveBeenCalledOnce();
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
        const skipTarget = querySkipTarget();

        expect(skipTarget).toBeNull();
        expect(countDrawnDigits().entered).toBe(enteredCount);
        expect(getReplayButton().disabled).toBe(false);
      });
    });

    describe("埋めている途中に盤面を押した場合", () => {
      beforeEach(() => {
        advance(GOAL_START_HOLD_MS + GOAL_ENTER_INTERVAL_MS);
        fireEvent.click(querySkipTarget() as HTMLElement);
      });

      test("すぐ埋め終えた姿にし、見せ直すボタンを出し、盤面を押す所を消すこと", () => {
        const drawn = countDrawnDigits();

        expect(drawn.entered).toBe(enteredCount);
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

        expect(cancel).toHaveBeenCalledOnce();
        expect(querySkipTarget()).toBeNull();
      });

      test("見せ直すと、始まりの盤面に戻り、盤面を押して飛ばせるようになること", () => {
        fireEvent.click(getReplayButton());

        expect(countDrawnDigits().entered).toBe(0);
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

    test("始まりの盤面を短く見せてから、1つずつ入れずにゴールの盤面を一度に見せること", () => {
      advance(GOAL_START_HOLD_MS - 1);
      const beforeHold = countDrawnDigits().entered;

      advance(1);

      expect(beforeHold).toBe(0);
      expect(countDrawnDigits().entered).toBe(enteredCount);
    });
  });
});
