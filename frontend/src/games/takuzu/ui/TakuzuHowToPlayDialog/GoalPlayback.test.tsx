import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import { createTakuzuExampleBoard } from "@/games/takuzu/ui/TakuzuHowToPlayDialog/example-board";
import { goalFigure } from "@/games/takuzu/ui/TakuzuHowToPlayDialog/figure-boards";
import {
  _private,
  GoalPlayback,
} from "@/games/takuzu/ui/TakuzuHowToPlayDialog/GoalPlayback";
import { prefersReducedMotion } from "@/lib/motion";

vi.mock("@/lib/motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/motion")>()),
  prefersReducedMotion: vi.fn(() => false),
}));

const { GOAL_START_HOLD_MS, GOAL_PLACE_INTERVAL_MS } = _private;

/** クリア演出の動きが終わってから完了するまでの間より長い時間。 */
const CLEAR_ANIMATION_HOLD_MS = 1000;

const goal = createTakuzuExampleBoard(goalFigure);
const givenCount = goal.givens.cells.filter((cell) => cell !== null).length;
const tileCount = goal.board.cells.filter((cell) => cell !== null).length;

/** ゴールの盤面の絵に描かれているタイルの数。 */
function countDrawnTiles(): number {
  return screen
    .getByRole("img", { name: "ゴールの盤面" })
    .querySelectorAll("svg").length;
}

function getReplayButton(): HTMLButtonElement {
  return screen.getByRole<HTMLButtonElement>("button", {
    name: "始まりの盤面から見せ直す",
  });
}

/**
 * 埋めている途中とクリア演出の途中にだけ盤面に重ねる、最後の姿まで飛ばす所。
 * 指とマウスだけで受け、読み上げには出さないので、名前で探す。
 */
function querySkipTarget(): HTMLElement | null {
  return screen.queryByLabelText("埋め終えた姿まで飛ばす");
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
      render(<GoalPlayback goal={goalFigure} />);
    });

    test("始まりの盤面の最初からあるタイルだけを見せ、見せ直すボタンを出さないこと", () => {
      const drawn = countDrawnTiles();

      expect(drawn).toBe(givenCount);
      expect(getReplayButton().disabled).toBe(true);
    });

    test("始まりの盤面を見せた後、置いたタイルを1枚ずつ置いていくこと", () => {
      advance(GOAL_START_HOLD_MS + GOAL_PLACE_INTERVAL_MS);

      expect(countDrawnTiles()).toBe(givenCount + 1);
    });

    test("埋まり切ると、ゴールの盤面を見せ、見せ直すボタンを出すこと", () => {
      advance(GOAL_START_HOLD_MS + tileCount * GOAL_PLACE_INTERVAL_MS);

      expect(countDrawnTiles()).toBe(tileCount);
      expect(getReplayButton().disabled).toBe(false);
    });

    describe("クリア演出を見終えた場合", () => {
      beforeEach(async () => {
        animate.mockImplementation(
          () =>
            ({ finished: Promise.resolve(), cancel }) as unknown as Animation,
        );
        advance(GOAL_START_HOLD_MS + (tileCount + 4) * GOAL_PLACE_INTERVAL_MS);
        await act(async () => {});
        advance(CLEAR_ANIMATION_HOLD_MS);
      });

      test("埋め終えた姿のまま、盤面を押す所を消し、見せ直すボタンだけを残すこと", () => {
        const skipTarget = querySkipTarget();

        expect(skipTarget).toBeNull();
        expect(countDrawnTiles()).toBe(tileCount);
        expect(getReplayButton().disabled).toBe(false);
      });
    });

    describe("埋めている途中に盤面を押した場合", () => {
      beforeEach(() => {
        advance(GOAL_START_HOLD_MS + GOAL_PLACE_INTERVAL_MS);
        fireEvent.click(querySkipTarget() as HTMLElement);
      });

      test("すぐ埋め終えた姿にし、見せ直すボタンを出し、盤面を押す所を消すこと", () => {
        const drawn = countDrawnTiles();

        expect(drawn).toBe(tileCount);
        expect(getReplayButton().disabled).toBe(false);
        expect(querySkipTarget()).toBeNull();
      });

      test("その後、クリア演出を再生しないこと", () => {
        advance(GOAL_START_HOLD_MS + (tileCount + 4) * GOAL_PLACE_INTERVAL_MS);

        expect(animate).not.toHaveBeenCalled();
        expect(countDrawnTiles()).toBe(tileCount);
      });
    });

    describe("クリア演出の途中の場合", () => {
      beforeEach(() => {
        advance(GOAL_START_HOLD_MS + (tileCount + 4) * GOAL_PLACE_INTERVAL_MS);
      });

      test("盤面を押すと、クリア演出を止め、埋め終えた姿のまま盤面を押す所を消すこと", () => {
        const startedAnimations = animate.mock.results.length;

        fireEvent.click(querySkipTarget() as HTMLElement);

        expect(startedAnimations).toBe(tileCount);
        expect(cancel).toHaveBeenCalledTimes(tileCount);
        expect(countDrawnTiles()).toBe(tileCount);
        expect(querySkipTarget()).toBeNull();
      });

      test("見せ直すと、始まりの盤面に戻り、盤面を押して飛ばせるようになること", () => {
        fireEvent.click(getReplayButton());

        expect(countDrawnTiles()).toBe(givenCount);
        expect(getReplayButton().disabled).toBe(true);
        expect(querySkipTarget()).not.toBeNull();
      });
    });
  });

  describe("動きを減らす設定の場合", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.mocked(prefersReducedMotion).mockReturnValue(true);
      render(<GoalPlayback goal={goalFigure} />);
    });

    test("始まりの盤面を短く見せてから、1枚ずつ置かずにゴールの盤面を一度に見せること", () => {
      advance(GOAL_START_HOLD_MS - 1);
      const beforeHold = countDrawnTiles();

      advance(1);

      expect(beforeHold).toBe(givenCount);
      expect(countDrawnTiles()).toBe(tileCount);
    });
  });
});
