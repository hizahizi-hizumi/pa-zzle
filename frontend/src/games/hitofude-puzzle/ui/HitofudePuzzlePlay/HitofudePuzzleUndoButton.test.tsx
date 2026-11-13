import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import { HitofudePuzzleUndoButton } from "@/games/hitofude-puzzle/ui/HitofudePuzzlePlay/HitofudePuzzleUndoButton";

const onUndo = vi.fn();

function getUndoButton(): HTMLElement {
  return screen.getByRole("button", { name: "待った" });
}

beforeEach(() => {
  vi.useFakeTimers();
  render(<HitofudePuzzleUndoButton disabled={false} onUndo={onUndo} />);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  onUndo.mockReset();
});

describe("HitofudePuzzleUndoButton", () => {
  test("短く押すと1回だけ戻すこと", () => {
    const button = getUndoButton();
    fireEvent.pointerDown(button);
    fireEvent.pointerUp(button);
    fireEvent.click(button);
    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(onUndo).toHaveBeenCalledOnce();
  });

  test("押し続けると続けて戻し、離した後は重ねて戻さないこと", () => {
    const button = getUndoButton();
    fireEvent.pointerDown(button);
    act(() => {
      vi.advanceTimersByTime(380 + 70 * 2);
    });
    const whileHeld = onUndo.mock.calls.length;
    fireEvent.pointerUp(button);
    fireEvent.click(button);
    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(whileHeld).toBe(3);
    expect(onUndo).toHaveBeenCalledTimes(3);
  });
});
