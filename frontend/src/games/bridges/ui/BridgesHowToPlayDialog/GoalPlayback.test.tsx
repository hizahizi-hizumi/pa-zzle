import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import { goalFigure } from "@/games/bridges/ui/BridgesHowToPlayDialog/figure-boards";
import {
  _private,
  GoalPlayback,
} from "@/games/bridges/ui/BridgesHowToPlayDialog/GoalPlayback";
import { bridgesFigureParts } from "@/games/bridges/ui/board/BridgesFigure";
import { playLayeredSound, playSound } from "@/lib/audio/sound-effects";
import { prefersReducedMotion } from "@/lib/motion";

vi.mock("@/lib/motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/motion")>()),
  prefersReducedMotion: vi.fn(() => false),
}));

vi.mock("@/lib/audio/sound-effects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/audio/sound-effects")>()),
  playSound: vi.fn(),
  playLayeredSound: vi.fn(),
}));

const { GOAL_START_HOLD_MS, GOAL_PLANK_INTERVAL_MS, planks } = _private;

/** 板を全部架け終える時刻。 */
const filledAt =
  GOAL_START_HOLD_MS + (planks.length - 1) * GOAL_PLANK_INTERVAL_MS;

/** クリア演出を始める時刻。 */
const celebrateAt = GOAL_START_HOLD_MS + planks.length * GOAL_PLANK_INTERVAL_MS;

/** 解の板の枚数。 */
const solutionPlankCount = goalFigure.steps.reduce(
  (total, { count }) => total + count,
  0,
);

/** 動き。動かした要素を記録し、終わらせる関数を残す。 */
let finishAnimations: () => void = () => {};
const animate = vi.fn(function createPendingAnimation(): Animation {
  let resolve: () => void = () => {};
  const finished = new Promise<void>((done) => {
    resolve = done;
  });
  const previous = finishAnimations;
  finishAnimations = () => {
    previous();
    resolve();
  };
  return { finished, cancel: vi.fn() } as unknown as Animation;
});

beforeEach(() => {
  vi.useFakeTimers();
  animate.mockClear();
  finishAnimations = () => {};
  Element.prototype.animate = animate as unknown as Element["animate"];
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.mocked(prefersReducedMotion).mockReturnValue(false);
  vi.mocked(playSound).mockClear();
  vi.mocked(playLayeredSound).mockClear();
  Reflect.deleteProperty(Element.prototype, "animate");
});

function getGoal(): HTMLElement {
  return screen.getByRole("img", { name: "ゴールの盤面" });
}

/** ゴールの盤面に描いた板の枚数。 */
function countPlanks(): number {
  return getGoal().querySelectorAll(
    `[${bridgesFigureParts.bridgeEdge}] [${bridgesFigureParts.bridgePlank}]`,
  ).length;
}

function hasLitDeck(): boolean {
  return getGoal().querySelector(`[${bridgesFigureParts.litDeck}]`) !== null;
}

function getReplayButton(): HTMLButtonElement {
  return screen.getByRole<HTMLButtonElement>("button", {
    name: "始まりの盤面から見せ直す",
  });
}

function querySkipTarget(): HTMLElement | null {
  return screen.queryByLabelText("架け終えた姿まで飛ばす");
}

function advance(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/** 動いた要素の印（data-*）。 */
function listAnimatedParts(): string[] {
  return animate.mock.contexts.flatMap((element) =>
    Array.from((element as Element).attributes)
      .map(({ name }) => name)
      .filter((name) => name.startsWith("data-")),
  );
}

async function finishClearAnimation(): Promise<void> {
  await act(async () => {
    finishAnimations();
    await Promise.resolve();
  });
  await act(async () => {
    await vi.runOnlyPendingTimersAsync();
  });
}

describe("GoalPlayback", () => {
  describe("動きを減らさない場合", () => {
    beforeEach(() => {
      render(<GoalPlayback />);
    });

    test("開いた直後は、橋の無い盤面を見せ、見せ直すボタンを出さないこと", () => {
      const plankCount = countPlanks();

      expect(plankCount).toBe(0);
      expect(getReplayButton().disabled).toBe(true);
    });

    test("始まりを見せた後、板を1枚ずつ本番の板の動きで架けていくこと", () => {
      advance(GOAL_START_HOLD_MS + GOAL_PLANK_INTERVAL_MS);

      expect(countPlanks()).toBe(2);
      expect(listAnimatedParts()).toContain(bridgesFigureParts.bridgePlank);
    });

    test("架け終えたら、本番のクリア演出で光った板を見せ、音を鳴らさないこと", () => {
      advance(celebrateAt);

      expect(countPlanks()).toBe(solutionPlankCount);
      expect(hasLitDeck()).toBe(true);
      expect(listAnimatedParts()).toContain(bridgesFigureParts.litDeck);
      expect(playSound).not.toHaveBeenCalled();
      expect(playLayeredSound).not.toHaveBeenCalled();
    });

    test("架け終える前は、光った板を見せないこと", () => {
      advance(filledAt);

      expect(countPlanks()).toBe(solutionPlankCount);
      expect(hasLitDeck()).toBe(false);
    });

    test("クリア演出を終えたら、見せ直すボタンを出して飛ばす面を外すこと", async () => {
      advance(celebrateAt);
      await finishClearAnimation();

      expect(getReplayButton().disabled).toBe(false);
      expect(querySkipTarget()).toBeNull();
    });

    describe("始まりを見せた後の場合", () => {
      beforeEach(() => {
        advance(GOAL_START_HOLD_MS);
      });

      test("盤面を押すと、残りを飛ばして架け終えた光った姿を見せること", () => {
        fireEvent.click(querySkipTarget()!);

        expect(countPlanks()).toBe(solutionPlankCount);
        expect(hasLitDeck()).toBe(true);
        expect(getReplayButton().disabled).toBe(false);
      });
    });

    describe("飛ばして架け終えた後の場合", () => {
      beforeEach(() => {
        fireEvent.click(querySkipTarget()!);
      });

      test("見せ直すと、橋の無い盤面から架け直すこと", () => {
        fireEvent.click(getReplayButton());
        const plankCount = countPlanks();
        advance(GOAL_START_HOLD_MS);

        expect(plankCount).toBe(0);
        expect(countPlanks()).toBe(1);
      });
    });
  });

  describe("動きを減らす場合", () => {
    beforeEach(() => {
      vi.mocked(prefersReducedMotion).mockReturnValue(true);
      render(<GoalPlayback />);
    });

    test("始まりを見せた後、架け終えた光った盤面を動かさずに見せること", () => {
      advance(GOAL_START_HOLD_MS);

      expect(countPlanks()).toBe(solutionPlankCount);
      expect(hasLitDeck()).toBe(true);
      expect(animate).not.toHaveBeenCalled();
      expect(getReplayButton().disabled).toBe(false);
    });
  });
});
