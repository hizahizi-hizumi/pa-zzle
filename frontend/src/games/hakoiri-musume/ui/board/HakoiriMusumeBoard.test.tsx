import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { Mock } from "vitest";

import { HAKOIRI_MUSUME_DISPLAY_NAME } from "@/games/hakoiri-musume/display-name";
import {
  type HakoiriMusumePiece,
  parseHakoiriMusumeBoard,
} from "@/games/hakoiri-musume/puzzle/board";
import type { HakoiriMusumeDirection } from "@/games/hakoiri-musume/puzzle/rules";
import { HakoiriMusumeBoard } from "@/games/hakoiri-musume/ui/board/HakoiriMusumeBoard";

afterEach(cleanup);

// 合意の易しい例。駒の番号: 0 左上の縦長、1 娘、2 右上の縦長、3 左中の縦長、4 右中の縦長、5 横長、6 左下の小駒、7 右下の小駒。
// vAAv
// wAAw
// v..v
// whiw
// s..s
const pieces = parseHakoiriMusumeBoard("vAAvwAAwv..vwhiws..s")!;

/**
 * 箱の外形を 440 × 540 px に置く。縁の太さは 0.2 マスなので、1マスは 100 px、箱の中の左上は (20, 20)。
 */
const boxRect = new DOMRect(0, 0, 440, 540);
const cellPixels = 100;
const rimPixels = 20;

/** 行 `row`・列 `column` のマスの中心。 */
function pointAt(row: number, column: number) {
  return {
    clientX: rimPixels + (column + 0.5) * cellPixels,
    clientY: rimPixels + (row + 0.5) * cellPixels,
  };
}

const touch = { pointerType: "touch", isPrimary: true } as const;

