import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
} from "react";

import { HAKOIRI_MUSUME_DISPLAY_NAME } from "@/games/hakoiri-musume/display-name";
import {
  getHakoiriMusumeCellPosition,
  type HakoiriMusumeCellPosition,
  type HakoiriMusumePiece,
  type HakoiriMusumePieceKind,
  hakoiriMusumePieceShapes,
  listHakoiriMusumePieceCells,
} from "@/games/hakoiri-musume/puzzle/board";
import {
  createHakoiriMusumePlacementCheck,
  type HakoiriMusumeDirection,
  type HakoiriMusumePlacementCheck,
} from "@/games/hakoiri-musume/puzzle/rules";
import {
  getPieceRect,
  toBoxCellPoint,
  toBoxStyle,
} from "@/games/hakoiri-musume/ui/board/board-geometry";
import {
  type HakoiriMusumeAnchorPoint,
  type HakoiriMusumeFingerTrace,
  startHakoiriMusumeFingerTrace,
  traceHakoiriMusumeFinger,
} from "@/games/hakoiri-musume/ui/board/finger-trace";
import { playDaughterExit } from "@/games/hakoiri-musume/ui/board/HakoiriMusumeBoard/play-daughter-exit";
import { HakoiriMusumeBox } from "@/games/hakoiri-musume/ui/board/HakoiriMusumeBox";
import { HakoiriMusumePieceFace } from "@/games/hakoiri-musume/ui/board/HakoiriMusumePieceFace";

type HakoiriMusumeBoardProps = {
  pieces: readonly HakoiriMusumePiece[];
  /** クリアしてから演出を終えるまで `true`。 */
  clearing: boolean;
  interactionDisabled: boolean;
  onMovePiece: (pieceIndex: number, direction: HakoiriMusumeDirection) => void;
  onClearAnimationComplete: () => void;
};

/** なぞっている駒と、押したときの指の位置。 */
type PieceDrag = {
  pointerId: number;
  pieceIndex: number;
  kind: HakoiriMusumePieceKind;
  canPlace: HakoiriMusumePlacementCheck;
  origin: HakoiriMusumeCellPosition;
  downPoint: HakoiriMusumeAnchorPoint;
  trace: HakoiriMusumeFingerTrace;
};

const hakoiriMusumePieceLabels = {
  daughter: "娘",
  vertical: "縦長",
  horizontal: "横長",
  small: "小駒",
} as const satisfies Record<HakoiriMusumePieceKind, string>;

const directionByArrowKey: Readonly<Record<string, HakoiriMusumeDirection>> = {
  ArrowUp: "up",
  ArrowRight: "right",
  ArrowDown: "down",
  ArrowLeft: "left",
};

function findDirection(
  from: HakoiriMusumeCellPosition,
  to: HakoiriMusumeCellPosition,
): HakoiriMusumeDirection {
  if (to.row < from.row) return "up";
  if (to.row > from.row) return "down";
  return to.column < from.column ? "left" : "right";
}

/** 箱の中のマス `point` を覆っている駒の番号。空いたマスや箱の外なら `null`。 */
function findPieceAt(
  pieces: readonly HakoiriMusumePiece[],
  point: HakoiriMusumeAnchorPoint,
): number | null {
  const row = Math.floor(point.row);
  const column = Math.floor(point.column);
  const index = pieces.findIndex((piece) =>
    listHakoiriMusumePieceCells(piece).some((cell) => {
      const position = getHakoiriMusumeCellPosition(cell);
      return position.row === row && position.column === column;
    }),
  );
  return index === -1 ? null : index;
}

/**
 * 盤面。駒を押してなぞると、指のいるマスが隣で空いているときだけ、駒が1マスずつついて行く。なぞったまま角を曲がれる。
 * 駒の占めるマスのどこを押してもその駒をつかむ。ふさがれた向きへ押し込んでも駒は動かず、ほかの駒を回り込まない。
 * 盤面は Pointer Events だけで受け、ページのスクロールや長押しのメニューに指を奪わせない。
 * 駒のボタンはキーボードと支援技術から動かす受け口で、矢印キーでその駒を1マス動かす。
 */
