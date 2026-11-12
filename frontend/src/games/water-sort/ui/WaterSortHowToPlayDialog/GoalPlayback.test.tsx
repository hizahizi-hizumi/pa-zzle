import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import { applyWaterSortMove } from "@/games/water-sort/puzzle/rules";
import type { WaterSortState } from "@/games/water-sort/puzzle/state";
import { getWaterColorView } from "@/games/water-sort/ui/board/water-bottle/get-water-color-view";
import { goalFigure } from "@/games/water-sort/ui/WaterSortHowToPlayDialog/figure-boards";
import {
  _private,
  GoalPlayback,
} from "@/games/water-sort/ui/WaterSortHowToPlayDialog/GoalPlayback";
import { prefersReducedMotion } from "@/lib/motion";

vi.mock("@/lib/motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/motion")>()),
  prefersReducedMotion: vi.fn(() => false),
}));

const { GOAL_START_HOLD_MS, GOAL_POUR_INTERVAL_MS, getPourOperation } =
  _private;

/** 本番の盤面の読み上げ名と同じ書き方の、ボトルの中身。 */
function describeBottles(state: WaterSortState): string[] {
  return state.map((bottle, bottleIndex) => {
    const contents =
      bottle.length === 0
        ? "空"
        : bottle.map((color) => getWaterColorView(color).name).join("、");
    return `ボトル ${bottleIndex + 1}: ${contents}`;
  });
}

/** 始まりの盤面から、本番の遷移で `count` 手注いだ盤面。 */
function pourGoalMoves(count: number): WaterSortState {
  return goalFigure.moves
    .slice(0, count)
    .reduce<WaterSortState>(
      (state, move) => applyWaterSortMove(state, move) ?? state,
      goalFigure.start,
    );
}

/** ゴールの盤面の絵に描かれているボトル。本番の盤面部品で描くので、本番と同じ読み上げ名を持つ。 */
function readGoalBottles(): (string | null)[] {
  return within(screen.getByRole("img", { name: "ゴールの盤面" }))
    .getAllByRole("button", { name: /^ボトル/ })
    .map((button) => button.getAttribute("aria-label"));
}

function getReplayButton(): HTMLButtonElement {
  return screen.getByRole<HTMLButtonElement>("button", {
    name: "始まりの盤面から見せ直す",
  });
}

/** 注いでいる途中にだけ盤面に重ねる、最後の姿まで飛ばす所。指とマウスだけで受け、読み上げには出さないので、名前で探す。 */
function querySkipTarget(): HTMLElement | null {
  return screen.queryByLabelText("そろえ終えた姿まで飛ばす");
}

