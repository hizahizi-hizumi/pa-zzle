import { Pointer } from "lucide-react";

import type { BridgesBoard } from "@/games/bridges/puzzle/board";
import { listBridgesIslandStatuses } from "@/games/bridges/puzzle/rules";
import type { BridgeCount } from "@/games/bridges/puzzle/state";
import {
  BridgesFigure,
  type BridgesFigureGuide,
} from "@/games/bridges/ui/board/BridgesFigure";
import type { BoardPoint } from "@/games/bridges/ui/board/board-geometry";

type HowToPlayFigureProps = {
  board: BridgesBoard;
  bridges: readonly BridgeCount[];
  /** 島を押している間の、架けられる相手への線。 */
  guide?: BridgesFigureGuide;
  /** 交わる橋に阻まれたときに点ける、阻んだ橋の辺。 */
  blockingEdges?: readonly number[];
  /** 指を置いている所（盤面の座標）。指の印を添える。 */
  finger?: BoardPoint;
};

/** 盤面と同じ部品で描く、遊び方の小さな図。島の状態は橋の本数から盤面と同じ規則で求める。 */
export function HowToPlayFigure({
  board,
  bridges,
  guide,
  blockingEdges,
  finger,
}: HowToPlayFigureProps) {
  return (
    <span aria-hidden="true" className="relative block size-24 shrink-0">
      <BridgesFigure
        board={board}
        bridges={bridges}
        islandStatuses={listBridgesIslandStatuses(board, { bridges })}
        guide={guide}
        blockingEdges={blockingEdges}
        showsBlockingEdges
      />
      {finger && (
        <Pointer
          className="absolute size-5 fill-background text-foreground"
          style={{
            left: `${(finger.x / board.width) * 100}%`,
            top: `${(finger.y / board.height) * 100}%`,
          }}
        />
      )}
    </span>
  );
}