export function HakoiriMusumeBoard({
  pieces,
  clearing,
  interactionDisabled,
  onMovePiece,
  onClearAnimationComplete,
}: HakoiriMusumeBoardProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<PieceDrag | null>(null);
  const daughterIndex = pieces.findIndex((piece) => piece.kind === "daughter");

  useEffect(() => {
    if (!clearing) {
      return;
    }
    const daughter = surfaceRef.current?.querySelector<HTMLElement>(
      `[data-piece-index="${daughterIndex}"]`,
    );
    return playDaughterExit(daughter ?? null, onClearAnimationComplete);
  }, [clearing, daughterIndex, onClearAnimationComplete]);

  function toPoint(
    event: ReactPointerEvent<HTMLElement>,
  ): HakoiriMusumeAnchorPoint {
    const rect = event.currentTarget.getBoundingClientRect();
    return toBoxCellPoint(
      (event.clientX - rect.left) / rect.width,
      (event.clientY - rect.top) / rect.height,
    );
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const isMainButton = event.pointerType !== "mouse" || event.button === 0;
    if (
      interactionDisabled ||
      !event.isPrimary ||
      !isMainButton ||
      dragRef.current
    ) {
      return;
    }
    const point = toPoint(event);
    const pieceIndex = findPieceAt(pieces, point);
    if (pieceIndex === null) {
      return;
    }
    // 押した駒のボタンへ focus を移さず、マウスの選択やドラッグも始めない。
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const piece = pieces[pieceIndex]!;
    const origin = getHakoiriMusumeCellPosition(piece.cell);
    dragRef.current = {
      pointerId: event.pointerId,
      pieceIndex,
      kind: piece.kind,
      canPlace: createHakoiriMusumePlacementCheck({ pieces }, pieceIndex),
      origin,
      downPoint: point,
      trace: startHakoiriMusumeFingerTrace(origin),
    };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (drag === null || drag.pointerId !== event.pointerId) {
      return;
    }
    const point = toPoint(event);
    const anchor = {
      row: drag.origin.row + point.row - drag.downPoint.row,
      column: drag.origin.column + point.column - drag.downPoint.column,
    };
    const { trace, steps } = traceHakoiriMusumeFinger(
      drag.kind,
      drag.trace,
      anchor,
      drag.canPlace,
    );
    dragRef.current = { ...drag, trace };
    let previous = drag.trace.piece;
    for (const step of steps) {
      onMovePiece(drag.pieceIndex, findDirection(previous, step));
      previous = step;
    }
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  }

  function handlePieceKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    pieceIndex: number,
  ) {
    const direction = directionByArrowKey[event.key];
    if (
      interactionDisabled ||
      direction === undefined ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey
    ) {
      return;
    }
    event.preventDefault();
    onMovePiece(pieceIndex, direction);
  }

  return (
    <div
      ref={surfaceRef}
      role="group"
      aria-label={`${HAKOIRI_MUSUME_DISPLAY_NAME}盤面`}
      className="size-full touch-none select-none [-webkit-touch-callout:none]"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onLostPointerCapture={handlePointerEnd}
      onContextMenu={(event) => event.preventDefault()}
    >
      <HakoiriMusumeBox>
        {pieces.map((piece, pieceIndex) => {
          const position = getHakoiriMusumeCellPosition(piece.cell);
          return (
            <button
              // biome-ignore lint/suspicious/noArrayIndexKey: 駒の番号は問題の駒の順のまま変わらず、動いた駒を同じ要素のまま滑らせる
              key={pieceIndex}
              type="button"
              data-piece-index={pieceIndex}
              aria-label={`${hakoiriMusumePieceLabels[piece.kind]} ${position.row + 1}行${position.column + 1}列`}
              disabled={interactionDisabled}
              className="absolute rounded-[2.4cqw] transition-[left,top] duration-(--duration-fast) ease-standard focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 disabled:cursor-default"
              style={toBoxStyle(
                getPieceRect(position, hakoiriMusumePieceShapes[piece.kind]),
              )}
              onKeyDown={(event) => handlePieceKeyDown(event, pieceIndex)}
            >
              <HakoiriMusumePieceFace kind={piece.kind} />
            </button>
          );
        })}
      </HakoiriMusumeBox>
    </div>
  );
}
