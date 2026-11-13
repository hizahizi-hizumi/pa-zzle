import {
  getSlidePuzzleSlide,
  type SlidePuzzleTileDirection,
} from "@/games/slide-puzzle/puzzle/rules";
import type { SlidePuzzleBoard } from "@/games/slide-puzzle/puzzle/state";

/** これより短く指を動かした操作はタップとして扱う（px）。 */
export const SLIDE_PUZZLE_SWIPE_THRESHOLD_PX = 16;

/** 指を動かした向き。縦横のうち大きく動かした方で決め、短すぎるときは `null`。 */
export function getSlidePuzzleSwipeDirection(
  deltaX: number,
  deltaY: number,
): SlidePuzzleTileDirection | null {
  if (
    Math.max(Math.abs(deltaX), Math.abs(deltaY)) <
    SLIDE_PUZZLE_SWIPE_THRESHOLD_PX
  ) {
    return null;
  }
  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return deltaX < 0 ? "left" : "right";
  }
  return deltaY < 0 ? "up" : "down";
}

/** タイルを空白へ向かう向きにスワイプしたときだけ、そのタイルを押したのと同じ操作にする。 */
export function isSlidePuzzleSwipeTowardBlank(
  board: SlidePuzzleBoard,
  cellIndex: number,
  direction: SlidePuzzleTileDirection,
): boolean {
  return getSlidePuzzleSlide(board, cellIndex)?.direction === direction;
}
