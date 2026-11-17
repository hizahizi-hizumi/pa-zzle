import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import { goalFigure } from "@/games/parking-jam/ui/ParkingJamHowToPlayDialog/figure-boards";
import {
  _private,
  GoalPlayback,
} from "@/games/parking-jam/ui/ParkingJamHowToPlayDialog/GoalPlayback";
import { prefersReducedMotion } from "@/lib/motion";

vi.mock("@/lib/motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/motion")>()),
  prefersReducedMotion: vi.fn(() => false),
}));

const { GOAL_START_HOLD_MS, GOAL_EXIT_INTERVAL_MS, goalStates } = _private;

/** 本番の盤面部品が描く車の読み上げ名と、走り去る動きを付けた車か。 */
function readGoalCars(): { name: string | null; exiting: boolean }[] {
  return within(screen.getByRole("img", { name: "ゴールの盤面" }))
    .queryAllByRole("button")
    .map((car) => ({
      name: car.getAttribute("aria-label"),
      exiting: [...car.classList].some((name) =>
        name.startsWith("parking-jam-car--exit-"),
      ),
    }));
}

/** 本番の盤面部品と同じ書き方の、車の読み上げ名。 */
function describeVehicle(vehicleId: string): string {
  const vehicle = goalFigure.board.vehicles.find(({ id }) => id === vehicleId);
  if (!vehicle) {
    return "";
  }
  return `${vehicle.orientation === "horizontal" ? "横向き" : "縦向き"}の車 行${vehicle.row + 1} 列${vehicle.column + 1}`;
}

/** `step` 台出した後の、止まっている車と走り去っている車の読み上げ名。 */
function expectedCars(step: number): { name: string; exiting: boolean }[] {
  const remaining = goalStates[step]?.remainingVehicleIds ?? [];
  const exitingId = goalFigure.moves[step - 1]?.vehicleId;
  return goalFigure.board.vehicles
    .filter(({ id }) => remaining.includes(id) || id === exitingId)
    .map(({ id }) => ({
      name: describeVehicle(id),
      exiting: id === exitingId,
    }));
}

function getReplayButton(): HTMLButtonElement {
  return screen.getByRole<HTMLButtonElement>("button", {
    name: "始まりの盤面から見せ直す",
  });
}

function querySkipTarget(): HTMLElement | null {
  return screen.queryByLabelText("空になった駐車場まで飛ばす");
}

function advance(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

const lastExitAt =
  GOAL_START_HOLD_MS + (goalFigure.moves.length - 1) * GOAL_EXIT_INTERVAL_MS;

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("GoalPlayback", () => {
  describe("動きを減らす設定でない場合", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.mocked(prefersReducedMotion).mockReturnValue(false);
      render(<GoalPlayback />);
    });

    test("開いた直後は、始まりの盤面のすべての車を止めて見せ、見せ直すボタンを出さないこと", () => {
      const cars = readGoalCars();
      const replayDisabled = getReplayButton().disabled;

      expect(cars).toEqual(expectedCars(0));
      expect(replayDisabled).toBe(true);
    });

    test("1台ずつ、本番の遷移で出せる車を本番の走り去る動きで出していくこと", () => {
      const seen: ReturnType<typeof readGoalCars>[] = [];
      for (let step = 1; step <= goalFigure.moves.length; step += 1) {
        advance(step === 1 ? GOAL_START_HOLD_MS : GOAL_EXIT_INTERVAL_MS);
        seen.push(readGoalCars());
      }

      expect(seen).toEqual(
        goalFigure.moves.map((_, index) => expectedCars(index + 1)),
      );
    });

    describe("出している途中の場合", () => {
      beforeEach(() => {
        advance(GOAL_START_HOLD_MS);
      });

      test("盤面を押すと、残りを飛ばして空の駐車場を見せ、見せ直すボタンを出すこと", () => {
        fireEvent.click(screen.getByLabelText("空になった駐車場まで飛ばす"));

        const cars = readGoalCars();
        const replayDisabled = getReplayButton().disabled;

        expect(cars).toEqual([]);
        expect(replayDisabled).toBe(false);
      });
    });

    describe("最後の車の本番のクリアの動きを終えた場合", () => {
      beforeEach(() => {
        advance(lastExitAt);
        advance(0);
      });

      test("見せ直すボタンを出し、飛ばす所を除くこと", () => {
        const replayDisabled = getReplayButton().disabled;
        const skipTarget = querySkipTarget();

        expect(replayDisabled).toBe(false);
        expect(skipTarget).toBeNull();
      });

      test("見せ直すと、始まりの盤面に戻してもう一度出していくこと", () => {
        fireEvent.click(getReplayButton());
        const restarted = readGoalCars();
        advance(GOAL_START_HOLD_MS);

        const firstStep = readGoalCars();

        expect(restarted).toEqual(expectedCars(0));
        expect(firstStep).toEqual(expectedCars(1));
      });
    });
  });

  describe("動きを減らす設定の場合", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.mocked(prefersReducedMotion).mockReturnValue(true);
      render(<GoalPlayback />);
    });

    test("開いた直後は、始まりの盤面を見せること", () => {
      const cars = readGoalCars();

      expect(cars).toEqual(expectedCars(0));
    });

    test("始まりの盤面を短く見せてから、動かさずに空の駐車場を見せること", () => {
      advance(GOAL_START_HOLD_MS);

      const cars = readGoalCars();
      const replayDisabled = getReplayButton().disabled;

      expect(cars).toEqual([]);
      expect(replayDisabled).toBe(false);
    });
  });
});
