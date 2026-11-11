import type { IceFloorMazeLastSlide } from "@/games/ice-floor-maze/play/use-ice-floor-maze-play";
import type { IceFloorMazeBoard as IceFloorMazeBoardState } from "@/games/ice-floor-maze/puzzle/board";
import { getIceFloorMazeNeighbor } from "@/games/ice-floor-maze/puzzle/rules";
import type { IceFloorMazeStateCell } from "@/games/ice-floor-maze/puzzle/state";
import {
  getIceFloorMazeCellCenter,
  iceFloorMazeDirectionVectors,
} from "@/games/ice-floor-maze/ui/board/board-geometry";
import {
  getIceFloorMazeSlideDurationMs,
  type IceFloorMazeSlideTempo,
} from "@/games/ice-floor-maze/ui/board/slide-timing";
import { MOTION_EASING } from "@/lib/motion";

/** 岩または外壁に止められた面を特定する。障害物は動かさず、接触位置だけ反応させる。 */
export function getIceFloorMazeContactSurface(
  board: IceFloorMazeBoardState,
  slide: IceFloorMazeLastSlide | null,
  cells: readonly IceFloorMazeStateCell[],
): { x: number; y: number; angle: number; kind: "rock" | "wall" } | null {
  if (
    !slide ||
    slide.isClearingMove ||
    slide.stoppedOnFloor ||
    slide.pushedSnow !== null ||
    slide.movedBlock !== null
  ) {
    return null;
  }
  const neighbor = getIceFloorMazeNeighbor(board, slide.to, slide.direction);
  const rock = neighbor !== null && cells[neighbor] === "rock";
  const wall = neighbor === null || cells[neighbor] === "outside";
  if (!rock && !wall) {
    return null;
  }
  const center = getIceFloorMazeCellCenter(board, rock ? neighbor : slide.to);
  const vector = iceFloorMazeDirectionVectors[slide.direction];
  const angle = {
    right: 0,
    left: 180,
    down: 90,
    up: -90,
  }[slide.direction];
  return {
    x: center.x + (wall ? vector.x * 0.5 : 0),
    y: center.y + (wall ? vector.y * 0.5 : 0),
    angle,
    kind: rock ? "rock" : "wall",
  };
}

/** 止められた面が一度だけ光る。障害物の輪郭も位置も動かさない。 */
export function animateIceFloorMazeContactSurface(
  contact: SVGPathElement | null,
  slide: IceFloorMazeLastSlide,
  tempo: IceFloorMazeSlideTempo,
): Animation[] {
  const animation = contact?.animate?.(
    [
      { opacity: 0 },
      { opacity: 0.92, offset: 0.16 },
      { opacity: 0, offset: 1 },
    ],
    {
      duration: 240,
      delay: getIceFloorMazeSlideDurationMs(slide.path.length, tempo),
      easing: MOTION_EASING.exit,
    },
  );
  return animation ? [animation] : [];
}
