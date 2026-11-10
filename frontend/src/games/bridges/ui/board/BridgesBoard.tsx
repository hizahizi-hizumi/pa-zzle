import {
  type KeyboardEvent as ReactKeyboardEvent,
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
  BridgesFigure,
  type BridgesFigureGuide,
} from "@/games/bridges/ui/board/BridgesFigure";
import type {
  BridgesBoardCue,
  BridgesBoardSpotlight,
} from "@/games/bridges/ui/board/board-cue";
import {
  type BoardPoint,
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
  /** チュートリアルで手を引いている間、画面全体の覆いから抜いて元の明るさで見せる島と辺。通常のプレイでは渡さない。 */
  spotlight?: BridgesBoardSpotlight | null;
  /** 辺の橋を 1本 → 2本 → なし と回す。 */
  onCycleEdge: (edge: number) => void;
  /** 押したが、どの辺の橋も回さず、島も選ばなかった（線から遠い所、なぞって相手の島の外で離した）。 */
  onIneffectivePress?: () => void;
  onClearAnimationComplete: () => void;
};

type IslandDrag = {
  pointerId: number;
  island: number;
  /** 指の狙う辺と、今離せば橋を回すか。 */
  aim: DragAim | null;
};

/**
 * マウスを乗せている所。
 * - `edge`: 押せば回る辺。島の間に乗せたときと、選んだ島の相手に乗せたとき。
 * - `island`: 乗せている島。選んだ島が無いときに、その島から架けられる相手を示す。
 */
type Hover = {
  board: BridgesBoardState;
  edge: number | null;
  island: number | null;
};

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

/** 盤面ごとに持つ、島の番号。別の問題へ移った後は、前の盤面の島を今の盤面に当てはめない。 */
type IslandsOnBoard = { board: BridgesBoardState; islands: readonly number[] };

