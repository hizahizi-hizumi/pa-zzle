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
import { BridgesBoardCues } from "@/games/bridges/ui/board/BridgesBoard/BridgesBoardCues";
import { flashBoardLines } from "@/games/bridges/ui/board/BridgesBoard/flash-board-lines";
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
  findBoardTarget,
  findDragEdge,
  findIslandToward,
  isPointInEdgeBand,
  toBoardPoint,
} from "@/games/bridges/ui/board/board-geometry";

type BridgesBoardProps = {
  board: BridgesBoardState;
  bridges: readonly BridgeCount[];
  islandStatuses: readonly BridgesIslandStatus[];
  /** 最後の盤面操作で橋に起きた変化。阻まれた操作を盤面で返すのに使う。 */
  edgeNotice: BridgesEdgeNotice | null;
  /** クリアしてから演出を終えるまで `true`。 */
  clearing: boolean;
  interactionDisabled: boolean;
  /** 辺に一時的に重ねる合図。通常のプレイでは渡さない。 */
  cues?: readonly BridgesBoardCue[];
  /**
   * チュートリアルで手を引いている間に押させる辺。帯の中のどこを押しても、その辺として受ける。
   * 交わる辺と重なる所でも、狙いはこの辺に決まる。通常のプレイと、手を離した後は渡さない。
   */
  guidedEdges?: readonly number[];
  /** チュートリアルで手を引いている間、画面全体の覆いから抜いて元の明るさで見せる島と辺。通常のプレイでは渡さない。 */
  spotlight?: BridgesBoardSpotlight | null;
  /** 辺の橋を 1本 → 2本 → なし と回す。 */
  onCycleEdge: (edge: number) => void;
  /** 押したが、どの辺の橋も回さなかった（線から遠い所、どちらを狙ったか決まらない所、島から押して島の上で離した）。 */
  onIneffectivePress?: () => void;
  onClearAnimationComplete: () => void;
};

type IslandDrag = {
  pointerId: number;
  island: number;
  /** 今離せば橋を回す辺。 */
  previewEdge: number | null;
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

/**
 * 盤面。盤面全体の1要素で押した位置を受け、座標から島か辺を決める。
 * - 島の外を押すと、押した瞬間（pointerdown）にその辺の橋を回す。iOS のダブルタップ待ちや click の遅れを受けないため。
 * - 島の丸の中から押すと、押している間その島から架けられる相手への線を見せ、離した位置の向きの辺の橋を回す（なぞり）。
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
  cues = [],
  guidedEdges = [],
  spotlight = null,
  onCycleEdge,
  onIneffectivePress,
  onClearAnimationComplete,
}: BridgesBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const figureRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<IslandDrag | null>(null);
  const [selectedIsland, setSelectedIsland] = useState(0);
  // 別の問題へ移ると島の数が減ることがあるので、描画のたびに今の盤面の島へ丸める。
  const focusedIsland = Math.min(selectedIsland, board.islands.length - 1);
  const [keyboardFocused, setKeyboardFocused] = useState(false);
  /**
   * 最後に、どちらを狙ったか決まらない所を押したときの、押した盤面と候補の辺。`id` は押すたびに変え、同じ所を続けて押しても点け直す。
   */
  const [ambiguousTap, setAmbiguousTap] = useState<{
    id: number;
    board: BridgesBoardState;
    edges: readonly number[];
  } | null>(null);
  // 別の問題へ移った後は、前の盤面の辺を今の盤面に描かない。
  const ambiguousEdges =
    ambiguousTap?.board === board ? ambiguousTap.edges : [];
  const islandBridgeCounts = countBridgesIslandBridges(board, { bridges });
  const blockingEdges =
    edgeNotice?.change === "blocked" ? edgeNotice.crossingEdges : [];
  const guide: BridgesFigureGuide | null = drag && {
    edges: getBridgesNetwork(board).islandEdges[drag.island]!,
    previewEdge: drag.previewEdge,
  };

  useLayoutEffect(() => {
    if (edgeNotice?.change === "blocked") {
      flashBoardLines(figureRef.current, "blockingBridges");
    }
  }, [edgeNotice]);

  useLayoutEffect(() => {
    if (ambiguousTap) {
      flashBoardLines(figureRef.current, "ambiguousEdges");
    }
  }, [ambiguousTap]);

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
    return toBoardPoint(
      board,
      event.currentTarget.getBoundingClientRect(),
      event.clientX,
      event.clientY,
    );
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
      onCycleEdge(markedEdge);
      return;
    }
    const target = findBoardTarget(board, bridges, point);
    if (target === null) {
      onIneffectivePress?.();
      return;
    }
    // 見えない島のボタンへ focus を移さず、マウスの選択やドラッグも始めない。
    event.preventDefault();
    if (target.kind === "edge") {
      onCycleEdge(target.edge);
      return;
    }
    if (target.kind === "ambiguous") {
      setAmbiguousTap((current) => ({
        id: (current?.id ?? 0) + 1,
        board,
        edges: target.edges,
      }));
      onIneffectivePress?.();
      return;
    }
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDrag({
      pointerId: event.pointerId,
      island: target.island,
      previewEdge: null,
    });
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (drag?.pointerId !== event.pointerId) {
      return;
    }
    const previewEdge = findDragEdge(board, drag.island, readBoardPoint(event));
    if (previewEdge !== drag.previewEdge) {
      setDrag({ ...drag, previewEdge });
    }
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (drag?.pointerId !== event.pointerId) {
      return;
    }
    setDrag(null);
    const edge = findDragEdge(board, drag.island, readBoardPoint(event));
    if (interactionDisabled) {
      return;
    }
    if (edge === null) {
      onIneffectivePress?.();
      return;
    }
    onCycleEdge(edge);
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
        onCycleEdge(edge);
      }
      return;
    }
    const next = findIslandToward(board, focusedIsland, direction);
    if (next !== null && boardRef.current) {
      setSelectedIsland(next);
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
      onLostPointerCapture={handlePointerCancel}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={handleKeyDown}
    >
      <BridgesFigure
        ref={figureRef}
        board={board}
        bridges={bridges}
        islandStatuses={islandStatuses}
        guide={guide}
        focusedIsland={keyboardFocused ? focusedIsland : null}
        blockingEdges={blockingEdges}
        ambiguousEdges={ambiguousEdges}
      />
      {(cues.length > 0 || spotlight !== null) && (
        <BridgesBoardCues board={board} cues={cues} spotlight={spotlight} />
      )}
      <ul className="sr-only">
        {board.islands.map(({ row, column, clue }, island) => (
          <li key={`${row}:${column}`}>
            <button
              type="button"
              data-island={island}
              tabIndex={island === focusedIsland ? 0 : -1}
              onFocus={() => {
                setSelectedIsland(island);
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
