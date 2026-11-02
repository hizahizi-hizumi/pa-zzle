import { type PointerEvent as ReactPointerEvent, useRef } from "react";

import { BRIDGES_DISPLAY_NAME } from "@/games/bridges/display-name";
import {
  type BridgesBoard as BridgesBoardState,
  findBridgesEdgeToward,
} from "@/games/bridges/puzzle/board";
import type { BridgesIslandStatus } from "@/games/bridges/puzzle/rules";
import type { BridgeCount } from "@/games/bridges/puzzle/state";
import { BridgesFigure } from "@/games/bridges/ui/board/BridgesFigure";
import {
  type BoardPoint,
  findBoardTarget,
  findDragDirection,
  hasLeftIsland,
} from "@/games/bridges/ui/board/board-geometry";

type BridgesBoardProps = {
  board: BridgesBoardState;
  bridges: readonly BridgeCount[];
  islandStatuses: readonly BridgesIslandStatus[];
  interactionDisabled: boolean;
  /** 辺の橋を 1本 → 2本 → なし と回す。 */
  onCycleEdge: (edge: number) => void;
};

type IslandDrag = {
  pointerId: number;
  island: number;
};

/**
 * 盤面。盤面全体の1要素で押した位置を受け、座標から島か辺を決める。
 * 島の外を押すと、押した瞬間（pointerdown）にその辺の橋を回す。iOS のダブルタップ待ちや click の遅れを受けないため。
 * 島の丸の中から押して丸の外で離すと、島から離した向きの隣の島との辺の橋を回す（なぞり）。
 * 盤面はスクロール・拡大・長押しのメニューに指を奪わせず、なぞる間はポインターを捕捉する。
 */
export function BridgesBoard({
  board,
  bridges,
  islandStatuses,
  interactionDisabled,
  onCycleEdge,
}: BridgesBoardProps) {
  const dragRef = useRef<IslandDrag | null>(null);

  function toBoardPoint(event: ReactPointerEvent<HTMLElement>): BoardPoint {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * board.width,
      y: ((event.clientY - rect.top) / rect.height) * board.height,
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
    const target = findBoardTarget(board, bridges, toBoardPoint(event));
    if (target === null) {
      return;
    }
    event.preventDefault();
    if (target.kind === "edge") {
      onCycleEdge(target.edge);
      return;
    }
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, island: target.island };
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (drag?.pointerId !== event.pointerId) {
      return;
    }
    dragRef.current = null;
    const point = toBoardPoint(event);
    if (interactionDisabled || !hasLeftIsland(board, drag.island, point)) {
      return;
    }
    const edge = findBridgesEdgeToward(
      board,
      drag.island,
      findDragDirection(board, drag.island, point),
    );
    if (edge !== null) {
      onCycleEdge(edge);
    }
  }

  function handlePointerCancel(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  }

  return (
    <div
      role="group"
      aria-label={`${BRIDGES_DISPLAY_NAME}盤面 ${board.height}行${board.width}列`}
      className="relative size-full touch-none select-none [-webkit-touch-callout:none]"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onLostPointerCapture={handlePointerCancel}
      onContextMenu={(event) => event.preventDefault()}
    >
      <BridgesFigure
        board={board}
        bridges={bridges}
        islandStatuses={islandStatuses}
      />
    </div>
  );
}
