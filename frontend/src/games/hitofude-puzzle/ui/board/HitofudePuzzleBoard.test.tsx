import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import type { HitofudePuzzleBoard as HitofudePuzzleBoardState } from "@/games/hitofude-puzzle/puzzle/board";
import {
  HitofudePuzzleBoard,
  type HitofudePuzzleTouchScrollLock,
} from "@/games/hitofude-puzzle/ui/board/HitofudePuzzleBoard";

afterEach(cleanup);

/** 3×3 の盤面。左上から始め、上の段を右端まで通った道。 */
const board: HitofudePuzzleBoardState = { size: 3, holes: [8], start: 0 };
const path = [0, 1, 2] as const;

const touch = { pointerId: 1, pointerType: "touch", isPrimary: true };

/** 3×3 の盤面を 300px 四方に置いたときの、マスの中央。 */
function getCellCenter(cell: number) {
  return {
    clientX: ((cell % 3) + 0.5) * 100,
    clientY: (Math.floor(cell / 3) + 0.5) * 100,
  };
}

function getBoardGroup(): HTMLElement {
  return screen.getByRole("group", { name: /盤面/ });
}

function listTouchLockCells(): string[] {
  return Array.from(
    getBoardGroup().querySelectorAll("[data-touch-lock-cell]"),
    (lock) => lock.getAttribute("data-touch-lock-cell") ?? "",
  );
}

describe("HitofudePuzzleBoard", () => {
  let onBeginStroke: ReturnType<typeof vi.fn<(cell: number) => void>>;
  let onEndStroke: ReturnType<typeof vi.fn<() => void>>;

  function renderBoard(
    touchScrollLock?: HitofudePuzzleTouchScrollLock,
    interactionDisabled = false,
  ) {
    onBeginStroke = vi.fn<(cell: number) => void>();
    onEndStroke = vi.fn<() => void>();
    render(
      <HitofudePuzzleBoard
        board={board}
        path={path}
        isDeadEnd={false}
        blockedMove={null}
        solved={false}
        clearing={false}
        interactionDisabled={interactionDisabled}
        touchScrollLock={touchScrollLock}
        onBeginStroke={onBeginStroke}
        onTraceStroke={vi.fn()}
        onEndStroke={onEndStroke}
        onClearAnimationComplete={vi.fn()}
      />,
    );
    vi.spyOn(getBoardGroup(), "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 0, 300, 300),
    );
  }

  describe("スクロールを盤面の全体で止める場合", () => {
    beforeEach(() => {
      renderBoard();
    });

    test("盤面の全体で指のスクロールを止めること", () => {
      const lock = getBoardGroup().className;

      expect(lock).toContain("touch-none");
    });

    test("道でないマスに指を置くと、すぐに押した手として受けること", () => {
      fireEvent.pointerDown(getBoardGroup(), {
        ...touch,
        ...getCellCenter(5),
      });

      const begun = onBeginStroke.mock.calls;

      expect(begun).toEqual([[5]]);
    });
  });

  describe("スクロールをなぞりの始まる所だけで止める場合", () => {
    beforeEach(() => {
      renderBoard("stroke-start");
    });

    test("盤面の全体ではスクロールを止めないこと", () => {
      const lock = getBoardGroup().className;

      expect(lock).not.toContain("touch-none");
    });

    test("道のマスにだけ、スクロールを止める所を置くこと", () => {
      const locked = listTouchLockCells();

      expect(locked).toEqual(["0", "1", "2"]);
    });

    test("スクロールを止める所を、マスか 44px 四方の大きい方にすること", () => {
      const lock = getBoardGroup().querySelector<HTMLElement>(
        "[data-touch-lock-cell]",
      );

      const width = lock?.style.width;

      expect(width).toBe(`max(${100 / 3}%, 44px)`);
    });

    test("道の先端に置いた指は、すぐになぞり始めること", () => {
      const head = getBoardGroup().querySelector<HTMLElement>(
        '[data-touch-lock-cell="2"]',
      );
      if (head === null) {
        throw new Error("先端のスクロールを止める所がありません");
      }

      fireEvent.pointerDown(head, { ...touch, ...getCellCenter(2) });
      const begun = onBeginStroke.mock.calls;

      expect(begun).toEqual([[2]]);
    });

    describe("道でないマスに指を置いた場合", () => {
      beforeEach(() => {
        fireEvent.pointerDown(getBoardGroup(), {
          ...touch,
          ...getCellCenter(5),
        });
      });

      test("指を置いただけでは道を変えないこと", () => {
        const begun = onBeginStroke.mock.calls;

        expect(begun).toEqual([]);
      });

      test("そのまま離すと、押した手として受けること", () => {
        fireEvent.pointerUp(getBoardGroup(), touch);

        const strokes = [onBeginStroke.mock.calls, onEndStroke.mock.calls];

        expect(strokes).toEqual([[[5]], [[]]]);
      });

      test("スクロールに指を取られたら、押した手として受けないこと", () => {
        fireEvent.pointerCancel(getBoardGroup(), touch);
        fireEvent.pointerUp(getBoardGroup(), touch);

        const begun = onBeginStroke.mock.calls;

        expect(begun).toEqual([]);
      });
    });

    test("マウスで道でないマスを押すと、すぐに押した手として受けること", () => {
      fireEvent.pointerDown(getBoardGroup(), {
        pointerId: 2,
        pointerType: "mouse",
        isPrimary: true,
        button: 0,
        ...getCellCenter(5),
      });

      const begun = onBeginStroke.mock.calls;

      expect(begun).toEqual([[5]]);
    });
  });

  describe("受け付けない盤面でスクロールをなぞりの始まる所だけで止める場合", () => {
    beforeEach(() => {
      renderBoard("stroke-start", true);
    });

    test("なぞりが始まらないので、どのマスでも指のスクロールを止めないこと", () => {
      const locked = listTouchLockCells();

      expect(locked).toEqual([]);
    });
  });
});
