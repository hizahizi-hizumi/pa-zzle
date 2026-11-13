import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import { hitofudePuzzleFigureParts } from "@/games/hitofude-puzzle/ui/board/HitofudePuzzleFigure";
import { goalFigure } from "@/games/hitofude-puzzle/ui/HitofudePuzzleHowToPlayDialog/figure-boards";
import {
  _private,
  GoalPlayback,
} from "@/games/hitofude-puzzle/ui/HitofudePuzzleHowToPlayDialog/GoalPlayback";
import { prefersReducedMotion } from "@/lib/motion";
import { playLayeredSound, playSound } from "@/lib/sound-effects";

vi.mock("@/lib/motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/motion")>()),
  prefersReducedMotion: vi.fn(() => false),
}));

vi.mock("@/lib/sound-effects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/sound-effects")>()),
  playSound: vi.fn(),
  playLayeredSound: vi.fn(),
}));

const { GOAL_START_HOLD_MS, GOAL_EXTEND_INTERVAL_MS } = _private;

/** 道をすべてのマスまで延ばし終える時刻。 */
const filledAt =
  GOAL_START_HOLD_MS +
  (goalFigure.solution.length - 1) * GOAL_EXTEND_INTERVAL_MS;

/** クリア演出を始める時刻。 */
const celebrateAt =
  GOAL_START_HOLD_MS + goalFigure.solution.length * GOAL_EXTEND_INTERVAL_MS;

/** クリア演出の動き。光と終点の印の要素を記録し、終わらせる関数を残す。 */
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

/** ゴールの盤面に描いた道のマスの数。道の線は、隣り合う2マスを結ぶ1本ずつ。 */
function countPathCells(): number {
  return getGoal().querySelectorAll("svg > line").length + 1;
}

function hasPart(part: keyof typeof hitofudePuzzleFigureParts): boolean {
  return (
    getGoal().querySelector(`[${hitofudePuzzleFigureParts[part]}]`) !== null
  );
}

function getReplayButton(): HTMLButtonElement {
  return screen.getByRole<HTMLButtonElement>("button", {
    name: "始まりの盤面から見せ直す",
  });
}

function querySkipTarget(): HTMLElement | null {
  return screen.queryByLabelText("通し終えた姿まで飛ばす");
}

function advance(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

async function finishClearAnimation(): Promise<void> {
  await act(async () => {
    finishAnimations();
    await Promise.resolve();
  });
  // 本番のクリア演出は、なぞり終えてから道全体を見せる間を置いて終える。
  await act(async () => {
    await vi.runOnlyPendingTimersAsync();
  });
}

describe("GoalPlayback", () => {
  describe("動きを減らさない場合", () => {
    beforeEach(() => {
      render(<GoalPlayback />);
    });

    test("開いた直後は、始点だけの盤面を見せ、見せ直すボタンを出さないこと", () => {
      const cells = countPathCells();

      expect(cells).toBe(1);
      expect(getReplayButton().disabled).toBe(true);
    });

    test("始まりの盤面を見せてから、道を1マスずつ延ばすこと", () => {
      advance(GOAL_START_HOLD_MS + GOAL_EXTEND_INTERVAL_MS);

      expect(countPathCells()).toBe(2);
    });

    test("すべてのマスを通したら、本番のクリア演出（光と終点の印）を1回だけ返し、音は鳴らさないこと", () => {
      advance(celebrateAt);

      expect(countPathCells()).toBe(goalFigure.solution.length);
      expect(
        animate.mock.contexts.map((element) =>
          (element as Element).hasAttribute(
            hitofudePuzzleFigureParts.clearTrace,
          )
            ? "clearTrace"
            : "endMark",
        ),
      ).toEqual(["clearTrace", "endMark"]);
      expect(playSound).not.toHaveBeenCalled();
      expect(playLayeredSound).not.toHaveBeenCalled();
    });

    describe("すべてのマスを通してクリア演出を始めた場合", () => {
      beforeEach(() => {
        advance(celebrateAt);
      });

      test("クリア演出を終えたら、通し終えた姿のまま見せ直すボタンを出すこと", async () => {
        await finishClearAnimation();

        expect(hasPart("endMark")).toBe(true);
        expect(getReplayButton().disabled).toBe(false);
        expect(querySkipTarget()).toBeNull();
      });

      test("クリア演出の途中に盤面を押すと、演出を止めて、通し終えた姿をすぐ見せ、見せ直すボタンを出すこと", () => {
        fireEvent.click(querySkipTarget()!);

        const animations = animate.mock.results.map(
          ({ value }) => value as Animation,
        );
        expect(animations).toHaveLength(2);
        expect(
          animations.every(
            (animation) => vi.mocked(animation.cancel).mock.calls.length > 0,
          ),
        ).toBe(true);
        expect(hasPart("endMark")).toBe(true);
        expect(countPathCells()).toBe(goalFigure.solution.length);
        expect(querySkipTarget()).toBeNull();
        expect(getReplayButton().disabled).toBe(false);
      });
    });

    describe("延ばしている途中の場合", () => {
      beforeEach(() => {
        advance(filledAt - GOAL_EXTEND_INTERVAL_MS * 10);
      });

      test("盤面を押すと、クリア演出を返さずに、通し終えた姿をすぐ見せること", () => {
        fireEvent.click(querySkipTarget()!);
        advance(celebrateAt);

        expect(countPathCells()).toBe(goalFigure.solution.length);
        expect(hasPart("endMark")).toBe(true);
        expect(animate).not.toHaveBeenCalled();
        expect(getReplayButton().disabled).toBe(false);
      });
    });

    describe("通し終えた姿へ飛ばした場合", () => {
      beforeEach(() => {
        fireEvent.click(querySkipTarget()!);
      });

      test("見せ直すと、始点だけの盤面に戻すこと", () => {
        fireEvent.click(getReplayButton());

        expect(countPathCells()).toBe(1);
        expect(hasPart("endMark")).toBe(false);
      });

      test("見せ直すと、始まりの盤面を見せてから、もう一度道を延ばすこと", () => {
        fireEvent.click(getReplayButton());
        advance(GOAL_START_HOLD_MS + GOAL_EXTEND_INTERVAL_MS);

        expect(countPathCells()).toBe(2);
      });
    });
  });

  describe("動きを減らす場合", () => {
    beforeEach(() => {
      vi.mocked(prefersReducedMotion).mockReturnValue(true);
      render(<GoalPlayback />);
    });

    test("始まりの盤面を見せてから、通し終えた姿を動かさずに見せること", () => {
      advance(GOAL_START_HOLD_MS);

      expect(countPathCells()).toBe(goalFigure.solution.length);
      expect(hasPart("endMark")).toBe(true);
      expect(animate).not.toHaveBeenCalled();
      expect(getReplayButton().disabled).toBe(false);
    });
  });
});
