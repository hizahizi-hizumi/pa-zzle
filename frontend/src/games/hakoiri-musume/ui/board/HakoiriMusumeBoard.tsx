import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { TutorialCue } from "@/components/TutorialCue";
import { TutorialSpotlight } from "@/components/TutorialSpotlight";
import { HAKOIRI_MUSUME_DISPLAY_NAME } from "@/games/hakoiri-musume/display-name";
import {
  getHakoiriMusumeCell,
  getHakoiriMusumeCellPosition,
  HAKOIRI_MUSUME_COLUMNS,
  HAKOIRI_MUSUME_ROWS,
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
  hakoiriMusumeStepByDirection,
} from "@/games/hakoiri-musume/puzzle/rules";
import {
  BOX_WIDTH_CELLS,
  getPieceRect,
  toBoxCellPoint,
  toBoxStyle,
} from "@/games/hakoiri-musume/ui/board/board-geometry";
import {
  findHakoiriMusumeFlickDirection,
  type HakoiriMusumeAnchorPoint,
  type HakoiriMusumeFingerTrace,
  type HakoiriMusumeLeanAxis,
  type HakoiriMusumeTimedPoint,
  leanHakoiriMusumePieceTowardFinger,
  startHakoiriMusumeFingerTrace,
  traceHakoiriMusumeFinger,
} from "@/games/hakoiri-musume/ui/board/finger-trace";
import {
  type DaughterHeldLook,
  playDaughterExit,
  RESTING_DAUGHTER_LOOK,
} from "@/games/hakoiri-musume/ui/board/HakoiriMusumeBoard/play-daughter-exit";
import { HakoiriMusumeBox } from "@/games/hakoiri-musume/ui/board/HakoiriMusumeBox";
import { HakoiriMusumePieceFace } from "@/games/hakoiri-musume/ui/board/HakoiriMusumePieceFace";
import type { HakoiriMusumePieceCue } from "@/games/hakoiri-musume/ui/board/piece-cue";
import { LIFTED_PIECE_SHADOW } from "@/games/hakoiri-musume/ui/hakoiri-musume-tone";
import { MOTION_EASING, prefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

type HakoiriMusumeBoardProps = {
  pieces: readonly HakoiriMusumePiece[];
  /** クリアしてから演出を終えるまで `true`。 */
  clearing: boolean;
  interactionDisabled: boolean;
  /**
   * 駒を順に動かす。なぞりの1回の指の動きで駒が続けて移ったときは、その向きをまとめて渡す。矢印キーと弾いた手では1つ。
   */
  onMovePiece: (
    pieceIndex: number,
    directions: readonly HakoiriMusumeDirection[],
  ) => void;
  onClearAnimationComplete: () => void;
  /** チュートリアルで駒に重ねる印と合図。本番では渡さない。 */
  cues?: readonly HakoiriMusumePieceCue[];
  /** チュートリアルで手を引く間、画面全体の覆いから抜いて元の明るさで見せる駒の番号。本番では渡さない。 */
  spotlitPieceIndices?: readonly number[];
  /** チュートリアルで手を引く間、覆いから抜いて見せる空きマス（行き先）。本番では渡さない。 */
  spotlitCells?: readonly number[];
  /** なぞっている指が隣のマスへ移ったのに、ふさがれて駒がついて行けなかったときに呼ぶ。チュートリアルだけが渡す。 */
  onPushBlocked?: (
    pieceIndex: number,
    direction: HakoiriMusumeDirection,
  ) => void;
};

/** なぞっている駒と、押したときの指の位置。`startPieces` は押したときの盤面。 */
type PieceDrag = {
  pointerId: number;
  pieceIndex: number;
  startPieces: readonly HakoiriMusumePiece[];
  kind: HakoiriMusumePieceKind;
  canPlace: HakoiriMusumePlacementCheck;
  origin: HakoiriMusumeCellPosition;
  downPoint: HakoiriMusumeAnchorPoint;
  trace: HakoiriMusumeFingerTrace;
  /** 押した時刻の、駒の左上に置き直した指の位置。 */
  down: HakoiriMusumeTimedPoint;
  /** 最近読んだ指の位置（駒の左上に置き直した点）を古い順に。弾いた手の速さを測る。 */
  recentPath: HakoiriMusumeTimedPoint[];
  surfaceRect: DOMRect;
};

/** 押したときから盤面の位置か大きさがこれ以上変わったら、指の位置をマスへ読み替えられないので、なぞりをやめる（px）。 */
const SURFACE_SHIFT_TOLERANCE_PX = 1;

function hasSurfaceShifted(start: DOMRect, now: DOMRect): boolean {
  return (
    Math.abs(start.left - now.left) > SURFACE_SHIFT_TOLERANCE_PX ||
    Math.abs(start.top - now.top) > SURFACE_SHIFT_TOLERANCE_PX ||
    Math.abs(start.width - now.width) > SURFACE_SHIFT_TOLERANCE_PX ||
    Math.abs(start.height - now.height) > SURFACE_SHIFT_TOLERANCE_PX
  );
}

/**
 * つかんでいる駒。`anchor` は指の位置を駒の左上に置き直した点、`tracedPiece` はなぞりで駒が着いたとみなすマス。
 * 盤面の駒が `tracedPiece` にあるときだけ、駒を指へ寄せて見せる。`leanAxis` は今寄せている向き。
 */
type HeldPiece = {
  pieceIndex: number;
  anchor: HakoiriMusumeAnchorPoint;
  tracedPiece: HakoiriMusumeCellPosition;
  canPlace: HakoiriMusumePlacementCheck;
  leanAxis: HakoiriMusumeLeanAxis | null;
};

/** 寄せる向きが替わったときに、前の向きの寄せから新しい向きの寄せへ移す長さ。1マスを移る動きより少し長く、跳んで見えない長さ。 */
const LEAN_AXIS_SWITCH_MS = 80;

/** 1マスの幅（箱の外形の幅に対する cqw）。 */
const CELL_CQW = 100 / BOX_WIDTH_CELLS;

/** つかんだ駒を持ち上げて見せる大きさ。`scale-[1.04]` と同じ値。 */
const LIFTED_PIECE_SCALE = "1.04";

/** 弾いた手の速さを測るのに残す、指の位置の数。 */
const FLICK_PATH_LENGTH = 16;

/**
 * 持ち上げて大きく見せるときの、大きくする中心（`transform-origin`）。箱の壁に接した辺を動かさずに大きくして、
 * 持ち上げた駒が箱の縁へはみ出さないようにする。
 */
function getLiftOrigin(
  { row, column }: HakoiriMusumeCellPosition,
  kind: HakoiriMusumePieceKind,
): string {
  const { columns, rows } = hakoiriMusumePieceShapes[kind];
  const toPercent = (offset: number, room: number) =>
    room === 0 ? 50 : (offset / room) * 100;
  return `${toPercent(column, HAKOIRI_MUSUME_COLUMNS - columns)}% ${toPercent(row, HAKOIRI_MUSUME_ROWS - rows)}%`;
}

/**
 * 指を離した駒がマスへ収まる動きの長さ。行き過ぎて少し戻る。娘は大きく重い駒なので、遅く収める。
 */
const PIECE_SETTLE_MS = { daughter: 240, other: 170 } as const;

/** 収まるときに行き過ぎる距離（マス幅に対する割合）。数 px で戻る。 */
const PIECE_SETTLE_OVERSHOOT = 0.035;

function toTranslate({ row, column }: HakoiriMusumeAnchorPoint): string {
  return `${column * CELL_CQW}cqw ${row * CELL_CQW}cqw`;
}

/**
 * 駒が隣のマスへ移る動きの長さ。指が隣のマスへ入ってから駒が着くまでを 0.1 秒ほどに収めて、速くなぞっても駒が指に遅れて
 * 見えないようにし、マスを飛び移ったようには見えない長さを残す。
 */
const PIECE_STEP_MS = 60;

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

function isSamePosition(
  left: HakoiriMusumeCellPosition,
  right: HakoiriMusumeCellPosition,
): boolean {
  return left.row === right.row && left.column === right.column;
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
 * 盤面が、なぞりで動かした駒のほかは押したときのままで、なぞっている駒がなぞりの追った位置にあるか。
 * 待った・盤面を戻すなど、なぞり以外で盤面が変わっていれば `false`。
 */
function isBoardFollowingDrag(
  pieces: readonly HakoiriMusumePiece[],
  drag: PieceDrag,
): boolean {
  const { row, column } = drag.trace.piece;
  return pieces.every((piece, index) =>
    index === drag.pieceIndex
      ? piece.cell === getHakoiriMusumeCell({ row, column })
      : piece.cell === drag.startPieces[index]!.cell,
  );
}

/**
 * 盤面。駒を押してなぞると、指のいるマスが隣で空いているときだけ、駒が1マスずつついて行く。なぞったまま角を曲がれる。
 * 駒をマスへ移さないまま空いた向きへ速く弾いて離すと、その向きへ1マス動かす。
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
  cues = [],
  spotlitPieceIndices = [],
  spotlitCells = [],
  onPushBlocked,
}: HakoiriMusumeBoardProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<PieceDrag | null>(null);
  /** 寄せる向きが替わったときに、前の向きの寄せから移している動き。 */
  const leanEaseRef = useRef<Animation | null>(null);
  /**
   * 弾いて1マス動かした駒と、動かした先のマスから見た、弾く前に見せていた位置のずれ。弾いた手でクリアしたときに、娘をその位置から
   * 出口の前へ収めるのに使う。次に駒を押すまで残す。
   */
  const flickedLeanRef = useRef<{
    pieceIndex: number;
    lean: HakoiriMusumeAnchorPoint;
  } | null>(null);
  const [held, setHeld] = useState<HeldPiece | null>(null);
  const daughterIndex = pieces.findIndex((piece) => piece.kind === "daughter");

  // なぞりの途中で盤面がなぞり以外の操作で変わったら、押したときの盤面で作った置き場所の判定が使えないので、なぞりをやめる。
  useLayoutEffect(() => {
    const drag = dragRef.current;
    if (drag && !isBoardFollowingDrag(pieces, drag)) {
      dragRef.current = null;
    }
  }, [pieces]);

  // なぞりの途中でメニューやダイアログが開いてフォーカスが盤面の外へ移ったら、なぞりをやめる。
  const dragging = held !== null;
  useEffect(() => {
    if (!dragging) {
      return;
    }
    function handleFocusIn(event: FocusEvent) {
      if (
        event.target instanceof Node &&
        !surfaceRef.current?.contains(event.target)
      ) {
        dragRef.current = null;
        setHeld(null);
      }
    }
    document.addEventListener("focusin", handleFocusIn);
    return () => document.removeEventListener("focusin", handleFocusIn);
  }, [dragging]);

  // クリアしたときにつかんでいた娘は、指へ寄せて見せていた姿から収めるので、そのときの寄せと持ち上げを読んでなぞりを終える。
  const startDaughterExit = useEffectEvent(() => {
    const surface = surfaceRef.current;
    const find = (selector: string) =>
      surface?.querySelector<HTMLElement>(selector) ?? null;
    const heldDaughter = held?.pieceIndex === daughterIndex ? held : null;
    const flicked = flickedLeanRef.current;
    dragRef.current = null;
    flickedLeanRef.current = null;
    setHeld(null);
    let look: DaughterHeldLook | null = null;
    if (heldDaughter) {
      look = {
        lean: toTranslate(findLean(heldDaughter)),
        scale: LIFTED_PIECE_SCALE,
        boxShadow: LIFTED_PIECE_SHADOW,
      };
    } else if (flicked?.pieceIndex === daughterIndex) {
      look = {
        lean: toTranslate(flicked.lean),
        scale: RESTING_DAUGHTER_LOOK.scale,
        boxShadow: RESTING_DAUGHTER_LOOK.boxShadow,
      };
    }
    return playDaughterExit(
      {
        daughter: find(`[data-piece-index="${daughterIndex}"]`),
        box: find("[data-box]"),
        exitLight: find("[data-box-exit-light]"),
      },
      look,
      onClearAnimationComplete,
    );
  });

  // 盤面にクリアした姿を描く前に演出を始め、クリアの音と同じ時刻から刻む。
  useLayoutEffect(() => {
    if (!clearing) {
      return;
    }
    return startDaughterExit();
  }, [clearing]);

  function toPoint(
    event: ReactPointerEvent<HTMLElement>,
  ): HakoiriMusumeAnchorPoint {
    const rect = event.currentTarget.getBoundingClientRect();
    return toBoxCellPoint(
      (event.clientX - rect.left) / rect.width,
      (event.clientY - rect.top) / rect.height,
    );
  }

  // 盤面の最初の指だけを受ける。盤面の外に別の指が触れていても（その指が primary でも）、盤面に触れた指でなぞれる。
  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const isMainButton = event.pointerType !== "mouse" || event.button === 0;
    if (interactionDisabled || !isMainButton || dragRef.current) {
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
    const canPlace = createHakoiriMusumePlacementCheck({ pieces }, pieceIndex);
    flickedLeanRef.current = null;
    dragRef.current = {
      pointerId: event.pointerId,
      pieceIndex,
      startPieces: pieces,
      kind: piece.kind,
      canPlace,
      origin,
      downPoint: point,
      trace: startHakoiriMusumeFingerTrace(origin),
      down: { ...origin, timeMs: event.timeStamp },
      recentPath: [],
      surfaceRect: event.currentTarget.getBoundingClientRect(),
    };
    setHeld({
      pieceIndex,
      anchor: origin,
      tracedPiece: origin,
      canPlace,
      leanAxis: null,
    });
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (drag === null || drag.pointerId !== event.pointerId) {
      return;
    }
    followFinger(drag, event);
  }

  /**
   * なぞっている駒を、`event` の指の位置までたどらせる。盤面が動いていたら、なぞりをやめて `null` を返す。
   * たどった後のなぞりを返す。
   */
  function followFinger(
    drag: PieceDrag,
    event: ReactPointerEvent<HTMLDivElement>,
  ): PieceDrag | null {
    // なぞりの途中で画面の回転やバーの出入りで盤面が動いたら、指の位置を同じマスへ読み替えられないので、なぞりをやめる。
    if (
      hasSurfaceShifted(
        drag.surfaceRect,
        event.currentTarget.getBoundingClientRect(),
      )
    ) {
      endDrag();
      return null;
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
    const followed = {
      ...drag,
      trace,
      recentPath: [
        ...drag.recentPath.slice(1 - FLICK_PATH_LENGTH),
        { ...anchor, timeMs: event.timeStamp },
      ],
    };
    dragRef.current = followed;
    const previous = held?.pieceIndex === drag.pieceIndex ? held : null;
    const { lean, axis } = leanHakoiriMusumePieceTowardFinger(
      trace.piece,
      anchor,
      drag.canPlace,
      previous?.leanAxis ?? null,
    );
    if (previous) {
      easeLeanSwitch(drag, previous, trace.piece, lean, axis);
    }
    setHeld((current) =>
      current?.pieceIndex === drag.pieceIndex
        ? { ...current, anchor, tracedPiece: trace.piece, leanAxis: axis }
        : current,
    );
    const fingerMoved =
      trace.finger.row !== drag.trace.finger.row ||
      trace.finger.column !== drag.trace.finger.column;
    if (
      onPushBlocked &&
      fingerMoved &&
      steps.length === 0 &&
      (trace.finger.row !== trace.piece.row ||
        trace.finger.column !== trace.piece.column)
    ) {
      onPushBlocked(drag.pieceIndex, findDirection(trace.piece, trace.finger));
    }
    if (steps.length > 0) {
      const directions = steps.map((step, index) =>
        findDirection(steps[index - 1] ?? drag.trace.piece, step),
      );
      onMovePiece(drag.pieceIndex, directions);
    }
    return followed;
  }

  /**
   * 寄せる向きが替わったときに、前の向きの寄せを1フレームで消さず、新しい向きの寄せへ短く移す。移している途中に駒が隣のマスへ
   * 移ったときも、見えている位置から移し直す。移す間に指が動いた分は、移し終えたときに追いつく。
   */
  function easeLeanSwitch(
    drag: PieceDrag,
    previous: HeldPiece,
    piece: HakoiriMusumeCellPosition,
    lean: HakoiriMusumeAnchorPoint,
    axis: HakoiriMusumeLeanAxis | null,
  ) {
    const running = leanEaseRef.current?.playState === "running";
    const axisChanged =
      previous.leanAxis !== null && previous.leanAxis !== axis;
    const cellMoved = !isSamePosition(previous.tracedPiece, piece);
    if (!axisChanged && !(running && cellMoved)) {
      return;
    }
    const element = surfaceRef.current?.querySelector<HTMLElement>(
      `[data-piece-index="${drag.pieceIndex}"]`,
    );
    if (!element?.animate || prefersReducedMotion()) {
      return;
    }
    // 今見えている位置（移している途中ならその途中の位置）を、今のマスから見たずれに置き直して、そこから移す。
    const cellPx = drag.surfaceRect.width / BOX_WIDTH_CELLS;
    const shift = {
      row: previous.tracedPiece.row - piece.row,
      column: previous.tracedPiece.column - piece.column,
    };
    let from: string;
    if (running) {
      const [x = 0, y = 0] = getComputedStyle(element)
        .translate.split(" ")
        .map((value) => Number.parseFloat(value) || 0);
      from = `${x + shift.column * cellPx}px ${y + shift.row * cellPx}px`;
      leanEaseRef.current?.cancel();
    } else {
      const previousLean = findLean(previous);
      from = toTranslate({
        row: previousLean.row + shift.row,
        column: previousLean.column + shift.column,
      });
    }
    leanEaseRef.current = element.animate(
      [{ translate: from }, { translate: toTranslate(lean) }],
      { duration: LEAN_AXIS_SWITCH_MS, easing: MOTION_EASING.standard },
    );
  }

  /** なぞりを、駒を寄せずにやめる。 */
  function endDrag() {
    dragRef.current = null;
    setHeld(null);
  }

  /** 指を離した駒を、寄せて見せていた所からマスへ収める。行き過ぎて少し戻る。 */
  function settlePiece(pieceIndex: number, lean: HakoiriMusumeAnchorPoint) {
    const element = surfaceRef.current?.querySelector<HTMLElement>(
      `[data-piece-index="${pieceIndex}"]`,
    );
    if (
      !element?.animate ||
      prefersReducedMotion() ||
      (lean.row === 0 && lean.column === 0)
    ) {
      return;
    }
    const overshoot = {
      row: -Math.sign(lean.row) * PIECE_SETTLE_OVERSHOOT,
      column: -Math.sign(lean.column) * PIECE_SETTLE_OVERSHOOT,
    };
    element.animate(
      [
        { translate: toTranslate(lean) },
        { translate: toTranslate(overshoot), offset: 0.6 },
        { translate: toTranslate({ row: 0, column: 0 }) },
      ],
      {
        duration:
          pieces[pieceIndex]?.kind === "daughter"
            ? PIECE_SETTLE_MS.daughter
            : PIECE_SETTLE_MS.other,
        easing: "ease-out",
      },
    );
  }

  /** 指を離した。離した位置までたどってから、駒を動かさずに離したなら、弾いた手かを見る。 */
  /**
   * 弾いて1マス動かした駒を、寄せて見せていた所から隣のマスへ移す。マスを移る動き（`left`・`top`）と同じ長さと緩急で寄せを
   * 0 へ戻し、寄せていた所から隣のマスまでをひと続きに見せる。
   */
  function slideFromLean(pieceIndex: number, lean: HakoiriMusumeAnchorPoint) {
    const element = surfaceRef.current?.querySelector<HTMLElement>(
      `[data-piece-index="${pieceIndex}"]`,
    );
    if (!element?.animate || prefersReducedMotion()) {
      return;
    }
    element.animate(
      [
        { translate: toTranslate(lean) },
        { translate: toTranslate({ row: 0, column: 0 }) },
      ],
      { duration: PIECE_STEP_MS, easing: MOTION_EASING.enter },
    );
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (drag?.pointerId !== event.pointerId) {
      return;
    }
    const released = followFinger(drag, event);
    if (released === null) {
      return;
    }
    dragRef.current = null;
    const unmoved =
      released.trace.piece.row === released.origin.row &&
      released.trace.piece.column === released.origin.column;
    const flick = unmoved
      ? findHakoiriMusumeFlickDirection(released.down, released.recentPath)
      : null;
    const flickStep = flick && hakoiriMusumeStepByDirection[flick];
    if (
      flick &&
      flickStep &&
      released.canPlace({
        row: released.origin.row + flickStep.row,
        column: released.origin.column + flickStep.column,
      })
    ) {
      const lean = held ? findLean(held) : { row: 0, column: 0 };
      if (held) {
        slideFromLean(held.pieceIndex, lean);
      }
      flickedLeanRef.current = {
        pieceIndex: released.pieceIndex,
        lean: {
          row: lean.row - flickStep.row,
          column: lean.column - flickStep.column,
        },
      };
      setHeld(null);
      onMovePiece(released.pieceIndex, [flick]);
      return;
    }
    releaseHeld();
  }

  /** 指が取られた。離した位置は読めないので、駒を今のマスへ収める。 */
  function handlePointerCancel(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) {
      return;
    }
    dragRef.current = null;
    releaseHeld();
  }

  function releaseHeld() {
    if (held) {
      settlePiece(held.pieceIndex, findLean(held));
    }
    setHeld(null);
  }

  /** つかんでいる駒を指へ寄せて見せるずれ。盤面の駒がなぞりの着いたマスに無ければ寄せない。 */
  function findLean(current: HeldPiece): HakoiriMusumeAnchorPoint {
    const piece = pieces[current.pieceIndex];
    const position = piece && getHakoiriMusumeCellPosition(piece.cell);
    if (!position || !isSamePosition(position, current.tracedPiece)) {
      return { row: 0, column: 0 };
    }
    return leanHakoiriMusumePieceTowardFinger(
      position,
      current.anchor,
      current.canPlace,
      current.leanAxis,
    ).lean;
  }

  const shownHeld = interactionDisabled ? null : held;
  const heldLean = shownHeld ? findLean(shownHeld) : null;

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
    onMovePiece(pieceIndex, [direction]);
  }

  return (
    <div
      ref={surfaceRef}
      role="group"
      aria-label={`${HAKOIRI_MUSUME_DISPLAY_NAME}盤面`}
      className={cn(
        "size-full touch-none select-none [-webkit-touch-callout:none]",
        shownHeld && "cursor-grabbing",
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onLostPointerCapture={handlePointerCancel}
      onContextMenu={(event) => event.preventDefault()}
    >
      <HakoiriMusumeBox>
        {spotlitCells.map((cell) => (
          <span
            key={`cell-${cell}`}
            aria-hidden="true"
            className="pointer-events-none absolute rounded-[2.4cqw]"
            style={toBoxStyle(
              getPieceRect(
                getHakoiriMusumeCellPosition(cell),
                hakoiriMusumePieceShapes.small,
              ),
            )}
          >
            <TutorialSpotlight active className="inset-0 rounded-[inherit]" />
          </span>
        ))}
        {pieces.map((piece, pieceIndex) => {
          const position = getHakoiriMusumeCellPosition(piece.cell);
          const cue = cues.find(
            (candidate) => candidate.pieceIndex === pieceIndex,
          );
          const lifted = shownHeld?.pieceIndex === pieceIndex;
          // クリアした娘は、寄せと持ち上げを収める演出で動かすので、移る動きと持ち上げの移り変わりを重ねない。
          const exiting = clearing && pieceIndex === daughterIndex;
          return (
            <button
              // biome-ignore lint/suspicious/noArrayIndexKey: 駒の番号は問題の駒の順のまま変わらず、動いた駒を同じ要素のまま滑らせる
              key={pieceIndex}
              type="button"
              data-piece-index={pieceIndex}
              aria-label={`${hakoiriMusumePieceLabels[piece.kind]} ${position.row + 1}行${position.column + 1}列`}
              disabled={interactionDisabled}
              data-lifted={lifted || undefined}
              className={cn(
                "absolute cursor-grab rounded-[2.4cqw] ease-enter motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 disabled:cursor-default pointer-fine:hover:brightness-[1.08]",
                lifted &&
                  "z-10 scale-[1.04] cursor-grabbing motion-reduce:scale-100",
              )}
              style={{
                ...toBoxStyle(
                  getPieceRect(position, hakoiriMusumePieceShapes[piece.kind]),
                ),
                translate:
                  lifted && heldLean ? toTranslate(heldLean) : undefined,
                transformOrigin: getLiftOrigin(position, piece.kind),
                boxShadow: lifted ? LIFTED_PIECE_SHADOW : undefined,
                // つかんでいる間は、指へ寄せる見せ方とマスを移る動きが重なって戻って見えないよう、位置を動かさずに置く。
                transitionProperty: exiting
                  ? "none"
                  : lifted
                    ? "scale, box-shadow"
                    : "left, top, scale, box-shadow",
                transitionDuration: `${PIECE_STEP_MS}ms`,
              }}
              onKeyDown={(event) => handlePieceKeyDown(event, pieceIndex)}
            >
              <HakoiriMusumePieceFace
                kind={piece.kind}
                grainSeed={pieceIndex}
              />
              <TutorialSpotlight
                active={spotlitPieceIndices.includes(pieceIndex)}
                className="inset-0 rounded-[inherit]"
              />
              {cue?.kind === "mark" && (
                <TutorialCue kind="mark" recallId={cue.recallId} />
              )}
              {cue?.kind === "acknowledgement" && (
                <TutorialCue kind="acknowledgement" id={cue.id} />
              )}
            </button>
          );
        })}
      </HakoiriMusumeBox>
    </div>
  );
}
