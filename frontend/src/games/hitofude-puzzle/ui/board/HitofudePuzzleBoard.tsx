import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { TUTORIAL_SPOTLIGHT_AREA_ATTRIBUTE } from "@/components/TutorialSpotlight";
import { HITOFUDE_PUZZLE_DISPLAY_NAME } from "@/games/hitofude-puzzle/display-name";
import type { HitofudePuzzleBlockedMove } from "@/games/hitofude-puzzle/play/use-hitofude-puzzle-play";
import {
  getHitofudePuzzleCellPosition,
  getHitofudePuzzleNeighborCell,
  type HitofudePuzzleBoard as HitofudePuzzleBoardState,
  listHitofudePuzzleCells,
} from "@/games/hitofude-puzzle/puzzle/board";
import type { HitofudePuzzleTraceStep } from "@/games/hitofude-puzzle/puzzle/transitions";
import { findArrowKeyDirection } from "@/games/hitofude-puzzle/ui/arrow-key-direction";
import { animateBlockedMove } from "@/games/hitofude-puzzle/ui/board/animate-blocked-move";
import type { HitofudePuzzleCellCue } from "@/games/hitofude-puzzle/ui/board/cell-cue";
import {
  type BoardPoint,
  findCellAt,
  listFingerSteps,
} from "@/games/hitofude-puzzle/ui/board/finger-trace";
import { animateDeadEnd } from "@/games/hitofude-puzzle/ui/board/HitofudePuzzleBoard/animate-dead-end";
import {
  findCellButton,
  HitofudePuzzleCell,
  type HitofudePuzzleCellState,
} from "@/games/hitofude-puzzle/ui/board/HitofudePuzzleBoard/HitofudePuzzleCell";
import { HitofudePuzzleFigure } from "@/games/hitofude-puzzle/ui/board/HitofudePuzzleFigure";
import { playClearTrace } from "@/games/hitofude-puzzle/ui/board/play-clear-trace";
import { cn } from "@/lib/utils";

type HitofudePuzzleBoardProps = {
  board: HitofudePuzzleBoardState;
  /** 始点から先端までに通ったマスの番号。 */
  path: readonly number[];
  isDeadEnd: boolean;
  blockedMove: HitofudePuzzleBlockedMove | null;
  solved: boolean;
  /** クリアしてから演出を終えるまで `true`。 */
  clearing: boolean;
  interactionDisabled: boolean;
  /** マスに重ねる合図。1マスに1つまで。 */
  cues?: readonly HitofudePuzzleCellCue[];
  /** チュートリアルで、盤面の中だけを薄く覆い、元の明るさで残すマス。`null` なら覆わない。通常のプレイでは渡さない。 */
  spotlitCells?: readonly number[] | null;
  /**
   * 左から何列のマスを見せるか。遊び方の例で、穴だけの右の列を切り落として盤面を短く見せるときにだけ渡す。
   * 見せない列のマスは見えなくし、盤面の外と同じく、押してもなぞっても受けない。渡さなければ全部の列を見せる。
   */
  visibleColumns?: number;
  /**
   * 指でスクロールを止める範囲。渡さなければ `board`。
   * - `board`: 盤面の全体で止め、指を置いたらすぐになぞり始める。プレイ画面とチュートリアルは送らない画面なのでこれにする。
   * - `stroke-start`: なぞりが始まる所（道の先端と道のマス）だけで止め、ほかのマスの上では指で縦に送れるようにする。
   *   遊び方の例のように送る画面に置く盤面で使う。止める所は、マスが小さくても指で始められるよう 44px 四方からにする。
   *   止めないマスを指で押したときは、離したときに押した手として受け、送るために置いた指では道を変えない。
   */
  touchScrollLock?: HitofudePuzzleTouchScrollLock;
  onBeginStroke: (cell: number) => void;
  onTraceStroke: (step: HitofudePuzzleTraceStep) => void;
  onEndStroke: () => void;
  onClearAnimationComplete: () => void;
};

