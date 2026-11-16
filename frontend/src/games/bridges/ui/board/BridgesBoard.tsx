import {
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { TUTORIAL_SPOTLIGHT_AREA_ATTRIBUTE } from "@/components/TutorialSpotlight";

import { BRIDGES_DISPLAY_NAME } from "@/games/bridges/display-name";
import type { BridgesEdgeNotice } from "@/games/bridges/play/use-bridges-play";
import {
  type BridgesBoard as BridgesBoardState,
  type BridgesDirection,
  findBridgesEdgeToward,
  getBridgesNetwork,
} from "@/games/bridges/puzzle/board";
import {
  type BridgesIslandStatus,
  countBridgesIslandBridges,
} from "@/games/bridges/puzzle/rules";
import type { BridgeCount } from "@/games/bridges/puzzle/state";
import { cycleBridgesEdge } from "@/games/bridges/puzzle/transitions";
import { BridgesBoardCues } from "@/games/bridges/ui/board/BridgesBoard/BridgesBoardCues";
import {
  type BridgesBlockedAttempt,
  BridgesFigure,
  type BridgesFigureGuide,
} from "@/games/bridges/ui/board/BridgesFigure";
import type {
  BridgesBoardCue,
  BridgesBoardSpotlight,
} from "@/games/bridges/ui/board/board-cue";
import {
  type BoardPoint,
  type BoardTarget,
  createBoardView,
  type DragAim,
  findBoardTarget,
  findDragAim,
  findEdgeBetween,
  findIslandToward,
  getIslandCenter,
  ISLAND_HIT_RADIUS,
  isPointInEdgeBand,
  isPointOnIsland,
  toBoardPoint,
  toViewPoint,
} from "@/games/bridges/ui/board/board-geometry";
import { getBridgeExtendMs } from "@/games/bridges/ui/board/bridge-extend";
import { flashBlockingBridges } from "@/games/bridges/ui/board/flash-blocking-bridges";
import { playBridgeMotion } from "@/games/bridges/ui/board/play-bridge-motion";
import { playClearWave } from "@/games/bridges/ui/board/play-clear-wave";
import { cn } from "@/lib/utils";

type BridgesBoardProps = {
  board: BridgesBoardState;
  bridges: readonly BridgeCount[];
  islandStatuses: readonly BridgesIslandStatus[];
  edgeNotice: BridgesEdgeNotice | null;
  /** クリアしてから演出を終えるまで `true`。 */
  clearing: boolean;
  /**
   * 全部の島がつながった後か。完成演出を終えて結果へ移る間も、明るい木の色の橋で完成した姿のまま描く。
   */
  solved?: boolean;
  interactionDisabled: boolean;
  /** 画面全体の海の上に置くプレイ画面では描かない。 */
  showsSea?: boolean;
  /** 辺に一時的に重ねる合図。通常のプレイでは渡さない。 */
  cues?: readonly BridgesBoardCue[];
  /**
   * チュートリアルで手を引いている間に押させる辺。帯の中のどこを押しても、その辺として受ける。
   * 交わる辺と重なる所でも、狙いはこの辺に決まる。通常のプレイと、手を離した後は渡さない。
   */
  guidedEdges?: readonly number[];
  /**
   * 指で触れたときに、ページのスクロールを止める範囲。
   * - `board`: 盤面の全体。送らない画面（プレイ画面・チュートリアル）で使う。
   * - `islands`: なぞりが始まる島の上だけ。送る画面（遊び方）に置く盤面で使い、島の外の盤面の上では指で縦に送れるようにする。
   *   島の間を押すのは押すだけなので、スクロールと両立する。
   * マウスとペンの振る舞いは変えない。
   */
  touchScrollLock?: "board" | "islands";
  /**
   * チュートリアルで決め手を見せている間、盤面の覆いから抜いて元の明るさで見せる島と辺。渡している間は盤面を覆う範囲にする。
   * 通常のプレイでは渡さない。
   */
  spotlight?: BridgesBoardSpotlight | null;
  /** `gesture` は、どう押して回したか。遊び方の例が、文の言う手で回したかを見分けるのに使う。 */
  onCycleEdge: (edge: number, gesture: BridgesEdgeGesture) => void;
  /** マウスの右クリックで使う。渡さなければ右クリックでは回さない。 */
  onCycleEdgeBackward?: (edge: number) => void;
  /**
   * 押したが、どの辺の橋も回さず、島も選ばなかった。`candidates` は線の交わる所のそばを押して候補の2辺を示したとき、
   * `missed` はそれ以外（線から遠い所、なぞって相手の島の外で離した）。
   */
  onIneffectivePress?: (kind: "candidates" | "missed") => void;
  /** 2段階の操作の島の選びを置き直すたびに、選んでいる島（無ければ `null`）を受け取る。 */
  onSelectIsland?: (island: number | null) => void;
  /**
   * 渡すと、2段階の操作で選んでいる島を、盤面ではなく渡した側が持つ。盤面は選びを置き直すたびに `onSelectIsland` で知らせ、
   * 渡した側がこの値を置き直す。遊び方の例が、遊び方の層の Esc で選びを解くのに使う。渡さなければ盤面が持つ。
   */
  selectedIsland?: number | null;
  onClearAnimationComplete: () => void;
};

/**
 * 辺の橋を回した押し方。
 * - `edge`: 島の間を押した。
 * - `drag`: 島から相手の島へなぞった。
 * - `islands`: 島を選んでから相手の島を押した。
 * - `keyboard`: Shift と矢印キーで回した。
 */
export type BridgesEdgeGesture = "edge" | "drag" | "islands" | "keyboard";

/**
 * - `edge`: 線の当たり範囲を押した。`origin` は板を伸ばし始める端の島。`armed` は今離せば回すか（指が同じ線の当たり範囲にあるか）。
 * - `island`: 島を押した。`pairedEdge` は、別の島を選んでいたときの、その島との間の辺。`left` は指が島の陸を出た（なぞりを始めた）か。
 *   `aim` はなぞる指の狙う辺と、今離せば橋を回すか。
 */
type Press =
  | {
      kind: "edge";
      pointerId: number;
      edge: number;
      origin: number;
      armed: boolean;
    }
  | {
      kind: "island";
      pointerId: number;
      island: number;
      pairedEdge: number | null;
      left: boolean;
      aim: DragAim | null;
    };

/**
 * - `edge`: 押せば回る辺。島の間に乗せたときと、選んだ島の相手に乗せたとき。
 * - `island`: 乗せている島。選んだ島が無いときに、その島から架けられる相手を示す。
 * - `candidates`: 最も近い2本の線までの距離がほとんど同じ所に乗せたときの、2辺。
 */
type Hover = {
  board: BridgesBoardState;
  edge: number | null;
  island: number | null;
  candidates: readonly [number, number] | null;
};

type CandidatePress = {
  board: BridgesBoardState;
  edges: readonly [number, number];
};

/** 板の横木を省いて板を太くする、マスの幅（px）。スマホの 9×9 以上の盤面がこれを下回る。 */
export const COMPACT_CELL_PX = 37;

/** 指で操作を始める所の、最も小さい一辺（px）。 */
const TOUCH_TARGET_MIN_PX = 44;

const CANDIDATE_HINT_MS = 1_200;

const islandStatusLabels = {
  short: "",
  exact: " ちょうど",
  over: " 多すぎ",
} as const satisfies Record<BridgesIslandStatus, string>;

const arrowKeyDirections: Readonly<Record<string, BridgesDirection>> = {
  ArrowUp: "up",
  ArrowRight: "right",
  ArrowDown: "down",
  ArrowLeft: "left",
};

function findIslandButton(
  boardElement: HTMLElement,
  island: number,
): HTMLButtonElement | null {
  return boardElement.querySelector(`button[data-island="${island}"]`);
}

/** 板をこの島から伸ばす。 */
function findNearerEnd(
  board: BridgesBoardState,
  edge: number,
  point: BoardPoint,
): number {
  const { from, to } = getBridgesNetwork(board).edges[edge]!;
  function distanceTo(island: number) {
    const center = getIslandCenter(board.islands[island]!);
    return Math.hypot(point.x - center.x, point.y - center.y);
  }
  return distanceTo(from) <= distanceTo(to) ? from : to;
}

/** 別の問題へ移った後は、前の盤面の島を今の盤面に当てはめない。 */
type IslandsOnBoard = { board: BridgesBoardState; islands: readonly number[] };

/**
 * 盤面全体の1要素で押した位置を受け、座標から島か辺を決める（`findBoardTarget`）。
 * - 盤面はスクロール・拡大・長押しのメニューに指を奪わせず、押している間はポインターを捕捉する。
 * - キーボードで止まる島は、島ごとのボタン（見えない読み上げの一覧）にする。
 */
export function BridgesBoard({
  board,
  bridges,
  islandStatuses,
  edgeNotice,
  clearing,
  solved = clearing,
  interactionDisabled,
  showsSea = false,
  cues = [],
  guidedEdges = [],
  touchScrollLock = "board",
  spotlight = null,
  onCycleEdge,
  onCycleEdgeBackward,
  onIneffectivePress,
  onSelectIsland,
  selectedIsland: controlledSelectedIsland,
  onClearAnimationComplete,
}: BridgesBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const figureRef = useRef<SVGSVGElement>(null);
  /** 橋の変化や阻まれたことが盤面に届いたときに板を動かすのに使う。 */
  const [motionOrigin, setMotionOrigin] = useState<{
    edge: number;
    island: number;
  } | null>(null);
  const [press, setPress] = useState<Press | null>(null);
  /** タッチの長押しで届く contextmenu を右クリックと取り違えないために持つ。 */
  const lastPointerType = useRef<string | null>(null);
  const [selection, setSelection] = useState<IslandsOnBoard | null>(null);
  function changeSelection(next: IslandsOnBoard | null) {
    setSelection(next);
    onSelectIsland?.(next?.islands[0] ?? null);
  }
  const [candidatePress, setCandidatePress] = useState<CandidatePress | null>(
    null,
  );
  const [focusTarget, setFocusTarget] = useState(0);
  // 別の問題へ移ると島の数が減ることがあるので、描画のたびに今の盤面の島へ丸める。
  const focusedIsland = Math.min(focusTarget, board.islands.length - 1);
  const [keyboardFocused, setKeyboardFocused] = useState(false);
  const [hover, setHover] = useState<Hover | null>(null);
  const [boardWidth, setBoardWidth] = useState<number | null>(null);
  const view = createBoardView(board);
  const compact =
    boardWidth !== null && boardWidth / view.width < COMPACT_CELL_PX;
  const network = getBridgesNetwork(board);
  // 島の陸（輪郭線の外まで）を覆い、指で始められるよう 44px より小さくしない。
  const islandScrollLockSize = `${Math.max(
    TOUCH_TARGET_MIN_PX,
    boardWidth === null ? 0 : (boardWidth / view.width) * ISLAND_HIT_RADIUS * 2,
  )}px`;
  const ownSelectedIsland =
    selection?.board === board ? selection.islands[0]! : null;
  const selectedIsland = interactionDisabled
    ? null
    : controlledSelectedIsland === undefined
      ? ownSelectedIsland
      : controlledSelectedIsland;
  const islandBridgeCounts = countBridgesIslandBridges(board, { bridges });
  const blockingEdges =
    edgeNotice?.change === "blocked" ? edgeNotice.crossingEdges : [];
  const blockedAttempt: BridgesBlockedAttempt | null =
    edgeNotice?.change === "blocked"
      ? {
          edge: edgeNotice.edge,
          island:
            motionOrigin?.edge === edgeNotice.edge
              ? motionOrigin.island
              : network.edges[edgeNotice.edge]!.from,
        }
      : null;
  const clearOriginEdge =
    edgeNotice?.change === "changed" && edgeNotice.edge < network.edges.length
      ? edgeNotice.edge
      : null;
  const retractingEdge =
    edgeNotice?.change === "changed" &&
    edgeNotice.count === 0 &&
    edgeNotice.edge < network.edges.length
      ? edgeNotice.edge
      : null;
  const currentHover =
    hover?.board === board && press === null && !interactionDisabled
      ? hover
      : null;
  function isBlocked(edge: number) {
    return cycleBridgesEdge(board, { bridges }, edge).kind === "blocked";
  }
  const pressedIsland = press?.kind === "island" ? press.island : null;
  const draggingIsland =
    press?.kind === "island" && press.left ? press.island : null;
  const guideIsland =
    draggingIsland ??
    selectedIsland ??
    pressedIsland ??
    currentHover?.island ??
    null;
  const aim = press?.kind === "island" ? press.aim : null;
  const pressedEdge =
    press?.kind === "edge"
      ? press.armed
        ? press.edge
        : null
      : press?.kind === "island" && !press.left
        ? press.pairedEdge
        : null;
  const guide: BridgesFigureGuide | null =
    guideIsland === null
      ? null
      : {
          island: guideIsland,
          edges: network.islandEdges[guideIsland]!.filter(
            (edge) => !isBlocked(edge),
          ),
          aimEdge: aim?.edge ?? null,
          previewEdge:
            aim?.cyclesOnRelease && !isBlocked(aim.edge) ? aim.edge : null,
        };
  const pointedEdge = currentHover?.edge ?? null;
  const candidateEdges =
    currentHover?.candidates ??
    (candidatePress?.board === board && !interactionDisabled
      ? candidatePress.edges
      : null);
  const hoverEdge =
    pointedEdge !== null && !isBlocked(pointedEdge) ? pointedEdge : null;

  // biome-ignore lint/correctness/useExhaustiveDependencies: 板は操作の知らせのたびに1度だけ動かし、盤面の大きさが変わっただけでは動かさない。
  useLayoutEffect(() => {
    if (edgeNotice?.change === "blocked") {
      flashBlockingBridges(figureRef.current);
      return;
    }
    if (
      edgeNotice?.change !== "changed" ||
      edgeNotice.edge >= network.edges.length
    ) {
      return;
    }
    const { edge, count } = edgeNotice;
    const { from, orientation } = network.edges[edge]!;
    const origin = motionOrigin;
    const island = origin?.edge === edge ? origin.island : from;
    playBridgeMotion(
      figureRef.current,
      edge,
      count,
      toViewPoint(view, getIslandCenter(board.islands[island]!)),
      orientation === "horizontal",
      getBridgeExtendMs(board, edge),
    );
  }, [edgeNotice]);

  useLayoutEffect(() => {
    const element = boardRef.current;
    if (!element || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        setBoardWidth(entry.contentRect.width);
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (candidatePress === null) {
      return;
    }
    const timer = window.setTimeout(
      () => setCandidatePress(null),
      CANDIDATE_HINT_MS,
    );
    return () => window.clearTimeout(timer);
  }, [candidatePress]);

  // 盤面の外を押したときと Esc キーで、島の選びと候補の表示を解く。
  // メニューやダイアログは盤面の外へ描かれるので、そこでの Esc（ダイアログを閉じる操作）は盤面へ流さない。
  const hasSelection = selectedIsland !== null;
  const clearSelection = useEffectEvent(function clearSelection() {
    changeSelection(null);
    setCandidatePress(null);
  });
  useEffect(() => {
    if (!hasSelection && candidatePress === null) {
      return;
    }
    function isOutsideBoard(target: EventTarget | null): boolean {
      return !(target instanceof Node && boardRef.current?.contains(target));
    }
    function handlePointerDownOutside(event: PointerEvent) {
      if (isOutsideBoard(event.target)) {
        clearSelection();
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      const { target } = event;
      if (
        event.key !== "Escape" ||
        event.defaultPrevented ||
        (target !== document.body && isOutsideBoard(target))
      ) {
        return;
      }
      clearSelection();
    }
    document.addEventListener("pointerdown", handlePointerDownOutside, true);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener(
        "pointerdown",
        handlePointerDownOutside,
        true,
      );
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [hasSelection, candidatePress]);

  // 光が渡る前の、明るい木の色の板を1コマも見せないよう、描いた直後に演出を始める。
  useLayoutEffect(() => {
    if (!clearing) {
      return;
    }
    return playClearWave(
      figureRef.current,
      board,
      bridges,
      clearOriginEdge,
      onClearAnimationComplete,
    );
  }, [board, bridges, clearing, clearOriginEdge, onClearAnimationComplete]);

  function readBoardPoint(event: {
    currentTarget: HTMLElement;
    clientX: number;
    clientY: number;
  }): BoardPoint {
    const frame = event.currentTarget.getBoundingClientRect();
    return toBoardPoint(view, frame, event.clientX, event.clientY);
  }

  function findPressTarget(point: BoardPoint): BoardTarget | null {
    const guidedEdge = guidedEdges.find((edge) =>
      isPointInEdgeBand(board, edge, point),
    );
    return guidedEdge === undefined
      ? findBoardTarget(board, point)
      : { kind: "edge", edge: guidedEdge };
  }

  function cycleEdge(
    edge: number,
    originIsland: number,
    gesture: BridgesEdgeGesture,
    direction: "forward" | "backward" = "forward",
  ) {
    setMotionOrigin({ edge, island: originIsland });
    setCandidatePress(null);
    changeSelection(null);
    if (direction === "backward") {
      onCycleEdgeBackward?.(edge);
    } else {
      onCycleEdge(edge, gesture);
    }
  }

  function rejectPress() {
    changeSelection(null);
    onIneffectivePress?.("missed");
  }

  function showCandidates(edges: readonly [number, number]) {
    changeSelection(null);
    setCandidatePress({ board, edges });
    onIneffectivePress?.("candidates");
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    lastPointerType.current = event.pointerType;
    const isMainButton = event.pointerType !== "mouse" || event.button === 0;
    if (interactionDisabled || !event.isPrimary || !isMainButton || press) {
      return;
    }
    const point = readBoardPoint(event);
    const target = findPressTarget(point);
    setCandidatePress(null);
    if (target === null) {
      rejectPress();
      return;
    }
    // 見えない島のボタンへ focus を移さず、マウスの選択やドラッグも始めない。
    event.preventDefault();
    if (target.kind === "ambiguous") {
      showCandidates(target.ascendingEdges);
      return;
    }
    event.currentTarget.setPointerCapture?.(event.pointerId);
    if (target.kind === "edge") {
      setPress({
        kind: "edge",
        pointerId: event.pointerId,
        edge: target.edge,
        origin: findNearerEnd(board, target.edge, point),
        armed: true,
      });
      return;
    }
    setPress({
      kind: "island",
      pointerId: event.pointerId,
      island: target.island,
      pairedEdge:
        selectedIsland === null || selectedIsland === target.island
          ? null
          : findEdgeBetween(board, selectedIsland, target.island),
      left: false,
      aim: null,
    });
  }

  function findHover(point: BoardPoint): Hover | null {
    const target = findBoardTarget(board, point);
    if (target === null) {
      return null;
    }
    if (target.kind === "ambiguous") {
      return {
        board,
        edge: null,
        island: null,
        candidates: target.ascendingEdges,
      };
    }
    if (target.kind === "edge") {
      return { board, edge: target.edge, island: null, candidates: null };
    }
    if (selectedIsland === null) {
      return { board, edge: null, island: target.island, candidates: null };
    }
    const edge =
      selectedIsland === target.island
        ? null
        : findEdgeBetween(board, selectedIsland, target.island);
    return edge === null
      ? null
      : { board, edge, island: null, candidates: null };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (press === null && event.pointerType === "mouse") {
      const next = interactionDisabled
        ? null
        : findHover(readBoardPoint(event));
      if (
        next?.edge !== hover?.edge ||
        next?.island !== hover?.island ||
        next?.candidates !== hover?.candidates
      ) {
        setHover(next);
      }
      return;
    }
    if (press?.pointerId !== event.pointerId) {
      return;
    }
    const point = readBoardPoint(event);
    if (press.kind === "edge") {
      const target = findPressTarget(point);
      const armed = target?.kind === "edge" && target.edge === press.edge;
      if (armed !== press.armed) {
        setPress({ ...press, armed });
      }
      return;
    }
    const left = press.left || !isPointOnIsland(board, press.island, point);
    if (left && !press.left) {
      changeSelection(null);
    }
    const next = left ? findDragAim(board, press.island, point) : null;
    if (
      left !== press.left ||
      next?.edge !== press.aim?.edge ||
      next?.cyclesOnRelease !== press.aim?.cyclesOnRelease
    ) {
      setPress({ ...press, left, aim: next });
    }
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (press?.pointerId !== event.pointerId) {
      return;
    }
    setPress(null);
    if (interactionDisabled) {
      return;
    }
    const point = readBoardPoint(event);
    if (press.kind === "edge") {
      const target = findPressTarget(point);
      if (target?.kind === "edge" && target.edge === press.edge) {
        cycleEdge(press.edge, press.origin, "edge");
      } else {
        rejectPress();
      }
      return;
    }
    if (press.left || !isPointOnIsland(board, press.island, point)) {
      const landing = findDragAim(board, press.island, point);
      if (landing?.cyclesOnRelease) {
        cycleEdge(landing.edge, press.island, "drag");
      } else {
        rejectPress();
      }
      return;
    }
    if (press.pairedEdge !== null && selectedIsland !== null) {
      cycleEdge(press.pairedEdge, selectedIsland, "islands");
      return;
    }
    changeSelection(
      selectedIsland === press.island
        ? null
        : { board, islands: [press.island] },
    );
  }

  function handlePointerCancel(event: ReactPointerEvent<HTMLDivElement>) {
    if (press?.pointerId === event.pointerId) {
      setPress(null);
    }
  }

  function handleContextMenu(event: ReactMouseEvent<HTMLDivElement>) {
    event.preventDefault();
    if (
      interactionDisabled ||
      onCycleEdgeBackward === undefined ||
      lastPointerType.current !== "mouse"
    ) {
      return;
    }
    const point = readBoardPoint(event);
    const target = findBoardTarget(board, point);
    if (target === null) {
      rejectPress();
      return;
    }
    if (target.kind === "ambiguous") {
      showCandidates(target.ascendingEdges);
      return;
    }
    if (target.kind === "edge") {
      cycleEdge(
        target.edge,
        findNearerEnd(board, target.edge, point),
        "edge",
        "backward",
      );
      return;
    }
    const pairedEdge =
      selectedIsland === null || selectedIsland === target.island
        ? null
        : findEdgeBetween(board, selectedIsland, target.island);
    if (pairedEdge !== null && selectedIsland !== null) {
      cycleEdge(pairedEdge, selectedIsland, "islands", "backward");
    }
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const direction = arrowKeyDirections[event.key];
    if (
      direction === undefined ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    ) {
      return;
    }
    event.preventDefault();
    if (event.shiftKey) {
      const edge = findBridgesEdgeToward(board, focusedIsland, direction);
      if (!interactionDisabled && edge !== null) {
        cycleEdge(edge, focusedIsland, "keyboard");
      }
      return;
    }
    const next = findIslandToward(board, focusedIsland, direction);
    if (next !== null && boardRef.current) {
      setFocusTarget(next);
      findIslandButton(boardRef.current, next)?.focus();
    }
  }

  return (
    <div
      ref={boardRef}
      role="group"
      aria-label={`${BRIDGES_DISPLAY_NAME}盤面 ${board.height}行${board.width}列`}
      className={cn(
        "relative size-full select-none [-webkit-touch-callout:none]",
        touchScrollLock === "board" && "touch-none",
      )}
      {...(spotlight !== null && { [TUTORIAL_SPOTLIGHT_AREA_ATTRIBUTE]: "" })}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={() => setHover(null)}
      onLostPointerCapture={handlePointerCancel}
      onContextMenu={handleContextMenu}
      onKeyDown={handleKeyDown}
    >
      <BridgesFigure
        ref={figureRef}
        board={board}
        view={view}
        bridges={bridges}
        islandStatuses={islandStatuses}
        showsSea={showsSea}
        guide={guide}
        hoverEdge={hoverEdge}
        candidateEdges={candidateEdges}
        pressedEdge={pressedEdge}
        pressedIsland={pressedIsland}
        selectedIsland={selectedIsland}
        focusedIsland={keyboardFocused ? focusedIsland : null}
        blockingEdges={blockingEdges}
        blockedAttempt={blockedAttempt}
        retractingEdge={retractingEdge}
        lit={clearing || solved}
        clearOriginEdge={clearOriginEdge}
        compact={compact}
      />
      {(cues.length > 0 || spotlight !== null) && (
        <BridgesBoardCues
          view={view}
          bridges={bridges}
          cues={cues}
          spotlight={spotlight}
          compact={compact}
        />
      )}
      {touchScrollLock === "islands" && !interactionDisabled
        ? board.islands.map((island, index) => {
            const center = toViewPoint(view, getIslandCenter(island));
            return (
              <span
                key={`${island.row}:${island.column}`}
                aria-hidden="true"
                data-touch-scroll-lock={index}
                className="absolute -translate-x-1/2 -translate-y-1/2 touch-none rounded-full"
                style={{
                  left: `${(center.x / view.width) * 100}%`,
                  top: `${(center.y / view.height) * 100}%`,
                  width: islandScrollLockSize,
                  height: islandScrollLockSize,
                }}
              />
            );
          })
        : null}
      <ul className="sr-only">
        {board.islands.map(({ row, column, clue }, island) => (
          <li key={`${row}:${column}`}>
            <button
              type="button"
              data-island={island}
              tabIndex={island === focusedIsland ? 0 : -1}
              onFocus={() => {
                setFocusTarget(island);
                setKeyboardFocused(true);
              }}
              onBlur={() => setKeyboardFocused(false)}
            >
              {`${row + 1}行${column + 1}列の島 数字${clue} 橋${islandBridgeCounts[island]}本${islandStatusLabels[islandStatuses[island]!]}`}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
