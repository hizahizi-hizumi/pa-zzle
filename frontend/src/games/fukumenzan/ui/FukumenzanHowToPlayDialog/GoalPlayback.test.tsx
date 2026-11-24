import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import { goalSteps } from "@/games/fukumenzan/ui/FukumenzanHowToPlayDialog/example-definitions";
import {
  _private,
  GoalPlayback,
} from "@/games/fukumenzan/ui/FukumenzanHowToPlayDialog/GoalPlayback";
import { prefersReducedMotion } from "@/lib/motion";

vi.mock("@/lib/motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/motion")>()),
  prefersReducedMotion: vi.fn(() => false),
}));

const { GOAL_START_HOLD_MS, GOAL_STEP_INTERVAL_MS } = _private;

/** 札を全部入れ終えて、クリア演出を始める時刻。 */
const celebrateAt =
  GOAL_START_HOLD_MS + goalSteps.length * GOAL_STEP_INTERVAL_MS;

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
  Reflect.deleteProperty(Element.prototype, "animate");
});

/** ゴールの式で札の入った文字のマスの読み上げ名。式の文字のマスは 10 ある。 */
function listPlacedTiles(): string[] {
  return within(screen.getByRole("img", { name: "ゴールの式" }))
    .getAllByRole("button")
    .map((tile) => tile.getAttribute("aria-label")!)
    .filter((label) => label.includes(" に "));
}

function getReplayButton(): HTMLButtonElement {
  return screen.getByRole<HTMLButtonElement>("button", {
    name: "始まりの盤面から見せ直す",
  });
}

function querySkipTarget(): HTMLElement | null {
  return screen.queryByLabelText("札を入れ終えた姿まで飛ばす");
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
  await act(async () => {
    await vi.runOnlyPendingTimersAsync();
  });
}

describe("GoalPlayback", () => {
  describe("動きを減らさない場合", () => {
    beforeEach(() => {
      render(<GoalPlayback />);
    });

    test("開いた直後は、札の無い式を見せ、見せ直すボタンを出さないこと", () => {
      expect([listPlacedTiles(), getReplayButton().disabled]).toEqual([
        [],
        true,
      ]);
    });

    test("始まりを見せた後、一の位の D から札を1文字ずつ入れていくこと", () => {
      advance(GOAL_START_HOLD_MS + GOAL_STEP_INTERVAL_MS);

      expect(new Set(listPlacedTiles())).toEqual(new Set(["D に 8", "E に 2"]));
    });

    test("入れ終えたら、本番のクリア演出で答えの桁を動かすこと", () => {
      advance(celebrateAt);

      expect([listPlacedTiles().length, animate.mock.calls.length]).toEqual([
        10, 4,
      ]);
    });

    test("入れ終える前は、クリア演出を始めないこと", () => {
      advance(celebrateAt - 1);

      expect(animate).not.toHaveBeenCalled();
    });

    test("クリア演出を終えたら、見せ直すボタンを出して飛ばす面を外すこと", async () => {
      advance(celebrateAt);
      await finishClearAnimation();

      expect([getReplayButton().disabled, querySkipTarget()]).toEqual([
        false,
        null,
      ]);
    });

    test("入れていく途中で盤面を押すと、残りを飛ばして入れ終えた姿を見せること", () => {
      advance(GOAL_START_HOLD_MS);

      fireEvent.click(querySkipTarget()!);

      expect([listPlacedTiles().length, getReplayButton().disabled]).toEqual([
        10,
        false,
      ]);
    });

    test("飛ばした後に見せ直すと、札の無い式から入れ直すこと", () => {
      fireEvent.click(querySkipTarget()!);
      fireEvent.click(getReplayButton());
      const afterReplay = listPlacedTiles().length;
      advance(GOAL_START_HOLD_MS);

      expect([afterReplay, new Set(listPlacedTiles())]).toEqual([
        0,
        new Set(["D に 8"]),
      ]);
    });
  });

  describe("動きを減らす場合", () => {
    beforeEach(() => {
      vi.mocked(prefersReducedMotion).mockReturnValue(true);
      render(<GoalPlayback />);
    });

    test("始まりを見せた後、動かさずに入れ終えた式を見せ、見せ直すボタンを出すこと", () => {
      advance(GOAL_START_HOLD_MS);

      expect([
        listPlacedTiles().length,
        animate.mock.calls.length,
        getReplayButton().disabled,
      ]).toEqual([10, 0, false]);
    });
  });
});
