import {
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

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
import { flashBlockingBridges } from "@/games/bridges/ui/board/BridgesBoard/flash-blocking-bridges";
import { playBridgeMotion } from "@/games/bridges/ui/board/BridgesBoard/play-bridge-motion";
import { playClearWave } from "@/games/bridges/ui/board/BridgesBoard/play-clear-wave";
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
  isPointInEdgeBand,
  isPointOnIsland,
  toBoardPoint,
  toViewPoint,
} from "@/games/bridges/ui/board/board-geometry";
import { getBridgeExtendMs } from "@/games/bridges/ui/board/bridge-extend";

type BridgesBoardProps = {
  board: BridgesBoardState;
  bridges: readonly BridgeCount[];
  islandStatuses: readonly BridgesIslandStatus[];
  /** 最後の盤面操作で橋に起きた変化。架けた・外した板の動きと、阻まれた操作を盤面で返すのに使う。 */
  edgeNotice: BridgesEdgeNotice | null;
  /** クリアしてから演出を終えるまで `true`。 */
  clearing: boolean;
  interactionDisabled: boolean;
  /** 盤面の絵の地に海を描くか。画面全体の海の上に置くプレイ画面では描かない。 */
  showsSea?: boolean;
  /** 辺に一時的に重ねる合図。通常のプレイでは渡さない。 */
  cues?: readonly BridgesBoardCue[];
  /**
   * チュートリアルで手を引いている間に押させる辺。帯の中のどこを押しても、その辺として受ける。
   * 交わる辺と重なる所でも、狙いはこの辺に決まる。通常のプレイと、手を離した後は渡さない。
   */
  guidedEdges?: readonly number[];
  /**
   * 島の間を押して橋を回すのを受け付けるか。チュートリアルで、島から架ける操作（なぞる、島を選んでから相手の島を押す）を
   * 体験させる間だけ `false` にし、島の間の押しは回さなかった押しとして知らせる。通常のプレイでは渡さない。
   */
  acceptsEdgePress?: boolean;
  /**
   * チュートリアルで手を引いている間、元の明るさで見せる島と辺。盤面の海は画面全体の覆いから抜いて海の色のまま残し、
   * 盤面の中でほかの島と橋を深い海に沈めて見せる。通常のプレイでは渡さない。
   */
  spotlight?: BridgesBoardSpotlight | null;
  /** 辺の橋を 1本 → 2本 → なし と回す。 */
  onCycleEdge: (edge: number) => void;
  /** 辺の橋を逆に なし → 2本 → 1本 と回す。マウスの右クリックで使う。渡さなければ右クリックでは回さない。 */
  onCycleEdgeBackward?: (edge: number) => void;
  /** 押したが、どの辺の橋も回さず、島も選ばなかった（線から遠い所、なぞって相手の島の外で離した）。 */
  onIneffectivePress?: () => void;
  onClearAnimationComplete: () => void;
};

/**
 * 押している指。押した瞬間に狙いを決めて光らせ、離したときに確かめて回す。
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
 * マウスを乗せている所。
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

/** 最も近い2本の線までの距離がほとんど同じ所を押したときの、候補の2辺。 */
type CandidatePress = {
  board: BridgesBoardState;
  edges: readonly [number, number];
};

/** 板の横木を省いて板を太くする、マスの幅（px）。スマホの 9×9 以上の盤面がこれを下回る。 */
const COMPACT_CELL_PX = 37;

/** どちらの線か決まらない所を押したときに、候補の2辺を示しておく時間。 */
const CANDIDATE_HINT_MS = 1_200;

/** 島の状態の読み上げ。足りない間は何も添えない。 */
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

/** 読み上げとキーボードの止まり先にする、島のボタンを探す。 */
function findIslandButton(
  boardElement: HTMLElement,
  island: number,
): HTMLButtonElement | null {
  return boardElement.querySelector(`button[data-island="${island}"]`);
}

/** 押した辺の、押した点に近い方の端の島。板をこの島から伸ばす。 */
function findNearerEnd(
  board: BridgesBoardState,
  edge: number,
  point: BoardPoint,
): number {
  const { from, to } = getBridgesNetwork(board).edges[edge]!;
  const distanceTo = (island: number) => {
    const center = getIslandCenter(board.islands[island]!);
    return Math.hypot(point.x - center.x, point.y - center.y);
  };
  return distanceTo(from) <= distanceTo(to) ? from : to;
}

