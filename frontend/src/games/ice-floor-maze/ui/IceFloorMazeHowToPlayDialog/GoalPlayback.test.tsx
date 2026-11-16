import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import { goalFigure } from "@/games/ice-floor-maze/ui/IceFloorMazeHowToPlayDialog/figure-boards";
import {
  _private,
  GoalPlayback,
} from "@/games/ice-floor-maze/ui/IceFloorMazeHowToPlayDialog/GoalPlayback";
import { playSound } from "@/lib/audio/sound-effects";
import { prefersReducedMotion } from "@/lib/motion";

vi.mock("@/lib/motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/motion")>()),
  prefersReducedMotion: vi.fn(() => false),
}));

vi.mock("@/lib/audio/sound-effects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/audio/sound-effects")>()),
  playSound: vi.fn(),
}));

const { GOAL_START_HOLD_MS, slideStartsMs, playback } = _private;

const lastSlideAt = slideStartsMs.at(-1)!;

function finishNothing(): void {}

/** 完成演出の動き。終わらせる関数を残す。 */
let finishAnimations: () => void = finishNothing;
const animate = vi.fn(function createPendingAnimation(): Animation {
  let resolve: () => void = finishNothing;
  const finished = new Promise<void>(function keepResolve(done) {
    resolve = done;
  });
  const previous = finishAnimations;
  finishAnimations = function finishAll() {
    previous();
    resolve();
  };
  return {
    finished,
    cancel: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as Animation;
});

beforeEach(() => {
  vi.useFakeTimers();
  animate.mockClear();
  finishAnimations = finishNothing;
  Element.prototype.animate = animate as unknown as Element["animate"];
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.mocked(prefersReducedMotion).mockReturnValue(false);
  vi.mocked(playSound).mockClear();
  Reflect.deleteProperty(Element.prototype, "animate");
});

function getGoal(): HTMLElement {
  return screen.getByRole("img", { name: "ゴールの盤面" });
}

function getPieceCell(): number {
  return Number(
    getGoal()
      .querySelector("[data-piece-cell]")
      ?.getAttribute("data-piece-cell"),
  );
}

function getReplayButton(): HTMLButtonElement {
  return screen.getByRole<HTMLButtonElement>("button", {
    name: "始まりの盤面から見せ直す",
  });
}

function isReplayable(): boolean {
  return !getReplayButton().disabled;
}

function skip(): void {
  fireEvent.click(screen.getByLabelText("ゴールで止まった姿まで飛ばす"));
}

describe("GoalPlayback", () => {
  describe("開いた場合", () => {
    beforeEach(() => {
      render(<GoalPlayback />);
    });

    test("始まりの盤面から、本番の滑りと同じ止まる所へ1手ずつ滑らせること", () => {
      const positions = [getPieceCell()];
      let elapsedMs = 0;
      for (const startMs of slideStartsMs) {
        act(() => {
          vi.advanceTimersByTime(startMs - elapsedMs);
        });
        elapsedMs = startMs;
        positions.push(getPieceCell());
      }

      expect(positions).toEqual(
        playback.states.map(({ position }) => position),
      );
      expect(positions.at(-1)).toBe(goalFigure.goal);
    });

    test("ゴールで止まったら本番の完成演出を返し、終わってから見せ直すボタンを出し、音を鳴らさないこと", async () => {
      act(() => {
        vi.advanceTimersByTime(lastSlideAt);
      });
      const replayableDuringClear = isReplayable();

      await act(async () => {
        finishAnimations();
        await vi.runAllTimersAsync();
      });

      expect(replayableDuringClear).toBe(false);
      expect(animate).toHaveBeenCalled();
      expect(isReplayable()).toBe(true);
      expect(playSound).not.toHaveBeenCalled();
    });

    test("途中で盤面を押すと、ゴールで止まった姿へ飛ばすこと", () => {
      act(() => {
        vi.advanceTimersByTime(GOAL_START_HOLD_MS);
      });

      skip();

      expect(getPieceCell()).toBe(goalFigure.goal);
      expect(isReplayable()).toBe(true);
    });

    test("見せ直すボタンを押すと、始まりの盤面から見せ直すこと", () => {
      skip();

      fireEvent.click(getReplayButton());

      expect(getPieceCell()).toBe(goalFigure.start);
    });
  });

  describe("動きを減らす設定の場合", () => {
    beforeEach(() => {
      vi.mocked(prefersReducedMotion).mockReturnValue(true);
      render(<GoalPlayback />);
    });

    test("始まりの盤面を見せてから、ゴールで止まった盤面を動かさずに見せること", () => {
      const before = getPieceCell();

      act(() => {
        vi.advanceTimersByTime(GOAL_START_HOLD_MS);
      });

      expect(before).toBe(goalFigure.start);
      expect(getPieceCell()).toBe(goalFigure.goal);
      expect(animate).not.toHaveBeenCalled();
      expect(isReplayable()).toBe(true);
    });
  });
});
