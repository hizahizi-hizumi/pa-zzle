import { cleanup, render, screen } from "@testing-library/react";
import type { Mock } from "vitest";

import type {
  IceFloorMazeBlockedInput,
  IceFloorMazeLastSlide,
} from "@/games/ice-floor-maze/play/use-ice-floor-maze-play";
import { parseIceFloorMazeBoard } from "@/games/ice-floor-maze/puzzle/board";
import {
  _private,
  IceFloorMazeBoard,
} from "@/games/ice-floor-maze/ui/board/IceFloorMazeBoard";

const { getIceFloorMazeSlideDurationMs } = _private;

afterEach(() => {
  cleanup();
  delete (Element.prototype as { animate?: Element["animate"] }).animate;
});

describe("getIceFloorMazeSlideDurationMs", () => {
  const cases = [
    [1, 77],
    [5, 205],
    [11, 397],
    [13, 400],
  ] as const;

  test.each(cases)(
    "%i マスの滑りは %i ミリ秒にすること",
    (distance, expected) => {
      const result = getIceFloorMazeSlideDurationMs(distance);

      expect(result).toBe(expected);
    },
  );
});

describe("IceFloorMazeBoard", () => {
  // 0 から右へ外壁まで滑って 3 で止まり、続けて右を選ぶと外壁で1マスも動けない。
  const board = parseIceFloorMazeBoard(["....", "....", "....", "...."]);
  const lastSlide: IceFloorMazeLastSlide = {
    id: 1,
    direction: "right",
    from: 0,
    to: 3,
    path: [1, 2, 3],
    passedGoal: false,
    isClearingMove: false,
    entersTrap: false,
  };
  const blockedInput: IceFloorMazeBlockedInput = {
    id: 2,
    direction: "right",
    from: 3,
  };

  describe("滑っている間に成立しない向きを選んだ場合", () => {
    let cancelAnimation: Mock<() => void>;
    let onSlideAnimationActivityChange: Mock<(active: boolean) => void>;
    let renderBoard: (blocked: IceFloorMazeBlockedInput | null) => void;

    beforeEach(() => {
      cancelAnimation = vi.fn();
      onSlideAnimationActivityChange = vi.fn();
      Object.defineProperty(Element.prototype, "animate", {
        configurable: true,
        value: vi.fn(
          () =>
            ({
              finished: new Promise<void>(() => {}),
              cancel: cancelAnimation,
            }) as unknown as Animation,
        ),
      });
      const element = (blocked: IceFloorMazeBlockedInput | null) => (
        <IceFloorMazeBoard
          board={board}
          goal={15}
          position={3}
          lastSlide={lastSlide}
          blockedInput={blocked}
          clearing={false}
          onSlideAnimationActivityChange={onSlideAnimationActivityChange}
          onClearAnimationComplete={vi.fn()}
        />
      );
      const { rerender } = render(element(null));
      renderBoard = (blocked) => rerender(element(blocked));
    });

    test("直前の滑りの跡を残し、滑りを止めないこと", () => {
      renderBoard(blockedInput);

      const trails = screen
        .getByRole("img", { name: "盤面" })
        .querySelectorAll("[data-trail]");

      expect(trails).toHaveLength(1);
      expect(cancelAnimation).not.toHaveBeenCalled();
      expect(onSlideAnimationActivityChange).toHaveBeenLastCalledWith(true);
    });
  });
});