/** 盤面ごとに持つ、選んだ島の番号。別の問題へ移った後は、前の盤面の島を今の盤面に当てはめない。 */
type IslandsOnBoard = { board: BridgesBoardState; islands: readonly number[] };

/**
 * 盤面。盤面全体の1要素で押した位置を受け、座標から島か辺を決める（`findBoardTarget`）。
 * - 島の当たり範囲は陸の上だけ。島の外では、2島の間の長方形（線から両側に半マス）に押した点を含む線のうち、線に最も近い線の辺を狙う。
 *   最も近い2本の線までの距離がほとんど同じ所（交点のそばなど）では、どちらの橋も回さず、2辺にロープを張って候補を示す。
 *   どの線の当たり範囲にも入らない海を押すと、どの橋も回さず、島の選びを解く。
 * - 押した瞬間に狙った辺へ回した後の板の影とロープを置いて光らせ、離したときにその辺の橋を回す。押したまま指を当たり範囲の外へずらすと
 *   光が消え、離しても回さない。
 * - 島を押して動かさずに離すと、その島を選ぶ。選んでいる間に相手の島を押すと、押している間その間の辺を光らせ、離すとその間の橋を回す。
 * - 島から押してなぞり、指が島の陸を出て縦横から 25° の内へ動いたら、その向きの最初の島への辺を狙う。指が相手の島に
 *   届いてから離すとその間の橋を回す。相手の島を通り過ぎて離しても回す。斜めのなぞりと、海の上で止めたなぞりでは回さない。
 * - なぞりを始めたとき、橋を回したとき、島の外（盤面の外を含む）を押したとき、Esc キーで、島の選びを解く。
 * - マウスの右クリックは、狙った辺の橋を逆に なし → 2本 → 1本 と回す。
 * - 島を押している間・選んでいる間・マウスを乗せている間は、その島から今架けられる相手へのロープと、島と同じ行と列の淡い帯を
 *   見せる。交わる橋に阻まれて今は架けられない相手にはロープを張らない。なぞっている間は、指の向いた辺のロープを目立たせて
 *   ほかを淡くし、指が相手の島に届いたら回した後の板の影と相手の島の輪を見せる。
 * - マウスを乗せた所で押せば回る辺には、回した後の板の影を淡く予告する。
 * - 盤面はスクロール・拡大・長押しのメニューに指を奪わせず、押している間はポインターを捕捉する。
 * - キーボードでは、島ごとのボタン（見えない読み上げの一覧）の1つに止まり、矢印キーで隣の島へ移り、Shift と矢印キーで
 *   その向きの辺の橋を回す。
 */
