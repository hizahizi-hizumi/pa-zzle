import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { WaterSortBottleView } from "./WaterSortBoard";
import { WaterSortPlay } from "./WaterSortPlay";

afterEach(cleanup);

const bottles: readonly WaterSortBottleView[] = [
  {
    id: "bottle-a",
    label: "ボトル A",
    layers: [{ id: "a-1", label: "青", symbol: "A", color: "#93c5fd" }],
  },
  { id: "bottle-b", label: "ボトル B", layers: [] },
];

const baseProps = {
  difficulty: "normal" as const,
  seed: "test-seed",
  status: "playing" as const,
  elapsedMs: 5000,
  moveCount: 3,
  undoCount: 1,
  restartCount: 2,
  canUndo: true,
  sourceBottleId: null,
  targetBottleId: null,
  result: null,
  bottles,
  selectBottle: vi.fn(),
  undo: vi.fn(),
  restart: vi.fn(),
  newGame: vi.fn(),
  onChangeDifficulty: vi.fn(),
};

describe("WaterSortPlay", () => {
  test("プレイ中の計測値と盤面を表示すること", () => {
    const selectBottle = vi.fn();
    render(<WaterSortPlay {...baseProps} selectBottle={selectBottle} />);
    const bottle = screen.getByRole("button", { name: "ボトル A: 青" });

    fireEvent.click(bottle);

    expect(screen.getByText("00:05")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(selectBottle).toHaveBeenCalledWith("bottle-a");
  });

  test("注ぎ元と注ぎ先を色以外の表示でも識別できること", () => {
    render(
      <WaterSortPlay
        {...baseProps}
        sourceBottleId="bottle-a"
        targetBottleId="bottle-b"
      />,
    );

    expect(screen.getByText("注ぎ元")).toBeTruthy();
    expect(screen.getByText("注ぎ先")).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "ボトル A: 青" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen
        .getByRole("button", { name: "ボトル B: 空" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  test("元に戻す・やり直す・新しい問題を別操作として通知すること", () => {
    const undo = vi.fn();
    const restart = vi.fn();
    const newGame = vi.fn();
    render(
      <WaterSortPlay
        {...baseProps}
        undo={undo}
        restart={restart}
        newGame={newGame}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "元に戻す" }));
    fireEvent.click(screen.getByRole("button", { name: "やり直す" }));
    fireEvent.click(screen.getByRole("button", { name: "新しい問題" }));

    expect(undo).toHaveBeenCalledOnce();
    expect(restart).toHaveBeenCalledOnce();
    expect(newGame).toHaveBeenCalledOnce();
  });

  test("元に戻せる手がないとき操作を無効にすること", () => {
    render(<WaterSortPlay {...baseProps} canUndo={false} />);

    const button = screen.getByRole("button", { name: "元に戻す" });

    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  test("クリア後に成績と次の操作を表示すること", () => {
    const restart = vi.fn();
    const newGame = vi.fn();
    render(
      <WaterSortPlay
        {...baseProps}
        status="cleared"
        elapsedMs={65000}
        result={{
          elapsedMs: 65000,
          moveCount: 12,
          undoCount: 3,
          restartCount: 1,
        }}
        restart={restart}
        newGame={newGame}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "同じ問題をやり直す" }));
    fireEvent.click(screen.getByRole("button", { name: "新しい問題" }));

    expect(screen.getByText("クリア")).toBeTruthy();
    expect(screen.getByText("01:05")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    expect(restart).toHaveBeenCalledOnce();
    expect(newGame).toHaveBeenCalledOnce();
  });
});
