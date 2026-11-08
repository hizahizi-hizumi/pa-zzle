import {
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useRef,
  useState,
} from "react";

import type {
  TsumeShogiBoardPiece,
  TsumeShogiHand,
  TsumeShogiHandPieceType,
  TsumeShogiPieceType,
  TsumeShogiSquare,
} from "@/games/tsume-shogi/puzzle/position";
import { TsumeShogiPieceGlyph } from "@/games/tsume-shogi/ui/board/TsumeShogiPieceGlyph";

const dragActivationDistance = 7;

type DragSource =
  | { kind: "board"; from: TsumeShogiSquare }
  | { kind: "hand"; pieceType: TsumeShogiHandPieceType };

type DragPointer = {
  id: number;
  startX: number;
  startY: number;
  active: boolean;
  source: DragSource;
  piece: TsumeShogiPieceType;
  origin: HTMLButtonElement;
  originOpacity: string;
  target: HTMLButtonElement | null;
  targetShadow: string;
  targetBackground: string;
};

type Ghost = {
  piece: TsumeShogiPieceType;
  x: number;
  y: number;
  width: number;
  height: number;
};

type UseTsumeShogiPieceDragArgs = {
  enabled: boolean;
  boardPieces: readonly TsumeShogiBoardPiece[];
  attackerHand: TsumeShogiHand;
  onDragBoardPiece: (from: TsumeShogiSquare, to: TsumeShogiSquare) => void;
  onDragHandPiece: (
    pieceType: TsumeShogiHandPieceType,
    to: TsumeShogiSquare,
  ) => void;
};

function squareOf(element: HTMLButtonElement): TsumeShogiSquare | null {
  const file = Number(element.dataset.file);
  const rank = Number(element.dataset.rank);
  return Number.isInteger(file) &&
    file >= 1 &&
    file <= 9 &&
    Number.isInteger(rank) &&
    rank >= 1 &&
    rank <= 9
    ? { file, rank }
    : null;
}

function findSquareUnderPointer(
  x: number,
  y: number,
  playArea: HTMLElement,
): HTMLButtonElement | null {
  const element = document.elementFromPoint(x, y);
  const square = element?.closest<HTMLButtonElement>(
    "button[data-file][data-rank]",
  );
  return square && playArea.contains(square) ? square : null;
}

/**
 * 比較試作の「つまんで運ぶ」操作。
 * 小さな動きは通常のタップに任せ、一定以上動かしたときだけポインターを捕捉する。
 * 行き先は実際に置こうとした升だけ知らせる。合法手の候補は表示しない。
 */