export type HitofudePuzzleTouchScrollLock = "board" | "stroke-start";

/** 指でスクロールを止める所の、指で始められる大きさ（px）。 */
const TOUCH_TARGET_MIN_PX = 44;

const TOUCH_LOCK_ATTRIBUTE = "data-touch-lock-cell";

/** 指を置いた所が、スクロールを止める所か。 */
function isTouchLockTarget(target: EventTarget): boolean {
  return target instanceof Element && target.hasAttribute(TOUCH_LOCK_ATTRIBUTE);
}

/** スクロールを止める所の置き場所。マスの中央を中心に、マスか 44px 四方の大きい方にする。 */
function getTouchLockStyle(size: number, cell: number): CSSProperties {
  const { row, column } = getHitofudePuzzleCellPosition(size, cell);
  const cellSide = `${100 / size}%`;
  return {
    left: `${((column + 0.5) / size) * 100}%`,
    top: `${((row + 0.5) / size) * 100}%`,
    width: `max(${cellSide}, ${TOUCH_TARGET_MIN_PX}px)`,
    height: `max(${cellSide}, ${TOUCH_TARGET_MIN_PX}px)`,
  };
}

/**
 * キーボードで盤面に入ったときに止まるマス。盤面の Tab の止まり先は1つで、普段は道の先端にする。
 * Shift と矢印キーで先端以外のマスへ移せ、先端が動くと先端へ戻る。
 */
type KeyboardFocus = {
  /** 止まり先を決めたときの先端。 */
  head: number;
  cell: number;
};

/** スクロールを止めないマスに置いた指。離すまで、送るために置いた指か押した指かが決まらない。 */
type PendingTouchPress = {
  pointerId: number;
  cell: number;
};

type FingerDrag = {
  pointerId: number;
  point: BoardPoint;
  /** 指が今いるとみなすマス。 */
  cell: number;
};

/**
 * 指・マウスでなぞると道が延び、直前のマスへ戻ると縮む。マスを押すと、道のマスならそこまで巻き戻し、
 * 先端の隣のマスなら延ばして、そのままなぞり続けられる。延ばせないマスを押しても、なぞりは始まる。
 * 押してから離すまでが待ったの1単位になる。
 * 盤面は Pointer Events だけで受け、スクロールを止める範囲（`touchScrollLock`）と長押しのメニューに指を奪わせない。
 * マスのボタンはキーボードと支援技術から押す受け口で、ポインターの押下は受けない。
 * 矢印キーは先端を動かす操作（プレイ画面が受ける）なので、Tab の止まり先は先端のマス1つにし、
 * マスの間を移るのは Shift と矢印キーにする。先端が動くと、盤面にあるフォーカスも先端へ移す。
 */
