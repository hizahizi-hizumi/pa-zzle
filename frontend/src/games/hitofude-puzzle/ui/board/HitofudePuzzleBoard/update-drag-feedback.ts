import {
  getHitofudePuzzleCellPosition,
  getHitofudePuzzleNeighborCell,
  type HitofudePuzzleBoard,
  type HitofudePuzzleDirection,
} from "@/games/hitofude-puzzle/puzzle/board";
import type { BoardPoint } from "@/games/hitofude-puzzle/ui/board/finger-trace";
import { prefersReducedMotion } from "@/lib/motion";

const DRAG_INTENT_THRESHOLD = 0.1;
const DIRECTION_DOMINANCE = 1.35;
const MAX_PREVIEW_LENGTH = 0.5;

function findDragPreview(
  board: HitofudePuzzleBoard,
  path: readonly number[],
  pointer: BoardPoint,
): { dx: number; dy: number; mode: "extend" | "retract" } | null {
  if (
    pointer.x < 0 ||
    pointer.y < 0 ||
    pointer.x >= board.size ||
    pointer.y >= board.size
  ) {
    return null;
  }

  const head = path.at(-1) ?? board.start;
  const { row, column } = getHitofudePuzzleCellPosition(board.size, head);
  const dx = pointer.x - (column + 0.5);
  const dy = pointer.y - (row + 0.5);
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  let direction: HitofudePuzzleDirection;
  let distance: number;

  if (absX > DRAG_INTENT_THRESHOLD && absX > absY * DIRECTION_DOMINANCE) {
    direction = dx > 0 ? "right" : "left";
    distance = absX;
  } else if (
    absY > DRAG_INTENT_THRESHOLD &&
    absY > absX * DIRECTION_DOMINANCE
  ) {
    direction = dy > 0 ? "down" : "up";
    distance = absY;
  } else {
    return null;
  }

  const neighbor = getHitofudePuzzleNeighborCell(board.size, head, direction);
  if (neighbor === null || board.holes.includes(neighbor)) return null;

  const isRetracting = neighbor === path.at(-2);
  if (!isRetracting && path.includes(neighbor)) return null;

  const length = Math.min(MAX_PREVIEW_LENGTH, distance);
  return {
    mode: isRetracting ? "retract" : "extend",
    dx: direction === "right" ? length : direction === "left" ? -length : 0,
    dy: direction === "down" ? length : direction === "up" ? -length : 0,
  };
}

export function updateDragFeedback(
  figure: SVGSVGElement | null,
  board: HitofudePuzzleBoard,
  path: readonly number[],
  pointer: BoardPoint | null,
): void {
  const track = figure?.querySelector<SVGPolylineElement>(
    "[data-continuous-track]",
  );
  const points = track?.getAttribute("data-track-points");
  if (!track || points === null || points === undefined) return;

  const preview =
    pointer === null || prefersReducedMotion()
      ? null
      : findDragPreview(board, path, pointer);
  const head = figure?.querySelector<SVGGElement>("[data-head]");
  const { row, column } = getHitofudePuzzleCellPosition(
    board.size,
    path.at(-1) ?? board.start,
  );

  if (preview === null) {
    track.setAttribute("points", points);
    head?.removeAttribute("transform");
    return;
  }

  const end = `${column + 0.5 + preview.dx},${row + 0.5 + preview.dy}`;
  const updatedPoints =
    preview.mode === "extend"
      ? `${points} ${end}`
      : `${points.slice(0, points.lastIndexOf(" ") + 1)}${end}`;
  track.setAttribute("points", updatedPoints);
  head?.setAttribute("transform", `translate(${preview.dx} ${preview.dy})`);
}

export const _private = { findDragPreview };
