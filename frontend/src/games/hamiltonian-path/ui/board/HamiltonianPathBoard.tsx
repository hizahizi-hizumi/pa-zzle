import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { HAMILTONIAN_PATH_DISPLAY_NAME } from "@/games/hamiltonian-path/display-name";
import type { HamiltonianPathBlockedMove } from "@/games/hamiltonian-path/play/use-hamiltonian-path-play";
import {
  getHamiltonianPathNeighborCell,
  type HamiltonianPathBoard as HamiltonianPathBoardState,
  type HamiltonianPathDirection,
  hamiltonianPathDirections,
  hasHamiltonianPathPartition,
  listHamiltonianPathCells,
} from "@/games/hamiltonian-path/puzzle/board";
import type { HamiltonianPathTraceStep } from "@/games/hamiltonian-path/puzzle/transitions";
import { findArrowKeyDirection } from "@/games/hamiltonian-path/ui/arrow-key-direction";
import {
  type BoardPoint,
  findCellAt,
  listFingerSteps,
} from "@/games/hamiltonian-path/ui/board/finger-trace";
import { animateBlockedMove } from "@/games/hamiltonian-path/ui/board/HamiltonianPathBoard/animate-blocked-move";
import { animateDeadEnd } from "@/games/hamiltonian-path/ui/board/HamiltonianPathBoard/animate-dead-end";
import {
  findCellButton,
  HamiltonianPathCell,
  type HamiltonianPathCellState,
} from "@/games/hamiltonian-path/ui/board/HamiltonianPathBoard/HamiltonianPathCell";
import { playClearTrace } from "@/games/hamiltonian-path/ui/board/HamiltonianPathBoard/play-clear-trace";
import { HamiltonianPathFigure } from "@/games/hamiltonian-path/ui/board/HamiltonianPathFigure";

type HamiltonianPathBoardProps = {
  board: HamiltonianPathBoardState;
  /** 始点から先端までに通ったマスの番号。 */
  path: readonly number[];
  isDeadEnd: boolean;
  /** 取り残しとして知らせるマス。 */
  strandedCells: readonly number[];
  blockedMove: HamiltonianPathBlockedMove | null;
  /** 道が全マスを通り終えたか。 */
  solved: boolean;
  /** クリアしてから演出を終えるまで `true`。 */
  clearing: boolean;
  interactionDisabled: boolean;
  onBeginStroke: (cell: number) => void;
  onTraceStroke: (step: HamiltonianPathTraceStep) => void;
  onEndStroke: () => void;
  onClearAnimationComplete: () => void;
};

/**
 * キーボードで盤面に入ったときに止まるマス。盤面の Tab の止まり先は1つで、普段は道の先端にする。
 * Shift と矢印キーで先端以外のマスへ移せ、先端が動くと先端へ戻る。
 */
type KeyboardFocus = {
  /** 止まり先を決めたときの先端。 */
  head: number;
  cell: number;
};

type FingerDrag = {
  pointerId: number;
  point: BoardPoint;
  /** 指が今いるとみなすマス。 */
  cell: number;
};

/**
 * 盤面。指・マウスでなぞると道が延び、直前のマスへ戻ると縮む。マスを押すと、道のマスならそこまで巻き戻し、
 * 先端の隣のマスなら延ばして、そのままなぞり続けられる。延ばせないマスを押しても、なぞりは始まる。
 * 押してから離すまでが待ったの1単位になる。
 * 盤面は Pointer Events だけで受け、ページのスクロールや長押しのメニューに指を奪わせない。
 * マスのボタンはキーボードと支援技術から押す受け口で、ポインターの押下は受けない。
 * 矢印キーは先端を動かす操作（プレイ画面が受ける）なので、Tab の止まり先は先端のマス1つにし、
 * マスの間を移るのは Shift と矢印キーにする。先端が動くと、盤面にあるフォーカスも先端へ移す。
 */