export function BridgesBoard({
  board,
  bridges,
  islandStatuses,
  edgeNotice,
  clearing,
  interactionDisabled,
  showsSea = false,
  cues = [],
  guidedEdges = [],
  acceptsEdgePress = true,
  spotlight = null,
  onCycleEdge,
  onCycleEdgeBackward,
  onIneffectivePress,
  onClearAnimationComplete,
}: BridgesBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const figureRef = useRef<SVGSVGElement>(null);
  /** 最後に橋を回した辺と、板を伸ばし始める島。橋の変化や阻まれたことが盤面に届いたときに板を動かすのに使う。 */
  const [motionOrigin, setMotionOrigin] = useState<{
    edge: number;
    island: number;
  } | null>(null);
  const [press, setPress] = useState<Press | null>(null);
  /** 最後に押したポインターの種類。タッチの長押しで届く contextmenu を右クリックと取り違えないために持つ。 */
  const lastPointerType = useRef<string | null>(null);
  const [selection, setSelection] = useState<IslandsOnBoard | null>(null);
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
  const selectedIsland =
    selection?.board === board && !interactionDisabled
      ? selection.islands[0]!
      : null;
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
  // 灯りは最後に架けた橋から広げる。
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
  const isBlocked = (edge: number) =>
    cycleBridgesEdge(board, { bridges }, edge).kind === "blocked";
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
  // 押している指が今離せば回す辺。押した瞬間から光らせる。
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
          previewEdge: aim?.landed && !isBlocked(aim.edge) ? aim.edge : null,
        };
  // チュートリアルで押させる辺にも、押せば架かる板の影を置く。
  const pointedEdge = currentHover?.edge ?? guidedEdges[0] ?? null;
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
  const hasSelection = selection !== null;
  useEffect(() => {
    if (!hasSelection && candidatePress === null) {
      return;
    }
    function isOutsideBoard(target: EventTarget | null): boolean {
      return !(target instanceof Node && boardRef.current?.contains(target));
    }
    function handlePointerDownOutside(event: PointerEvent) {
      if (isOutsideBoard(event.target)) {
        setSelection(null);
        setCandidatePress(null);
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
      setSelection(null);
      setCandidatePress(null);
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

  useEffect(() => {
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

  /** 押した点の狙い。チュートリアルで押させる辺の帯の中なら、その辺。 */
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
    direction: "forward" | "backward" = "forward",
  ) {
    setMotionOrigin({ edge, island: originIsland });
    setCandidatePress(null);
    setSelection(null);
    if (direction === "backward") {
      onCycleEdgeBackward?.(edge);
    } else {
      onCycleEdge(edge);
    }
  }

  function rejectPress() {
    setSelection(null);
    onIneffectivePress?.();
  }

  function showCandidates(edges: readonly [number, number]) {
    setSelection(null);
    setCandidatePress({ board, edges });
    onIneffectivePress?.();
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
    if (target === null || (target.kind === "edge" && !acceptsEdgePress)) {
      rejectPress();
      return;
    }
    // 見えない島のボタンへ focus を移さず、マウスの選択やドラッグも始めない。
    event.preventDefault();
    if (target.kind === "ambiguous") {
      showCandidates(target.edges);
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

  /**
   * マウスを乗せた所。島の間なら押せば回る辺。島なら、選んだ島があればその島との間の辺、無ければ乗せた島そのもの。
   */
  function findHover(point: BoardPoint): Hover | null {
    const target = findBoardTarget(board, point);
    if (target === null) {
      return null;
    }
    if (target.kind === "ambiguous") {
      return { board, edge: null, island: null, candidates: target.edges };
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
      // なぞりを始めたら、前に選んでいた島との組は使わない。
      setSelection(null);
    }
    const next = left ? findDragAim(board, press.island, point) : null;
    if (
      left !== press.left ||
      next?.edge !== press.aim?.edge ||
      next?.landed !== press.aim?.landed
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
        cycleEdge(press.edge, press.origin);
      } else {
        rejectPress();
      }
      return;
    }
    if (press.left || !isPointOnIsland(board, press.island, point)) {
      const landing = findDragAim(board, press.island, point);
      if (landing?.landed) {
        cycleEdge(landing.edge, press.island);
      } else {
        rejectPress();
      }
      return;
    }
    if (press.pairedEdge !== null && selectedIsland !== null) {
      cycleEdge(press.pairedEdge, selectedIsland);
      return;
    }
    setSelection(
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

  /** マウスの右クリックで、狙った辺の橋を逆に回す。タッチの長押しで届く contextmenu では回さない。 */
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
      showCandidates(target.edges);
      return;
    }
    if (target.kind === "edge") {
      cycleEdge(
        target.edge,
        findNearerEnd(board, target.edge, point),
        "backward",
      );
      return;
    }
    const pairedEdge =
      selectedIsland === null || selectedIsland === target.island
        ? null
        : findEdgeBetween(board, selectedIsland, target.island);
    if (pairedEdge !== null && selectedIsland !== null) {
      cycleEdge(pairedEdge, selectedIsland, "backward");
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
        cycleEdge(edge, focusedIsland);
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
      className="relative size-full touch-none select-none [-webkit-touch-callout:none]"
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
        pressedEdge={pressedEdge ?? guidedEdges[0] ?? null}
        pressedIsland={pressedIsland}
        bandEdges={guidedEdges}
        focus={spotlight}
        selectedIsland={selectedIsland}
        focusedIsland={keyboardFocused ? focusedIsland : null}
        blockingEdges={blockingEdges}
        blockedAttempt={blockedAttempt}
        retractingEdge={retractingEdge}
        lit={clearing}
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
