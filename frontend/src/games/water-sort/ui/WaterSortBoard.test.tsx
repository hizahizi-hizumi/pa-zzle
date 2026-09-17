import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { WaterSortBoard } from "./WaterSortBoard";

afterEach(() => {
  cleanup();
  delete (HTMLElement.prototype as { animate?: Element["animate"] }).animate;
  vi.restoreAllMocks();
});

describe("WaterSortBoard", () => {
  test("注水アニメーションの完了を待たずに次の操作を通知できること", () => {
    const animationFinished = new Promise<void>(() => undefined);
    Object.defineProperty(HTMLElement.prototype, "animate", {
      configurable: true,
      value: vi.fn(
        () =>
          ({
            finished: animationFinished,
            cancel: vi.fn(),
          }) as unknown as Animation,
      ),
    });
    const onSelectBottle = vi.fn();
    const { rerender } = render(
      <WaterSortBoard
        state={[[0], [], [1], []]}
        sourceBottleIndex={0}
        operation={null}
        onSelectBottle={onSelectBottle}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "ボトル 2: 空" }));
    rerender(
      <WaterSortBoard
        state={[[], [0], [1], []]}
        sourceBottleIndex={2}
        operation={{
          id: 1,
          type: "poured",
          sourceBottleIndex: 0,
          destinationBottleIndex: 1,
          stateBefore: [[0], [], [1], []],
          stateAfter: [[], [0], [1], []],
          isClearingMove: false,
        }}
        onSelectBottle={onSelectBottle}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "ボトル 4: 空" }));

    expect(onSelectBottle).toHaveBeenNthCalledWith(1, 1);
    expect(onSelectBottle).toHaveBeenNthCalledWith(2, 3);
  });

  test("注水中は実盤面の注ぎ元と注ぎ先を隠すこと", () => {
    const animationFinished = new Promise<void>(() => undefined);
    Object.defineProperty(HTMLElement.prototype, "animate", {
      configurable: true,
      value: vi.fn(
        () =>
          ({
            finished: animationFinished,
            cancel: vi.fn(),
          }) as unknown as Animation,
      ),
    });
    const onSelectBottle = vi.fn();
    render(
      <WaterSortBoard
        state={[[], [0, 0, 0, 0]]}
        sourceBottleIndex={null}
        operation={{
          id: 1,
          type: "poured",
          sourceBottleIndex: 0,
          destinationBottleIndex: 1,
          stateBefore: [[0], [0, 0, 0]],
          stateAfter: [[], [0, 0, 0, 0]],
          isClearingMove: true,
        }}
        onSelectBottle={onSelectBottle}
      />,
    );

    const sourceBottle = screen.getByLabelText("ボトル 1: 空");
    const destinationBottle = screen.getByLabelText("ボトル 2: 赤、赤、赤、赤");

    expect(sourceBottle.style.visibility).toBe("hidden");
    expect(destinationBottle.style.visibility).toBe("hidden");
  });
});
