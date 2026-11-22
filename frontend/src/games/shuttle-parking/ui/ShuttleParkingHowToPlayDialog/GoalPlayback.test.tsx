import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { isShuttleParkingCleared } from "@/games/shuttle-parking/puzzle/rules";
import { shuttleParkingTutorialProblem } from "@/games/shuttle-parking/tutorial/tutorial";
import {
  _private,
  GoalPlayback,
} from "@/games/shuttle-parking/ui/ShuttleParkingHowToPlayDialog/GoalPlayback";

const { goalSteps } = _private;

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function countParkedCars(): number {
  return screen
    .getByRole("group", { name: "送迎パーキングの駐車場" })
    .querySelectorAll("button[data-car-id]").length;
}

describe("goalSteps", () => {
  test("チュートリアルの1枚を出し切り、全員を送り出した姿で終えること", () => {
    const last = goalSteps.at(-1);

    expect(
      last &&
        isShuttleParkingCleared(shuttleParkingTutorialProblem, last.state),
    ).toBe(true);
  });
});

describe("GoalPlayback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    render(<GoalPlayback />);
  });

  test("始まりの盤面から見せること", () => {
    expect(countParkedCars()).toBe(
      shuttleParkingTutorialProblem.lot.cars.length,
    );
  });

  test("飛ばすと空の駐車場をすぐ見せ、見せ直せるようにすること", () => {
    fireEvent.click(screen.getByLabelText("全員を送り出した姿まで飛ばす"));
    const replay = screen.getByRole<HTMLButtonElement>("button", {
      name: "始まりの盤面から見せ直す",
    });

    expect(countParkedCars()).toBe(0);
    expect(replay.disabled).toBe(false);
  });

  test("時間がたつと1台ずつ出し、クリアの動きを終えてから見せ直せるようにすること", () => {
    const replay = screen.getByRole<HTMLButtonElement>("button", {
      name: "始まりの盤面から見せ直す",
    });
    const disabledWhilePlaying = replay.disabled;
    for (let elapsed = 0; elapsed < 30_000; elapsed += 500) {
      act(() => {
        vi.advanceTimersByTime(500);
      });
    }

    expect(disabledWhilePlaying).toBe(true);
    expect(countParkedCars()).toBe(0);
    expect(replay.disabled).toBe(false);
  });
});
