import type { IceFloorMazeBoard } from "@/games/ice-floor-maze/puzzle/board";
import { getIceFloorMazeNeighbor } from "@/games/ice-floor-maze/puzzle/rules";
import {
  exploreIceFloorMazeStops,
  type IceFloorMazeStopGraph,
} from "@/games/ice-floor-maze/puzzle/stop-graph";

/** 到達できる停止点からの滑りを止めるか、成立しない方向として塞ぐ岩。昇順。 */
export function listIceFloorMazeRelevantRocks(
  board: IceFloorMazeBoard,
  graph: IceFloorMazeStopGraph,
): number[] {
  const rocks = new Set<number>();
  for (const stopSlides of graph.slides.values()) {
    for (const slide of stopSlides) {
      const stoppedAt = slide.status === "slid" ? slide.to : slide.from;
      const stopper = getIceFloorMazeNeighbor(
        board,
        stoppedAt,
        slide.direction,
      );
      if (stopper !== null) {
        rocks.add(stopper);
      }
    }
  }
  return [...rocks].sort((left, right) => left - right);
}

/**
 * 開始位置から到達できる停止点のどの滑りにも関わらない岩を氷にする。
 * 関わる岩だけを残すので、停止点とその間の移動は変わらない。
 */
export function removeIceFloorMazeIrrelevantRocks(
  board: IceFloorMazeBoard,
  start: number,
): IceFloorMazeBoard {
  const relevantRocks = new Set(
    listIceFloorMazeRelevantRocks(
      board,
      exploreIceFloorMazeStops(board, start),
    ),
  );
  return {
    ...board,
    cells: board.cells.map((cell, cellIndex) =>
      cell === "rock" && !relevantRocks.has(cellIndex) ? "ice" : cell,
    ),
  };
}
