// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { MinesweeperCell } from "./MinesweeperCell";

describe("MinesweeperCell", () => {
  const onPress = vi.fn<(cellIndex: number) => void>();
  const onFlagPress = vi.fn<(cellIndex: number) => void>();

  beforeEach(() => {
    vi.useFakeTimers();
    onPress.mockReset();
    onFlagPress.mockReset();
    render(
      <MinesweeperCell
        cellIndex={0}
        view={{ state: "hidden" }}
        disabled={false}
        onPress={onPress}
        onFlagPress={onFlagPress}
      />,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("短く押すと通常操作だけを通知すること", () => {
    const cell = screen.getByLabelText("マス 1 未開示");

    fireEvent.pointerDown(cell, { button: 0 });
    vi.advanceTimersByTime(100);
    fireEvent.pointerUp(cell, { button: 0 });
    fireEvent.click(cell);

    expect(onPress).toHaveBeenCalledWith(0);
    expect(onFlagPress).not.toHaveBeenCalled();
  });

  test("長押しすると旗操作だけを通知すること", () => {
    const cell = screen.getByLabelText("マス 1 未開示");

    fireEvent.pointerDown(cell, { button: 0 });
    vi.advanceTimersByTime(450);
    fireEvent.pointerUp(cell, { button: 0 });
    fireEvent.click(cell);

    expect(onFlagPress).toHaveBeenCalledWith(0);
    expect(onPress).not.toHaveBeenCalled();
  });

  test("右クリックすると旗操作を通知すること", () => {
    const cell = screen.getByLabelText("マス 1 未開示");

    fireEvent.contextMenu(cell);

    expect(onFlagPress).toHaveBeenCalledWith(0);
    expect(onPress).not.toHaveBeenCalled();
  });
});
