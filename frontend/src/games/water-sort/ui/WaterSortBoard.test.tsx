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
        selectionResult={null}
        onSelectBottle={onSelectBottle}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "ボトル 2: 空" }));
    rerender(
      <WaterSortBoard
        state={[[], [0], [1], []]}
        sourceBottleIndex={2}
        selectionResult={{
          id: 0,
          type: "poured",
          sourceBottleIndex: 0,
          destinationBottleIndex: 1,
          sourceBefore: [0],
          sourceAfter: [],
          destinationBefore: [],
          destinationAfter: [0],
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
        state={[[0], [0, 0, 0]]}
        sourceBottleIndex={0}
        selectionResult={{
          id: 0,
          type: "poured",
          sourceBottleIndex: 0,
          destinationBottleIndex: 1,
          sourceBefore: [0],
          sourceAfter: [],
          destinationBefore: [0, 0, 0],
          destinationAfter: [0, 0, 0, 0],
          isClearingMove: true,
        }}
        onSelectBottle={onSelectBottle}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "ボトル 2: 赤、赤、赤" }),
    );
    const sourceBottle = screen.getByLabelText("ボトル 1: 赤");
    const destinationBottle = screen.getByLabelText("ボトル 2: 赤、赤、赤");

    expect(sourceBottle.style.visibility).toBe("hidden");
    expect(destinationBottle.style.visibility).toBe("hidden");
  });
});
