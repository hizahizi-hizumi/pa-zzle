import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { MinesweeperClearAnimation } from "@/games/minesweeper/ui/board/clear/MinesweeperClearAnimation";

describe("MinesweeperClearAnimation", () => {
  const onComplete = vi.fn();
  const originalAnimate = Object.getOwnPropertyDescriptor(
    Element.prototype,
    "animate",
  );
  const animatedElements: Element[] = [];
  const animationDelays: number[] = [];

  beforeEach(() => {
    onComplete.mockReset();
    animatedElements.length = 0;
    animationDelays.length = 0;
    Object.defineProperty(Element.prototype, "animate", {
      configurable: true,
      value: function recordAnimation(
        this: Element,
        _keyframes: Keyframe[],
        options: KeyframeAnimationOptions,
      ) {
        animatedElements.push(this);
        animationDelays.push(Number(options.delay ?? 0));
        return { finished: new Promise(() => {}), cancel: vi.fn() };
      },
    });
  });

  afterEach(() => {
    if (originalAnimate) {
      Object.defineProperty(Element.prototype, "animate", originalAnimate);
    } else {
      Reflect.deleteProperty(Element.prototype, "animate");
    }
  });

  test("完成演出では旗と盤面全体を動かさず開示済みのマスだけを照らすこと", () => {
    render(
      <MinesweeperClearAnimation active columns={2} onComplete={onComplete}>
        <button type="button" data-cell-state="flagged" aria-label="旗">
          <svg aria-hidden="true" />
        </button>
        <button type="button" data-cell-state="revealed" aria-label="開示済み">
          1
        </button>
      </MinesweeperClearAnimation>,
    );
    const revealedCell = screen.getByRole("button", { name: "開示済み" });

    expect(animatedElements).toEqual([revealedCell]);
    expect(
      screen.getByRole("button", { name: "旗" }).querySelector("svg"),
    ).not.toBeNull();
  });

  test("最後に開けたマスから遠いマスほど遅れて照らすこと", () => {
    render(
      <MinesweeperClearAnimation
        active
        columns={3}
        originCellIndex={2}
        onComplete={onComplete}
      >
        {[0, 1, 2].map((cellIndex) => (
          <button
            key={cellIndex}
            type="button"
            data-cell-index={cellIndex}
            data-cell-state="revealed"
          >
            {cellIndex}
          </button>
        ))}
      </MinesweeperClearAnimation>,
    );

    expect(animationDelays).toEqual([420, 210, 0]);
  });
});
