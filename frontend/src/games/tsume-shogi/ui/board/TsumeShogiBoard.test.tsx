import { act, cleanup, render, screen, within } from "@testing-library/react";

import type { TsumeShogiBoardPiece } from "@/games/tsume-shogi/puzzle/position";
import type {
  TsumeShogiRejection,
  TsumeShogiSelection,
} from "@/games/tsume-shogi/session/session";
import { TsumeShogiBoard } from "@/games/tsume-shogi/ui/board/TsumeShogiBoard";
import { tsumeShogiToneClassNames } from "@/games/tsume-shogi/ui/tsume-shogi-tone";

const boardPieces: readonly TsumeShogiBoardPiece[] = [
  { square: { file: 5, rank: 1 }, piece: { side: "defender", type: "king" } },
  { square: { file: 4, rank: 3 }, piece: { side: "attacker", type: "gold" } },
];
const selection: TsumeShogiSelection = {
  type: "board",
  square: { file: 4, rank: 3 },
};
const rejection: TsumeShogiRejection = {
  reason: "not-check",
  to: { file: 4, rank: 4 },
};

let animate: ReturnType<typeof vi.fn>;

function renderBoard(currentRejection: TsumeShogiRejection | null) {
  return (
    <TsumeShogiBoard
      boardPieces={boardPieces}
      selection={selection}
      shownMoves={[]}
      shownMovesRestored={false}
      promotionChoice={null}
      rejection={currentRejection}
      mated={false}
      interactionDisabled={false}
      onSelectSquare={vi.fn()}
      onChoosePromotion={vi.fn()}
    />
  );
}

function getSelectedSquare(): HTMLElement {
  return within(screen.getByRole("group", { name: "盤" })).getByRole("button", {
    name: "4三 攻方の金",
  });
}

beforeEach(() => {
  animate = vi.fn();
  Object.defineProperty(Element.prototype, "animate", {
    configurable: true,
    value: animate,
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(Element.prototype, "animate");
});

describe("TsumeShogiBoard", () => {
  describe("着手させなかった入力を受けた場合", () => {
    beforeEach(() => {
      const { rerender } = render(renderBoard(null));
      animate.mockClear();
      rerender(renderBoard(rejection));
    });

    test("選んでいる駒を揺らすこと", () => {
      const shaken = animate.mock.contexts[0] as Element | undefined;

      expect(animate).toHaveBeenCalledOnce();
      expect(getSelectedSquare().contains(shaken ?? null)).toBe(true);
    });
  });

  describe("動きを減らす設定で着手させなかった入力を受けた場合", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.stubGlobal(
        "matchMedia",
        vi.fn(() => ({ matches: true }) as MediaQueryList),
      );
      const { rerender } = render(renderBoard(null));
      rerender(renderBoard(rejection));
    });

    test("揺らさずに、選んでいる駒の升の地を短く変えること", () => {
      const flashed = getSelectedSquare().className.includes(
        tsumeShogiToneClassNames.squareRejected,
      );

      expect(animate).not.toHaveBeenCalled();
      expect(flashed).toBe(true);
      expect(getSelectedSquare().getAttribute("aria-pressed")).toBe("true");
    });

    test("短い間の後に選んでいる駒の地へ戻すこと", () => {
      act(() => {
        vi.runAllTimers();
      });

      const flashed = getSelectedSquare().className.includes(
        tsumeShogiToneClassNames.squareRejected,
      );

      expect(flashed).toBe(false);
    });
  });
});