export function HitofudePuzzleBoard({
  board,
  path,
  isDeadEnd,
  blockedMove,
  solved,
  clearing,
  interactionDisabled,
  cues = [],
  spotlitCells = null,
  visibleColumns = board.size,
  touchScrollLock = "board",
  onBeginStroke,
  onTraceStroke,
  onEndStroke,
  onClearAnimationComplete,
}: HitofudePuzzleBoardProps) {
  const { size } = board;
  const figureRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<FingerDrag | null>(null);
  const pendingTouchPressRef = useRef<PendingTouchPress | null>(null);
  const holes = new Set(board.holes);
  const visited = new Set(path);
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
      animateBlockedMove(figureRef.current, blockedMove);
    }
  }, [blockedMove]);

  // 行き止まりになった瞬間にだけ先端を膨らませる。最初から行き止まりの盤面（遊び方の例）は、触る前は動かさない。
  const wasDeadEndRef = useRef(isDeadEnd);
  useLayoutEffect(() => {
    const becameDeadEnd = isDeadEnd && !wasDeadEndRef.current;
    wasDeadEndRef.current = isDeadEnd;
    if (becameDeadEnd) {
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

  function isCellShown(cell: number): boolean {
    return getHitofudePuzzleCellPosition(size, cell).column < visibleColumns;
  }

  function getCellState(cell: number): HitofudePuzzleCellState {
    if (holes.has(cell)) return "hole";
    return visited.has(cell) ? "visited" : "unvisited";
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
    if (cell === null || !isCellShown(cell)) {
      return;
    }
    // 押したマスのボタンへ focus を移さず、マウスの選択やドラッグも始めない。
    event.preventDefault();
    if (
      event.pointerType === "touch" &&
      touchScrollLock === "stroke-start" &&
      !isTouchLockTarget(event.target)
    ) {
      pendingTouchPressRef.current = { pointerId: event.pointerId, cell };
      return;
    }
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
      if (isCellShown(step.to)) {
        onTraceStroke(step);
      }
    }
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const pending = pendingTouchPressRef.current;
    if (pending?.pointerId === event.pointerId) {
      pendingTouchPressRef.current = null;
      pressCell(pending.cell);
      return;
    }
    handlePointerEnd(event);
  }

  // 送り始めると、ブラウザが指を取って pointercancel を送るので、置いた指を押しとして受けない。
  function handlePointerCancel(event: ReactPointerEvent<HTMLDivElement>) {
    if (pendingTouchPressRef.current?.pointerId === event.pointerId) {
      pendingTouchPressRef.current = null;
      return;
    }
    handlePointerEnd(event);
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
    const neighbor = getHitofudePuzzleNeighborCell(
      size,
      focusableCell,
      direction,
    );
    if (neighbor !== null && isCellShown(neighbor)) {
      moveKeyboardFocus(neighbor);
    }
  }

  function pressCell(cell: number) {
    onBeginStroke(cell);
    onEndStroke();
  }

  // 受け付けない盤面（解き終えた例など）ではなぞりが始まらないので、指のスクロールを止めない。
  const touchLockCells =
    touchScrollLock === "stroke-start" && !interactionDisabled
      ? path.filter((cell) => isCellShown(cell))
      : [];

  return (
    <div
      ref={boardRef}
      role="group"
      aria-label={`${HITOFUDE_PUZZLE_DISPLAY_NAME}盤面 ${size}行${visibleColumns}列`}
      {...(spotlitCells !== null && {
        [TUTORIAL_SPOTLIGHT_AREA_ATTRIBUTE]: "",
      })}
      className={cn(
        "relative size-full select-none [-webkit-touch-callout:none]",
        touchScrollLock === "board" && "touch-none",
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onLostPointerCapture={handlePointerEnd}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={handleKeyDown}
    >
      <HitofudePuzzleFigure
        ref={figureRef}
        board={board}
        path={path}
        isDeadEnd={isDeadEnd}
        solved={solved}
        blockedCell={blockedMove?.cell ?? null}
      />
      <div
        className="relative grid size-full"
        style={{
          gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${size}, minmax(0, 1fr))`,
        }}
      >
        {listHitofudePuzzleCells(size).map((cell) => (
          <HitofudePuzzleCell
            key={cell}
            size={size}
            cell={cell}
            state={getCellState(cell)}
            isStart={cell === board.start}
            isHead={cell === head}
            isDeadEnd={cell === head && isDeadEnd}
            disabled={interactionDisabled}
            isTabStop={cell === focusableCell}
            cue={cues.find((cue) => cue.cell === cell)}
            spotlit={spotlitCells?.includes(cell) ?? false}
            shown={isCellShown(cell)}
            onPress={pressCell}
            onFocus={(focusedCell) =>
              setKeyboardFocus({ head, cell: focusedCell })
            }
          />
        ))}
      </div>
      {touchLockCells.map((cell) => (
        <span
          key={cell}
          aria-hidden="true"
          {...{ [TOUCH_LOCK_ATTRIBUTE]: cell }}
          className="absolute -translate-1/2 touch-none"
          style={getTouchLockStyle(size, cell)}
        />
      ))}
    </div>
  );
}