export function HamiltonianPathBoard({
  board,
  path,
  isDeadEnd,
  strandedCells,
  blockedMove,
  solved,
  clearing,
  interactionDisabled,
  onBeginStroke,
  onTraceStroke,
  onEndStroke,
  onClearAnimationComplete,
}: HamiltonianPathBoardProps) {
  const { size } = board;
  const figureRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<FingerDrag | null>(null);
  const walls = new Set(board.walls);
  const visited = new Set(path);
  const stranded = new Set(strandedCells);
  const head = path.at(-1) ?? board.start;
  const pathLength = path.length;
  const boardRef = useRef<HTMLDivElement>(null);
  const [keyboardFocus, setKeyboardFocus] = useState<KeyboardFocus>({
    head,
    cell: head,
  });
  const focusableCell = keyboardFocus.head === head ? keyboardFocus.cell : head;

  useEffect(() => {
    const boardElement = boardRef.current;
    if (!boardElement?.contains(document.activeElement)) {
      return;
    }
    findCellButton(boardElement, head)?.focus();
  }, [head]);

  useLayoutEffect(() => {
    if (blockedMove !== null) {
      animateBlockedMove(figureRef.current, size, blockedMove);
    }
  }, [blockedMove, size]);

  useLayoutEffect(() => {
    if (isDeadEnd) {
      animateDeadEnd(figureRef.current);
    }
  }, [isDeadEnd]);

  useEffect(() => {
    if (!clearing) {
      return;
    }
    return playClearTrace(
      figureRef.current,
      pathLength,
      onClearAnimationComplete,
    );
  }, [clearing, onClearAnimationComplete, pathLength]);

  function getCellState(cell: number): HamiltonianPathCellState {
    if (walls.has(cell)) return "wall";
    return visited.has(cell) ? "visited" : "unvisited";
  }

  function listPartitionDirections(cell: number): HamiltonianPathDirection[] {
    return hamiltonianPathDirections.filter((direction) => {
      const neighbor = getHamiltonianPathNeighborCell(size, cell, direction);
      return (
        neighbor !== null && hasHamiltonianPathPartition(board, cell, neighbor)
      );
    });
  }

  function toBoardPoint(event: ReactPointerEvent<HTMLElement>): BoardPoint {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * size,
      y: ((event.clientY - rect.top) / rect.height) * size,
    };
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
    const point = toBoardPoint(event);
    const cell = findCellAt(size, point);
    if (cell === null) {
      return;
    }
    // 押したマスのボタンへ focus を移さず、マウスの選択やドラッグも始めない。
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, point, cell };
    onBeginStroke(cell);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (drag === null || drag.pointerId !== event.pointerId) {
      return;
    }
    const point = toBoardPoint(event);
    const { steps, cell } = listFingerSteps(size, drag.point, point, drag.cell);
    dragRef.current = { ...drag, point, cell };
    for (const step of steps) {
      onTraceStroke(step);
    }
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) {
      return;
    }
    dragRef.current = null;
    onEndStroke();
  }

  function moveKeyboardFocus(cell: number) {
    setKeyboardFocus({ head, cell });
    if (boardRef.current) {
      findCellButton(boardRef.current, cell)?.focus();
    }
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const direction = findArrowKeyDirection(event.key);
    if (
      interactionDisabled ||
      direction === null ||
      !event.shiftKey ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    ) {
      return;
    }
    event.preventDefault();
    const neighbor = getHamiltonianPathNeighborCell(
      size,
      focusableCell,
      direction,
    );
    if (neighbor !== null) {
      moveKeyboardFocus(neighbor);
    }
  }

  function pressCell(cell: number) {
    onBeginStroke(cell);
    onEndStroke();
  }

  return (
    <div
      ref={boardRef}
      role="group"
      aria-label={`${HAMILTONIAN_PATH_DISPLAY_NAME}盤面`}
      className="relative size-full touch-none select-none [-webkit-touch-callout:none]"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onLostPointerCapture={handlePointerEnd}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={handleKeyDown}
    >
      <HamiltonianPathFigure
        ref={figureRef}
        board={board}
        path={path}
        isDeadEnd={isDeadEnd}
        solved={solved}
        strandedCells={strandedCells}
        blockedCell={blockedMove?.cell ?? null}
      />
      <div
        className="relative grid size-full"
        style={{
          gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${size}, minmax(0, 1fr))`,
        }}
      >
        {listHamiltonianPathCells(size).map((cell) => (
          <HamiltonianPathCell
            key={cell}
            size={size}
            cell={cell}
            state={getCellState(cell)}
            isStart={cell === board.start}
            isHead={cell === head}
            isDeadEnd={cell === head && isDeadEnd}
            isStranded={stranded.has(cell)}
            partitionDirections={listPartitionDirections(cell)}
            disabled={interactionDisabled}
            focusable={cell === focusableCell}
            onPress={pressCell}
            onFocus={(focusedCell) =>
              setKeyboardFocus({ head, cell: focusedCell })
            }
          />
        ))}
      </div>
    </div>
  );
}
