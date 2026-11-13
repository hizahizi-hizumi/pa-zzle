import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { MinesweeperCell } from "@/games/minesweeper/ui/board/MinesweeperCell";

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
    fireEvent.click(cell, { detail: 1 });

    expect(onPress).toHaveBeenCalledWith(0);
    expect(onFlagPress).not.toHaveBeenCalled();
  });

  test("長押しすると旗操作だけを通知すること", () => {
    const cell = screen.getByLabelText("マス 1 未開示");

    fireEvent.pointerDown(cell, { button: 0 });
    vi.advanceTimersByTime(450);
    fireEvent.pointerUp(cell, { button: 0 });
    fireEvent.click(cell, { detail: 1 });

    expect(onFlagPress).toHaveBeenCalledWith(0);
    expect(onPress).not.toHaveBeenCalled();
  });

  test("長押し後にブラウザのコンテキストメニューが発火しても旗操作を重複させないこと", () => {
    const cell = screen.getByLabelText("マス 1 未開示");

    fireEvent.pointerDown(cell, { button: 0 });
    vi.advanceTimersByTime(450);
    fireEvent.contextMenu(cell);
    fireEvent.pointerUp(cell, { button: 0 });
    fireEvent.click(cell, { detail: 1 });

    expect(onFlagPress).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
  });

  test("コンテキストメニューが長押し判定より先に出ても旗操作を重複させないこと", () => {
    const cell = screen.getByLabelText("マス 1 未開示");

    fireEvent.pointerDown(cell, { button: 0 });
    vi.advanceTimersByTime(200);
    fireEvent.contextMenu(cell);
    vi.advanceTimersByTime(450);
    fireEvent.pointerUp(cell, { button: 0 });
    fireEvent.click(cell, { detail: 1 });

    expect(onFlagPress).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
  });

  test("右クリックを繰り返しても毎回旗操作を通知すること", () => {
    const cell = screen.getByLabelText("マス 1 未開示");

    fireEvent.pointerDown(cell, { button: 2 });
    fireEvent.contextMenu(cell);
    fireEvent.pointerUp(cell, { button: 2 });
    fireEvent.pointerDown(cell, { button: 2 });
    fireEvent.contextMenu(cell);

    expect(onFlagPress).toHaveBeenCalledTimes(2);
    expect(onPress).not.toHaveBeenCalled();
  });

  test("右クリックすると旗操作を通知すること", () => {
    const cell = screen.getByLabelText("マス 1 未開示");

    fireEvent.contextMenu(cell);

    expect(onFlagPress).toHaveBeenCalledWith(0);
    expect(onPress).not.toHaveBeenCalled();
  });

  test("押している間はマスを押している姿で示すこと", () => {
    const cell = screen.getByLabelText("マス 1 未開示");

    fireEvent.pointerDown(cell, { button: 0 });
    const pressedWhileHolding = cell.hasAttribute("data-pressed");
    fireEvent.pointerUp(cell, { button: 0 });

    expect(pressedWhileHolding).toBe(true);
    expect(cell.hasAttribute("data-pressed")).toBe(false);
  });

  test("押したまま指をマスの外へずらして離すと、何も通知しないこと", () => {
    const cell = screen.getByLabelText("マス 1 未開示");

    fireEvent.pointerDown(cell, { button: 0 });
    fireEvent.pointerMove(cell, { clientX: 100, clientY: 100 });
    vi.advanceTimersByTime(450);
    fireEvent.pointerUp(cell, { button: 0 });
    fireEvent.click(cell, { detail: 1 });

    expect(cell.hasAttribute("data-pressed")).toBe(false);
    expect(onPress).not.toHaveBeenCalled();
    expect(onFlagPress).not.toHaveBeenCalled();
  });

  test("取り消した次の押下は通常どおり通知すること", () => {
    const cell = screen.getByLabelText("マス 1 未開示");

    fireEvent.pointerDown(cell, { button: 0 });
    fireEvent.pointerLeave(cell);
    fireEvent.pointerUp(cell, { button: 0 });
    fireEvent.click(cell, { detail: 1 });
    fireEvent.pointerDown(cell, { button: 0 });
    fireEvent.pointerUp(cell, { button: 0 });
    fireEvent.click(cell, { detail: 1 });

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test("取り消した押下の後のキーボードの押下を通知すること", () => {
    const cell = screen.getByLabelText("マス 1 未開示");

    fireEvent.pointerDown(cell, { button: 0 });
    fireEvent.pointerLeave(cell);
    fireEvent.pointerUp(cell, { button: 0 });
    fireEvent.click(cell, { detail: 0 });

    expect(onPress).toHaveBeenCalledWith(0);
  });
});