describe("HakoiriMusumeBoard", () => {
  let onMovePiece: Mock<
    (pieceIndex: number, direction: HakoiriMusumeDirection) => void
  >;
  let rerenderBoard: (
    nextPieces: readonly HakoiriMusumePiece[],
    interactionDisabled?: boolean,
  ) => void;

  function getBoard(): HTMLElement {
    return screen.getByRole("group", {
      name: `${HAKOIRI_MUSUME_DISPLAY_NAME}盤面`,
    });
  }

  function renderBoard(interactionDisabled: boolean) {
    onMovePiece = vi.fn();
    const element = (
      nextPieces: readonly HakoiriMusumePiece[],
      disabled: boolean,
    ) => (
      <HakoiriMusumeBoard
        pieces={nextPieces}
        clearing={false}
        interactionDisabled={disabled}
        onMovePiece={onMovePiece}
        onClearAnimationComplete={vi.fn()}
      />
    );
    const { rerender } = render(element(pieces, interactionDisabled));
    rerenderBoard = (nextPieces, disabled = interactionDisabled) =>
      rerender(element(nextPieces, disabled));
    vi.spyOn(getBoard(), "getBoundingClientRect").mockReturnValue(boxRect);
  }

  function listMoves() {
    return onMovePiece.mock.calls;
  }

  describe("プレイ中の場合", () => {
    beforeEach(() => {
      renderBoard(false);
    });

    const grabCases = [
      ["娘の左上のマス", 0, 1],
      ["娘の右下のマス", 1, 2],
    ] as const;

    test.each(grabCases)(
      "駒のどのマスを押してもその駒をつかみ、押した点からのずれだけ駒を追うこと: %s",
      (_, row, column) => {
        fireEvent.pointerDown(getBoard(), {
          ...touch,
          pointerId: 1,
          ...pointAt(row, column),
        });
        fireEvent.pointerMove(getBoard(), {
          ...touch,
          pointerId: 1,
          ...pointAt(row + 1, column),
        });

        expect(listMoves()).toEqual([[1, "down"]]);
      },
    );

    test("盤面がなぞりで動かした分だけ変わっても、なぞりを続けること", () => {
      fireEvent.pointerDown(getBoard(), {
        ...touch,
        pointerId: 1,
        ...pointAt(4, 0),
      });
      fireEvent.pointerMove(getBoard(), {
        ...touch,
        pointerId: 1,
        ...pointAt(4, 2),
      });
      rerenderBoard(
        pieces.map((piece, index) =>
          index === 6 ? { ...piece, cell: 18 } : piece,
        ),
      );
      fireEvent.pointerMove(getBoard(), {
        ...touch,
        pointerId: 1,
        ...pointAt(4, 1),
      });

      expect(listMoves()).toEqual([
        [6, "right"],
        [6, "right"],
        [6, "left"],
      ]);
    });

    test("ふさがれた向きへ押し込んでも駒を動かさないこと", () => {
      fireEvent.pointerDown(getBoard(), {
        ...touch,
        pointerId: 1,
        ...pointAt(0, 0),
      });
      fireEvent.pointerMove(getBoard(), {
        ...touch,
        pointerId: 1,
        ...pointAt(0, 2),
      });

      expect(listMoves()).toEqual([]);
    });

    test("空いたマスを押してなぞっても何も動かさないこと", () => {
      fireEvent.pointerDown(getBoard(), {
        ...touch,
        pointerId: 1,
        ...pointAt(2, 1),
      });
      fireEvent.pointerMove(getBoard(), {
        ...touch,
        pointerId: 1,
        ...pointAt(3, 1),
      });

      expect(listMoves()).toEqual([]);
    });

    test("押した指と別の指の動きは無視すること", () => {
      fireEvent.pointerDown(getBoard(), {
        ...touch,
        pointerId: 1,
        ...pointAt(3, 1),
      });
      fireEvent.pointerMove(getBoard(), {
        ...touch,
        pointerId: 2,
        ...pointAt(4, 1),
      });

      expect(listMoves()).toEqual([]);
    });

    test("指を離した後の動きでは駒を動かさないこと", () => {
      fireEvent.pointerDown(getBoard(), {
        ...touch,
        pointerId: 1,
        ...pointAt(3, 1),
      });
      fireEvent.pointerUp(getBoard(), { ...touch, pointerId: 1 });
      fireEvent.pointerMove(getBoard(), {
        ...touch,
        pointerId: 1,
        ...pointAt(4, 1),
      });

      expect(listMoves()).toEqual([]);
    });

    test("なぞっている間になぞり以外で盤面が変わったら、なぞりをやめること", () => {
      fireEvent.pointerDown(getBoard(), {
        ...touch,
        pointerId: 1,
        ...pointAt(4, 0),
      });
      rerenderBoard(
        pieces.map((piece, index) =>
          index === 7 ? { ...piece, cell: 18 } : piece,
        ),
      );
      fireEvent.pointerMove(getBoard(), {
        ...touch,
        pointerId: 1,
        ...pointAt(4, 1),
      });

      expect(listMoves()).toEqual([]);
    });

    const arrowKeyCases = [
      ["ArrowUp", 5, "up"],
      ["ArrowDown", 5, "down"],
      ["ArrowRight", 6, "right"],
    ] as const;

    test.each(arrowKeyCases)(
      "駒のボタンで %s キーを押すと、その駒を1マス動かす操作を通知すること",
      (key, pieceIndex, direction) => {
        const piece = within(getBoard()).getAllByRole("button")[pieceIndex]!;
        fireEvent.keyDown(piece, { key });

        expect(listMoves()).toEqual([[pieceIndex, direction]]);
      },
    );
  });

  describe("操作を受け付けない間の場合", () => {
    beforeEach(() => {
      renderBoard(true);
    });

    test("なぞりも矢印キーも通知しないこと", () => {
      fireEvent.pointerDown(getBoard(), {
        ...touch,
        pointerId: 1,
        ...pointAt(3, 1),
      });
      fireEvent.pointerMove(getBoard(), {
        ...touch,
        pointerId: 1,
        ...pointAt(4, 1),
      });
      const piece = within(getBoard()).getAllByRole("button")[5]!;
      fireEvent.keyDown(piece, { key: "ArrowUp" });

      expect(listMoves()).toEqual([]);
    });
  });
});