export function useTsumeShogiPieceDrag({
  enabled,
  boardPieces,
  attackerHand,
  onDragBoardPiece,
  onDragHandPiece,
}: UseTsumeShogiPieceDragArgs) {
  const pointerRef = useRef<DragPointer | null>(null);
  const suppressedClickRef = useRef<{
    origin: HTMLButtonElement;
    at: number;
  } | null>(null);
  const [ghostState, setGhostState] = useState<Ghost | null>(null);

  function restoreTarget(pointer: DragPointer): void {
    if (pointer.target) {
      pointer.target.style.boxShadow = pointer.targetShadow;
      pointer.target.style.backgroundColor = pointer.targetBackground;
      pointer.target = null;
    }
  }

  function resetDrag(): void {
    const pointer = pointerRef.current;
    if (!pointer) return;
    pointer.origin.style.opacity = pointer.originOpacity;
    restoreTarget(pointer);
    pointerRef.current = null;
    setGhostState(null);
  }

  function onPointerDownCapture(event: ReactPointerEvent<HTMLElement>): void {
    if (
      !enabled ||
      pointerRef.current ||
      !event.isPrimary ||
      (event.pointerType === "mouse" && event.button !== 0)
    )
      return;

    const element = event.target;
    if (!(element instanceof Element)) return;
    const origin = element.closest<HTMLButtonElement>(
      "button[data-shogi-drag-source]",
    );
    if (!origin || origin.getAttribute("aria-disabled") === "true") return;
    const piece = origin.dataset.shogiPieceType as
      | TsumeShogiPieceType
      | undefined;
    if (!piece) return;

    let source: DragSource;
    if (origin.dataset.shogiDragSource === "board") {
      const from = squareOf(origin);
      if (
        !from ||
        !boardPieces.some(
          ({ square, piece: boardPiece }) =>
            square.file === from.file &&
            square.rank === from.rank &&
            boardPiece.side === "attacker",
        )
      )
        return;
      source = { kind: "board", from };
    } else {
      const pieceType = piece as TsumeShogiHandPieceType;
      if (attackerHand[pieceType] <= 0) return;
      source = { kind: "hand", pieceType };
    }

    pointerRef.current = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
      source,
      piece,
      origin,
      originOpacity: origin.style.opacity,
      target: null,
      targetShadow: "",
      targetBackground: "",
    };
  }

  function onPointerMoveCapture(event: ReactPointerEvent<HTMLElement>): void {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;
    if (!pointer.active) {
      if (
        Math.hypot(
          event.clientX - pointer.startX,
          event.clientY - pointer.startY,
        ) < dragActivationDistance
      )
        return;
      pointer.active = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      pointer.origin.style.opacity = "0.27";
    }

    const rect = event.currentTarget
      .querySelector<HTMLButtonElement>("button[data-file][data-rank]")
      ?.getBoundingClientRect();
    setGhostState({
      piece: pointer.piece,
      x: event.clientX,
      y: event.clientY,
      width: rect?.width ?? 42,
      height: rect?.height ?? 46,
    });

    const target = findSquareUnderPointer(
      event.clientX,
      event.clientY,
      event.currentTarget,
    );
    if (target !== pointer.target) {
      restoreTarget(pointer);
      if (target) {
        pointer.target = target;
        pointer.targetShadow = target.style.boxShadow;
        pointer.targetBackground = target.style.backgroundColor;
        target.style.boxShadow = "inset 0 0 0 2px rgb(110 65 22 / 0.4)";
        target.style.backgroundColor = "rgb(138 90 36 / 0.14)";
      }
    }
  }

  function onPointerUpCapture(event: ReactPointerEvent<HTMLElement>): void {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;
    if (!pointer.active) {
      pointerRef.current = null;
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const target = findSquareUnderPointer(
      event.clientX,
      event.clientY,
      event.currentTarget,
    );
    const to = target && squareOf(target);
    suppressedClickRef.current = {
      origin: pointer.origin,
      at: performance.now(),
    };
    resetDrag();
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!to) return;
    if (pointer.source.kind === "board")
      onDragBoardPiece(pointer.source.from, to);
    else onDragHandPiece(pointer.source.pieceType, to);
  }

  function onPointerCancelCapture(event: ReactPointerEvent<HTMLElement>): void {
    if (pointerRef.current?.id === event.pointerId) resetDrag();
  }

  function onClickCapture(event: ReactMouseEvent<HTMLElement>): void {
    const suppressed = suppressedClickRef.current;
    if (
      event.detail === 0 ||
      !suppressed ||
      performance.now() - suppressed.at > 700
    )
      return;
    if (
      event.target === suppressed.origin ||
      event.target === event.currentTarget ||
      (event.target instanceof Node && suppressed.origin.contains(event.target))
    ) {
      event.preventDefault();
      event.stopPropagation();
      suppressedClickRef.current = null;
    }
  }

  return {
    onPointerDownCapture,
    onPointerMoveCapture,
    onPointerUpCapture,
    onPointerCancelCapture,
    onClickCapture,
    ghost: ghostState && (
      <div
        aria-hidden="true"
        className="pointer-events-none fixed z-50 drop-shadow-xl"
        style={{
          left: ghostState.x,
          top: ghostState.y - 18,
          width: ghostState.width,
          height: ghostState.height,
          transform: "translate(-50%, -50%) scale(1.1)",
        }}
      >
        <TsumeShogiPieceGlyph
          type={ghostState.piece}
          side="attacker"
          size="board"
          lifted
        />
      </div>
    ),
  };
}
