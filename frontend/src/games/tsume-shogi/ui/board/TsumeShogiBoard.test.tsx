import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import type { TsumeShogiPlayedMove } from "@/games/tsume-shogi/play/use-tsume-shogi-play";

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

const lastMove: TsumeShogiPlayedMove = {
  side: "attacker",
  move: {
    kind: "board",
    from: { file: 4, rank: 4 },
    to: { file: 4, rank: 3 },
    promote: false,
  },
  pieceType: "gold",
  promotable: false,
  dropAmbiguous: false,
  line: "main",
};

let animate: ReturnType<typeof vi.fn>;
let onChoosePromotion: ReturnType<typeof vi.fn<(promote: boolean) => void>>;

type BoardOptions = {
  rejection?: TsumeShogiRejection | null;
  shownMoves?: readonly TsumeShogiPlayedMove[];
  promoting?: boolean;
};

function renderBoard({
  rejection: currentRejection = null,
  shownMoves = [],
  promoting = false,
}: BoardOptions = {}) {
  return (
    <TsumeShogiBoard
      boardPieces={boardPieces}
      boardPieceIds={new Map()}
      selection={selection}
      shownMoves={shownMoves}
      shownMovesRestored={false}
      promotionChoice={
        promoting
          ? { from: { file: 4, rank: 3 }, to: { file: 4, rank: 2 } }
          : null
      }
      rejection={currentRejection}
      mated={false}
      interactionDisabled={false}
      onSelectSquare={vi.fn()}
      onChoosePromotion={onChoosePromotion}
    />
  );
}

function getSquareButton(name: string): HTMLElement {
  return within(screen.getByRole("group", { name: "盤" })).getByRole("button", {
    name,
  });
}

function getSelectedSquare(): HTMLElement {
  return within(screen.getByRole("group", { name: "盤" })).getByRole("button", {
    name: "4三 攻方の金",
  });
}

beforeEach(() => {
  animate = vi.fn(() => ({ cancel: vi.fn() }));
  onChoosePromotion = vi.fn<(promote: boolean) => void>();
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
      const { rerender } = render(renderBoard());
      animate.mockClear();
      rerender(renderBoard({ rejection }));
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
      const { rerender } = render(renderBoard());
      rerender(renderBoard({ rejection }));
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

  describe("最後の手の移動先の駒を選んでいる場合", () => {
    beforeEach(() => {
      render(renderBoard({ shownMoves: [lastMove] }));
    });

    test("選んでいる駒の升では選んだ地を優先し、移動元にも最後の手の地を付けないこと", () => {
      const marked = [
        getSquareButton("4三 攻方の金"),
        getSquareButton("4四"),
      ].map((square) =>
        square.className.includes(tsumeShogiToneClassNames.squareLastMove),
      );

      expect(marked).toEqual([false, false]);
    });
  });

  describe("最後の手の移動先に選んでいない駒がある場合", () => {
    const movedToEmpty: TsumeShogiPlayedMove = {
      ...lastMove,
      move: {
        kind: "board",
        from: { file: 5, rank: 2 },
        to: { file: 5, rank: 1 },
        promote: false,
      },
      side: "defender",
      pieceType: "king",
    };

    beforeEach(() => {
      render(renderBoard({ shownMoves: [movedToEmpty] }));
    });

    test("移動先の升に最後の手の地を付け、移動元には付けないこと", () => {
      const marked = [
        getSquareButton("5一 玉方の玉"),
        getSquareButton("5二"),
      ].map((square) =>
        square.className.includes(tsumeShogiToneClassNames.squareLastMove),
      );

      expect(marked).toEqual([true, false]);
    });
  });

  describe("盤上の駒の成・不成を選んでいる場合", () => {
    beforeEach(() => {
      render(renderBoard({ promoting: true }));
    });

    test("成・不成の選択肢を出し、押した方を返すこと", () => {
      const picker = screen.getByRole("group", { name: "成・不成" });
      fireEvent.click(within(picker).getByRole("button", { name: "不成" }));

      expect(onChoosePromotion).toHaveBeenCalledWith(false);
    });
  });
});
