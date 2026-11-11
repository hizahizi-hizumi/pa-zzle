import {
  cleanup,
  createEvent,
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
    (pieceIndex: number, directions: readonly HakoiriMusumeDirection[]) => void
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

  /** 通知した手を、1マスずつ `[駒の番号, 向き]` に並べる。 */
  function listMoves() {
    return onMovePiece.mock.calls.flatMap(([pieceIndex, directions]) =>
      directions.map((direction) => [pieceIndex, direction]),
    );
  }

  /** 時刻 `timeMs`（0 より大きい値）に読んだ指の操作を、行 `row`・列 `column`（マスの中心からの端数を含む）の位置で盤面へ送る。 */
  function sendPointer(
    type: "pointerDown" | "pointerMove" | "pointerUp",
    row: number,
    column: number,
    timeMs: number,
  ) {
    const event = createEvent[type](getBoard(), {
      ...touch,
      pointerId: 1,
      ...pointAt(row, column),
    });
    Object.defineProperty(event, "timeStamp", { value: timeMs });
    fireEvent(getBoard(), event);
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

    describe("駒を押して少しだけ動かした場合", () => {
      function pressAndNudge(row: number, column: number, columnShift: number) {
        fireEvent.pointerDown(getBoard(), {
          ...touch,
          pointerId: 1,
          ...pointAt(row, column),
        });
        fireEvent.pointerMove(getBoard(), {
          ...touch,
          pointerId: 1,
          ...pointAt(row, column + columnShift),
        });
      }

      function getPiece(pieceIndex: number): HTMLElement {
        return getBoard().querySelector<HTMLElement>(
          `[data-piece-index="${pieceIndex}"]`,
        )!;
      }

      test("押した駒を持ち上げ、空いた向きへは手にせず指の端数ぶん寄せて見せること", () => {
        pressAndNudge(4, 0, 0.25);

        const piece = getPiece(6);

        expect(listMoves()).toEqual([]);
        expect(piece.hasAttribute("data-lifted")).toBe(true);
        expect(piece.style.translate).toMatch(/^[1-9][\d.]*cqw 0cqw$/);
      });

      test("ふさがれた向きへは寄せずに、持ち上げるだけにすること", () => {
        pressAndNudge(0, 0, 0.25);

        const piece = getPiece(0);

        expect(piece.hasAttribute("data-lifted")).toBe(true);
        expect(piece.style.translate).toBe("0cqw 0cqw");
      });

      test("指を離すと、下ろしてマスへ収めること", () => {
        pressAndNudge(4, 0, 0.25);
        fireEvent.pointerCancel(getBoard(), { ...touch, pointerId: 1 });

        const piece = getPiece(6);

        expect(piece.hasAttribute("data-lifted")).toBe(false);
        expect(piece.style.translate).toBe("");
      });
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

    test("盤面の外に別の指が先に触れていても、盤面に触れた指でなぞれること", () => {
      fireEvent.pointerDown(getBoard(), {
        ...touch,
        isPrimary: false,
        pointerId: 2,
        ...pointAt(4, 0),
      });
      fireEvent.pointerMove(getBoard(), {
        ...touch,
        isPrimary: false,
        pointerId: 2,
        ...pointAt(4, 1),
      });

      expect(listMoves()).toEqual([[6, "right"]]);
    });

    test("なぞりの途中で盤面の大きさが変わったら、なぞりをやめて駒を動かさないこと", () => {
      fireEvent.pointerDown(getBoard(), {
        ...touch,
        pointerId: 1,
        ...pointAt(4, 0),
      });
      vi.spyOn(getBoard(), "getBoundingClientRect").mockReturnValue(
        new DOMRect(0, 0, 220, 270),
      );
      fireEvent.pointerMove(getBoard(), {
        ...touch,
        pointerId: 1,
        ...pointAt(4, 1),
      });

      expect(listMoves()).toEqual([]);
    });

    test("なぞりの途中でフォーカスが盤面の外へ移ったら、なぞりをやめること", () => {
      const outside = document.createElement("button");
      document.body.append(outside);
      fireEvent.pointerDown(getBoard(), {
        ...touch,
        pointerId: 1,
        ...pointAt(4, 0),
      });
      fireEvent.focusIn(outside);
      fireEvent.pointerMove(getBoard(), {
        ...touch,
        pointerId: 1,
        ...pointAt(4, 1),
      });
      outside.remove();

      expect(listMoves()).toEqual([]);
    });

    test("指を離した後の動きでは駒を動かさないこと", () => {
      fireEvent.pointerDown(getBoard(), {
        ...touch,
        pointerId: 1,
        ...pointAt(3, 1),
      });
      fireEvent.pointerUp(getBoard(), {
        ...touch,
        pointerId: 1,
        ...pointAt(3, 1),
      });
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

    test("指を離した位置まで駒をたどらせること", () => {
      sendPointer("pointerDown", 4, 0, 1000);
      sendPointer("pointerUp", 4, 1, 2000);

      expect(listMoves()).toEqual([[6, "right"]]);
    });

    describe("駒を動かさないまま指を離した場合", () => {
      test("空いた向きへ速く弾いて離したら、その向きへ1マス動かすこと", () => {
        sendPointer("pointerDown", 4, 0, 1000);
        sendPointer("pointerMove", 4, 0.15, 1030);
        sendPointer("pointerUp", 4, 0.3, 1060);

        expect(listMoves()).toEqual([[6, "right"]]);
      });

      test("ゆっくり動かして止めてから離したら、動かさないこと", () => {
        sendPointer("pointerDown", 4, 0, 1000);
        sendPointer("pointerMove", 4, 0.3, 1300);
        sendPointer("pointerUp", 4, 0.3, 1600);

        expect(listMoves()).toEqual([]);
      });

      test("少しだけ弾いたら、動かさないこと", () => {
        sendPointer("pointerDown", 4, 0, 1000);
        sendPointer("pointerUp", 4, 0.1, 1030);

        expect(listMoves()).toEqual([]);
      });

      test("ふさがれた向きへ弾いたら、動かさないこと", () => {
        sendPointer("pointerDown", 0, 0, 1000);
        sendPointer("pointerUp", 0, 0.3, 1040);

        expect(listMoves()).toEqual([]);
      });
    });

    test("なぞって駒を移した後に弾くように離しても、弾いた分は動かさないこと", () => {
      sendPointer("pointerDown", 4, 0, 1000);
      sendPointer("pointerMove", 4, 1, 1400);
      sendPointer("pointerUp", 4, 1.3, 1430);

      expect(listMoves()).toEqual([[6, "right"]]);
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

  describe("娘を出口の前へなぞってクリアした場合", () => {
    // 駒の番号: 0 左上の縦長、1 右上の縦長、2・3 上の小駒、4 娘、5 右の縦長、6 左下の小駒。
    const nearExit = parseHakoiriMusumeBoard("v..vwssw.AAv.AAws...")!;
    const cleared = nearExit.map((piece, index) =>
      index === 4 ? { ...piece, cell: piece.cell + 4 } : piece,
    );
    let animate: Mock;

    beforeEach(() => {
      animate = vi.fn(
        () =>
          ({
            finished: new Promise(() => {}),
            cancel: vi.fn(),
            commitStyles: vi.fn(),
          }) as unknown as Animation,
      );
      vi.stubGlobal(
        "matchMedia",
        vi.fn(() => ({ matches: false }) as MediaQueryList),
      );
      HTMLElement.prototype.animate =
        animate as unknown as HTMLElement["animate"];
    });

    afterEach(() => {
      delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
      vi.unstubAllGlobals();
    });

    test("指へ寄せていた姿と持ち上げから収め始め、なぞりを終えること", () => {
      onMovePiece = vi.fn();
      const element = (
        nextPieces: readonly HakoiriMusumePiece[],
        clearing: boolean,
      ) => (
        <HakoiriMusumeBoard
          pieces={nextPieces}
          clearing={clearing}
          interactionDisabled={clearing}
          onMovePiece={onMovePiece}
          onClearAnimationComplete={vi.fn()}
        />
      );
      const { rerender } = render(element(nearExit, false));
      vi.spyOn(getBoard(), "getBoundingClientRect").mockReturnValue(boxRect);
      fireEvent.pointerDown(getBoard(), {
        ...touch,
        pointerId: 1,
        ...pointAt(2, 1),
      });
      fireEvent.pointerMove(getBoard(), {
        ...touch,
        pointerId: 1,
        clientX: pointAt(2, 1).clientX,
        clientY: pointAt(2, 1).clientY + 0.75 * cellPixels,
      });
      rerender(element(cleared, true));
      fireEvent.pointerMove(getBoard(), {
        ...touch,
        pointerId: 1,
        ...pointAt(4, 1),
      });

      const settle = animate.mock.calls.find(
        ([keyframes]) => keyframes[0].scale !== undefined,
      );

      expect(listMoves()).toEqual([[4, "down"]]);
      expect(settle?.[0][0]).toMatchObject({
        translate: expect.stringMatching(/^0cqw -[\d.]+cqw$/),
        scale: "1.04",
      });
    });

    test("出口の前へ弾いたときは、弾く前に見せていた位置から出口の前へ収め、下の縁へ行き過ぎないこと", () => {
      onMovePiece = vi.fn();
      const element = (
        nextPieces: readonly HakoiriMusumePiece[],
        clearing: boolean,
      ) => (
        <HakoiriMusumeBoard
          pieces={nextPieces}
          clearing={clearing}
          interactionDisabled={clearing}
          onMovePiece={onMovePiece}
          onClearAnimationComplete={vi.fn()}
        />
      );
      const { rerender } = render(element(nearExit, false));
      vi.spyOn(getBoard(), "getBoundingClientRect").mockReturnValue(boxRect);
      sendPointer("pointerDown", 2, 1, 1000);
      sendPointer("pointerMove", 2.15, 1, 1030);
      sendPointer("pointerUp", 2.3, 1, 1060);
      rerender(element(cleared, true));

      const settle = animate.mock.calls.find(
        ([keyframes]) => keyframes[0].scale !== undefined,
      );

      expect(listMoves()).toEqual([[4, "down"]]);
      expect(settle?.[0][0]).toMatchObject({
        translate: expect.stringMatching(/^0cqw -[\d.]+cqw$/),
        scale: "1",
      });
    });
  });
});