/**
 * 盤面。盤面全体の1要素で押した位置を受け、座標から島か辺を決める。
 * - 島の外を押すと、押した瞬間（pointerdown）にその辺の橋を回す。iOS のダブルタップ待ちや click の遅れを受けないため。
 *   交わる2本の線の交点の近くでも、押した位置・橋の有無・直前に触った島で必ず1つの辺に決め、空振りさせない。
 * - 島を押して動かさずに離すと、その島を選ぶ。選んでいる間に相手の島を押すと、その間の橋を回す（2段階の操作）。
 * - 島から押してなぞり、指が島の的を出て縦横から 25° の内へ動いたら、その向きの最初の島への辺を狙う。指が相手の島に
 *   届いてから離すとその間の橋を回す。相手の島を通り過ぎて離しても回す。斜めのなぞりと、海の上で止めたなぞりでは回さない。
 * - 島を押している間・選んでいる間・マウスを乗せている間は、その島から今架けられる相手へのロープと、島と同じ行と列の淡い帯を
 *   見せる。交わる橋に阻まれて今は架けられない相手にはロープを張らない。なぞっている間は、指の向いた辺のロープを目立たせて
 *   ほかを淡くし、指が相手の島に届いたら回した後の板の影と相手の島の輪を見せる。
 * - マウスを乗せた所で押せば回る辺には、回した後の板の影を淡く予告する。
 * - 盤面はスクロール・拡大・長押しのメニューに指を奪わせず、なぞる間はポインターを捕捉する。
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
  onIneffectivePress,
  onClearAnimationComplete,
}: BridgesBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const figureRef = useRef<SVGSVGElement>(null);
  /** 最後に橋を回した辺と、板を伸ばし始める島。橋の変化が盤面に届いたときに板を動かすのに使う。 */
  const motionOriginRef = useRef<{ edge: number; island: number } | null>(null);
  const [drag, setDrag] = useState<IslandDrag | null>(null);
  const [selection, setSelection] = useState<IslandsOnBoard | null>(null);
  const [recentTouch, setRecentTouch] = useState<IslandsOnBoard | null>(null);
  const [focusTarget, setFocusTarget] = useState(0);
  // 別の問題へ移ると島の数が減ることがあるので、描画のたびに今の盤面の島へ丸める。
  const focusedIsland = Math.min(focusTarget, board.islands.length - 1);
  const [keyboardFocused, setKeyboardFocused] = useState(false);
  const [hover, setHover] = useState<Hover | null>(null);
  const view = createBoardView(board);
  const network = getBridgesNetwork(board);
  const selectedIsland =
    selection?.board === board && !interactionDisabled
      ? selection.islands[0]!
      : null;
  const recentIslands = recentTouch?.board === board ? recentTouch.islands : [];
  const islandBridgeCounts = countBridgesIslandBridges(board, { bridges });
  const blockingEdges =
    edgeNotice?.change === "blocked" ? edgeNotice.crossingEdges : [];
  const blockedEdge = edgeNotice?.change === "blocked" ? edgeNotice.edge : null;
  const retractingEdge =
    edgeNotice?.change === "changed" &&
    edgeNotice.count === 0 &&
    edgeNotice.edge < network.edges.length
      ? edgeNotice.edge
      : null;
  const currentHover =
    hover?.board === board && drag === null && !interactionDisabled
      ? hover
      : null;
  const isBlocked = (edge: number) =>
    cycleBridgesEdge(board, { bridges }, edge).kind === "blocked";
  const guideIsland =
    drag?.island ?? selectedIsland ?? currentHover?.island ?? null;
  const aim = drag?.aim ?? null;
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
    const origin = motionOriginRef.current;
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

  useEffect(() => {
    if (!clearing) {
      return;
    }
    return playClearWave(
      figureRef.current,
      board,
      bridges,
      onClearAnimationComplete,
    );
  }, [board, bridges, clearing, onClearAnimationComplete]);

  function readBoardPoint(event: ReactPointerEvent<HTMLElement>): BoardPoint {
    const frame = event.currentTarget.getBoundingClientRect();
    return toBoardPoint(view, frame, event.clientX, event.clientY);
  }

  function cycleEdge(edge: number, originIsland: number) {
    const { from, to } = network.edges[edge]!;
    motionOriginRef.current = { edge, island: originIsland };
    setRecentTouch({ board, islands: [from, to] });
    setSelection(null);
    onCycleEdge(edge);
  }

  function rejectPress() {
    setSelection(null);
    onIneffectivePress?.();
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const isMainButton = event.pointerType !== "mouse" || event.button === 0;
    if (interactionDisabled || !event.isPrimary || !isMainButton || drag) {
      return;
    }
    const point = readBoardPoint(event);
    const markedEdge = guidedEdges.find((edge) =>
      isPointInEdgeBand(board, edge, point),
    );
    if (markedEdge !== undefined) {
      event.preventDefault();
      if (acceptsEdgePress) {
        cycleEdge(markedEdge, findNearerEnd(board, markedEdge, point));
      } else {
        rejectPress();
      }
      return;
    }
    const target = findBoardTarget(board, bridges, point, recentIslands);
    if (target === null || (target.kind === "edge" && !acceptsEdgePress)) {
      rejectPress();
      return;
    }
    // 見えない島のボタンへ focus を移さず、マウスの選択やドラッグも始めない。
    event.preventDefault();
    if (target.kind === "edge") {
      cycleEdge(target.edge, findNearerEnd(board, target.edge, point));
      return;
    }
    const pairedEdge =
      selectedIsland === null || selectedIsland === target.island
        ? null
        : findEdgeBetween(board, selectedIsland, target.island);
    if (selectedIsland !== null && pairedEdge !== null) {
      cycleEdge(pairedEdge, selectedIsland);
      return;
    }
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setRecentTouch({ board, islands: [target.island] });
    setDrag({
      pointerId: event.pointerId,
      island: target.island,
      aim: null,
    });
  }

  /**
   * マウスを乗せた所。島の間なら押せば回る辺。島なら、選んだ島があればその島との間の辺、無ければ乗せた島そのもの。
   */
  function findHover(point: BoardPoint): Hover | null {
    const target = findBoardTarget(board, bridges, point, recentIslands);
    if (target === null) {
      return null;
    }
    if (target.kind === "edge") {
      return { board, edge: target.edge, island: null };
    }
    if (selectedIsland === null) {
      return { board, edge: null, island: target.island };
    }
    const edge =
      selectedIsland === target.island
        ? null
        : findEdgeBetween(board, selectedIsland, target.island);
    return edge === null ? null : { board, edge, island: null };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (drag === null && event.pointerType === "mouse") {
      const next = interactionDisabled
        ? null
        : findHover(readBoardPoint(event));
      if (next?.edge !== hover?.edge || next?.island !== hover?.island) {
        setHover(next);
      }
      return;
    }
    if (drag?.pointerId !== event.pointerId) {
      return;
    }
    const next = findDragAim(board, drag.island, readBoardPoint(event));
    if (next?.edge !== drag.aim?.edge || next?.landed !== drag.aim?.landed) {
      setDrag({ ...drag, aim: next });
    }
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (drag?.pointerId !== event.pointerId) {
      return;
    }
    setDrag(null);
    if (interactionDisabled) {
      return;
    }
    const point = readBoardPoint(event);
    const landing = findDragAim(board, drag.island, point);
    if (landing?.landed) {
      cycleEdge(landing.edge, drag.island);
      return;
    }
    if (isPointOnIsland(board, drag.island, point)) {
      setSelection(
        selectedIsland === drag.island
          ? null
          : { board, islands: [drag.island] },
      );
      return;
    }
    rejectPress();
  }

  function handlePointerCancel(event: ReactPointerEvent<HTMLDivElement>) {
    if (drag?.pointerId === event.pointerId) {
      setDrag(null);
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
      onContextMenu={(event) => event.preventDefault()}
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
        selectedIsland={selectedIsland}
        focusedIsland={keyboardFocused ? focusedIsland : null}
        blockingEdges={blockingEdges}
        blockedEdge={blockedEdge}
        retractingEdge={retractingEdge}
        lit={clearing}
      />
      {(cues.length > 0 || spotlight !== null) && (
        <BridgesBoardCues
          view={view}
          bridges={bridges}
          cues={cues}
          spotlight={spotlight}
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
