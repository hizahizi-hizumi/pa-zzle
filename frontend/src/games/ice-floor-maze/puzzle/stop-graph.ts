import type { IceFloorMazeBoard } from "@/games/ice-floor-maze/puzzle/board";
import {
  type IceFloorMazeSlide,
  iceFloorMazeDirections,
  slideIceFloorMazePiece,
} from "@/games/ice-floor-maze/puzzle/rules";

export type IceFloorMazeStopMove = Extract<
  IceFloorMazeSlide,
  { status: "slid" }
>;

/**
 * 起点から滑りを重ねて止まれる位置（停止点）と、その間の移動。
 * - `stops`: 起点を含む到達できる停止点。起点からの最少手数の昇順。
 * - `moveCounts`: 停止点ごとの、起点から止まるまでの最少手数。
 * - `slides`: 停止点ごとの、上・右・下・左の4方向の滑り。成立しない方向も含む。
 */
export type IceFloorMazeStopGraph = {
  origin: number;
  stops: readonly number[];
  moveCounts: ReadonlyMap<number, number>;
  slides: ReadonlyMap<number, readonly IceFloorMazeSlide[]>;
};

/** 起点から幅優先で停止点をたどる。 */
export function exploreIceFloorMazeStops(
  board: IceFloorMazeBoard,
  origin: number,
): IceFloorMazeStopGraph {
  const stops = [origin];
  const moveCounts = new Map([[origin, 0]]);
  const slides = new Map<number, readonly IceFloorMazeSlide[]>();

  for (let order = 0; order < stops.length; order += 1) {
    const stop = stops[order]!;
    const stopSlides = iceFloorMazeDirections.map((direction) =>
      slideIceFloorMazePiece(board, stop, direction),
    );
    slides.set(stop, stopSlides);
    for (const slide of stopSlides) {
      if (slide.status === "slid" && !moveCounts.has(slide.to)) {
        moveCounts.set(slide.to, moveCounts.get(stop)! + 1);
        stops.push(slide.to);
      }
    }
  }

  return { origin, stops, moveCounts, slides };
}

/** 停止点から1回の滑りで移れる停止点への移動。成立しない方向は含まない。 */
export function listIceFloorMazeStopMoves(
  graph: IceFloorMazeStopGraph,
  stop: number,
): IceFloorMazeStopMove[] {
  return (graph.slides.get(stop) ?? []).filter(
    (slide): slide is IceFloorMazeStopMove => slide.status === "slid",
  );
}
