import { Pointer } from "lucide-react";

import type { BridgesBoard } from "@/games/bridges/puzzle/board";
import { listBridgesIslandStatuses } from "@/games/bridges/puzzle/rules";
import type { BridgeCount } from "@/games/bridges/puzzle/state";
import {
  type BridgesBlockedAttempt,
  BridgesFigure,
} from "@/games/bridges/ui/board/BridgesFigure";
import {
  type BoardPoint,
  createBoardView,
  toViewPoint,
} from "@/games/bridges/ui/board/board-geometry";

type HowToPlayFigureProps = {
  board: BridgesBoard;
  bridges: readonly BridgeCount[];
  /** 交わる橋に阻まれたときに縁取る、阻んだ橋の辺。 */
  blockingEdges?: readonly number[];
  /** 交わる橋に阻まれたときに、押した端の島から阻んだ橋の手前まで板の影を置く、押した辺と端の島。 */
  blockedAttempt?: BridgesBlockedAttempt;
  /** 指を置いている所（盤面の座標）。指の印を添える。 */
  finger?: BoardPoint;
};

/** 盤面と同じ部品で描く、遊び方の小さな図。島の状態は橋の本数から盤面と同じ規則で求める。 */
export function HowToPlayFigure({
  board,
  bridges,
  blockingEdges,
  blockedAttempt,
  finger,
}: HowToPlayFigureProps) {
  const view = createBoardView(board);
  const fingerPoint = finger && toViewPoint(view, finger);
  return (
    // 3×3 の盤面を 112px で描き、島の数字を本文に近い 15px ほどにする。
    <span aria-hidden="true" className="relative block size-28 shrink-0">
      <BridgesFigure
        board={board}
        bridges={bridges}
        islandStatuses={listBridgesIslandStatuses(board, { bridges })}
        showsSea
        blockingEdges={blockingEdges}
        blockedAttempt={blockedAttempt}
        showsBlockingEdges
        compact
      />
      {fingerPoint && (
        <Pointer
          className="absolute size-5 fill-background text-foreground"
          style={{
            left: `${(fingerPoint.x / view.width) * 100}%`,
            top: `${(fingerPoint.y / view.height) * 100}%`,
          }}
        />
      )}
    </span>
  );
}
