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

  beforeEach(() => {
    onComplete.mockReset();
    animatedElements.length = 0;
    Object.defineProperty(Element.prototype, "animate", {
      configurable: true,
      value: function recordAnimation(this: Element) {
        animatedElements.push(this);
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
      <MinesweeperClearAnimation active onComplete={onComplete}>
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
});