function advance(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/** 1手目から最後の手まで、それぞれ注いだ後の盤面の読み上げ名。 */
const bottlesBySteps = goalFigure.moves.map((_, index) =>
  describeBottles(pourGoalMoves(index + 1)),
);

const lastPourAt =
  GOAL_START_HOLD_MS + (goalFigure.moves.length - 1) * GOAL_POUR_INTERVAL_MS;

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("getPourOperation", () => {
  const steps = goalFigure.moves.map((_, index) => index + 1);

  test("本番の盤面へ、最後の手だけを本番の完成の動きを出す注ぎとして知らせること", () => {
    const clearing = steps.map((step) => {
      const operation = getPourOperation(step, 0);
      return operation?.type === "poured" ? operation.isClearingMove : null;
    });

    expect(clearing).toEqual(
      steps.map((step) => step === goalFigure.moves.length),
    );
  });

  test("0手目は知らせないこと", () => {
    const operation = getPourOperation(0, 0);

    expect(operation).toBeNull();
  });
});

describe("GoalPlayback", () => {
  describe("動きを減らす設定でない場合", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.mocked(prefersReducedMotion).mockReturnValue(false);
      render(<GoalPlayback />);
    });

    test("開いた直後は、始まりの盤面を見せ、見せ直すボタンを出さないこと", () => {
      const bottles = readGoalBottles();
      const replayDisabled = getReplayButton().disabled;

      expect(bottles).toEqual(describeBottles(goalFigure.start));
      expect(replayDisabled).toBe(true);
    });

    test("1手ずつ、本番の遷移で注いだ盤面に進むこと", () => {
      const seen: (string | null)[][] = [];
      for (let step = 1; step <= goalFigure.moves.length; step += 1) {
        advance(step === 1 ? GOAL_START_HOLD_MS : GOAL_POUR_INTERVAL_MS);
        seen.push(readGoalBottles());
      }

      expect(seen).toEqual(bottlesBySteps);
    });

    test("最後の手の完成の動きを終えると、見せ直すボタンを出し、飛ばす所を除くこと", () => {
      advance(lastPourAt);

      const replayDisabled = getReplayButton().disabled;
      const skipTarget = querySkipTarget();

      expect(replayDisabled).toBe(false);
      expect(skipTarget).toBeNull();
    });

    describe("注いでいる途中の場合", () => {
      let neighbor: HTMLDivElement;

      beforeEach(() => {
        neighbor = document.createElement("div");
        document.body.append(neighbor);
        advance(GOAL_START_HOLD_MS);
      });

      afterEach(() => {
        neighbor.remove();
      });

      test("盤面を含む領域を送ると、残りを飛ばして、そろえ終えた姿をすぐ見せること", () => {
        fireEvent.scroll(document.body);

        const bottles = readGoalBottles();
        const replayDisabled = getReplayButton().disabled;

        expect(bottles).toEqual(
          describeBottles(pourGoalMoves(goalFigure.moves.length)),
        );
        expect(replayDisabled).toBe(false);
      });

      test("盤面を含まない隣の領域を送っても、飛ばさないこと", () => {
        fireEvent.scroll(neighbor);

        const bottles = readGoalBottles();
        const replayDisabled = getReplayButton().disabled;

        expect(bottles).toEqual(describeBottles(pourGoalMoves(1)));
        expect(replayDisabled).toBe(true);
      });

      test("盤面を押すと、残りを飛ばして、そろえ終えた姿をすぐ見せること", () => {
        fireEvent.click(querySkipTarget() as HTMLElement);

        const bottles = readGoalBottles();
        const replayDisabled = getReplayButton().disabled;

        expect(bottles).toEqual(
          describeBottles(pourGoalMoves(goalFigure.moves.length)),
        );
        expect(replayDisabled).toBe(false);
      });
    });

    describe("そろえ終えた場合", () => {
      beforeEach(() => {
        advance(lastPourAt);
      });

      test("見せ直すと、始まりの盤面に戻り、見せ直すボタンを消すこと", () => {
        fireEvent.click(getReplayButton());

        const bottles = readGoalBottles();
        const replayDisabled = getReplayButton().disabled;

        expect(bottles).toEqual(describeBottles(goalFigure.start));
        expect(replayDisabled).toBe(true);
      });

      describe("見せ直した場合", () => {
        beforeEach(() => {
          fireEvent.click(getReplayButton());
        });

        test("もう一度1手目から注ぐこと", () => {
          advance(GOAL_START_HOLD_MS);

          const bottles = readGoalBottles();

          expect(bottles).toEqual(describeBottles(pourGoalMoves(1)));
        });
      });
    });
  });

  describe("動きを減らす設定の場合", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.mocked(prefersReducedMotion).mockReturnValue(true);
      render(<GoalPlayback />);
    });

    test("始まりの盤面を短く見せてから、途中を見せずにゴールの盤面を見せること", () => {
      advance(GOAL_START_HOLD_MS - 1);
      const held = readGoalBottles();
      advance(1);

      const shown = readGoalBottles();
      const replayDisabled = getReplayButton().disabled;

      expect(held).toEqual(describeBottles(goalFigure.start));
      expect(shown).toEqual(
        describeBottles(pourGoalMoves(goalFigure.moves.length)),
      );
      expect(replayDisabled).toBe(false);
    });
  });
});
