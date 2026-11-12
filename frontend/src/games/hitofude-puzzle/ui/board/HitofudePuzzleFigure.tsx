import type { Ref } from "react";

import {
  getHitofudePuzzleCellPosition,
  type HitofudePuzzleBoard,
  listHitofudePuzzleOpenCells,
} from "@/games/hitofude-puzzle/puzzle/board";
import {
  formatHitofudePuzzleOutlinePath,
  listHitofudePuzzleOutlineEdges,
} from "@/games/hitofude-puzzle/ui/board/board-outline";
import {
  HITOFUDE_PUZZLE_PATH_WIDTH,
  hitofudePuzzleToneClassNames,
} from "@/games/hitofude-puzzle/ui/hitofude-puzzle-tone";
import { cn } from "@/lib/utils";

type HitofudePuzzleFigureProps = {
  board: HitofudePuzzleBoard;
  path: readonly number[];
  isDeadEnd: boolean;
  solved: boolean;
  blockedCell?: number | null;
  showsBlockedMark?: boolean;
  ref?: Ref<SVGSVGElement>;
};

const PATH_HALF_WIDTH = HITOFUDE_PUZZLE_PATH_WIDTH / 2;
const UNVISITED_RADIUS = 0.11;
const START_MARK_RADIUS = PATH_HALF_WIDTH;
const END_MARK_RADIUS = PATH_HALF_WIDTH;
const DEAD_END_BAR_WIDTH = 0.055;
const BLOCKED_MARK_REACH = 0.26;
const BLOCKED_MARK_WIDTH = 0.13;
const BLOCKED_MARK_OUTLINE_WIDTH = 0.25;

const blockedMarkStrokes = (
  <>
    <line
      x1={-BLOCKED_MARK_REACH}
      y1={-BLOCKED_MARK_REACH}
      x2={BLOCKED_MARK_REACH}
      y2={BLOCKED_MARK_REACH}
    />
    <line
      x1={-BLOCKED_MARK_REACH}
      y1={BLOCKED_MARK_REACH}
      x2={BLOCKED_MARK_REACH}
      y2={-BLOCKED_MARK_REACH}
    />
  </>
);

function getCellCenter(size: number, cell: number): { x: number; y: number } {
  const { row, column } = getHitofudePuzzleCellPosition(size, cell);
  return { x: column + 0.5, y: row + 0.5 };
}

export const hitofudePuzzleFigureParts = {
  outline: "data-outline",
  head: "data-head",
  clearTrace: "data-clear-trace",
  endMark: "data-end-mark",
  blockedMark: "data-blocked-mark",
} as const;

/** 通った場所は線だけを残し、まだ通っていないマスを格子と点で示す。 */
export function HitofudePuzzleFigure({
  board,
  path,
  isDeadEnd,
  solved,
  blockedCell = null,
  showsBlockedMark = false,
  ref,
}: HitofudePuzzleFigureProps) {
  const { size } = board;
  const openCells = listHitofudePuzzleOpenCells(board);
  const visited = new Set(path);
  const remainingCount = openCells.length - visited.size;
  const closingIn =
    !solved && !isDeadEnd && remainingCount > 0 && remainingCount <= 3;
  const start = getCellCenter(size, board.start);
  const head = getCellCenter(size, path.at(-1) ?? board.start);
  const pathPoints = path
    .map((cell) => {
      const { x, y } = getCellCenter(size, cell);
      return `${x},${y}`;
    })
    .join(" ");
  const blockedMarkCenter =
    blockedCell === null ? null : getCellCenter(size, blockedCell);

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 size-full overflow-visible",
        hitofudePuzzleToneClassNames.colors,
      )}
    >
      <g data-cell-surfaces="">
        {openCells.map((cell) => {
          const { row, column } = getHitofudePuzzleCellPosition(size, cell);
          const unvisited = !visited.has(cell);
          return (
            <rect
              key={cell}
              data-unvisited-cell={unvisited ? "" : undefined}
              x={column}
              y={row}
              width={1}
              height={1}
              vectorEffect="non-scaling-stroke"
              className={cn(
                hitofudePuzzleToneClassNames.cell,
                "stroke-(length:--border-width-normal) transition-[stroke] duration-150",
                unvisited
                  ? hitofudePuzzleToneClassNames.grid
                  : "stroke-transparent",
              )}
            />
          );
        })}
      </g>
      <path
        {...{ [hitofudePuzzleFigureParts.outline]: "" }}
        d={formatHitofudePuzzleOutlinePath(
          listHitofudePuzzleOutlineEdges(board),
        )}
        fill="none"
        strokeLinecap="square"
        vectorEffect="non-scaling-stroke"
        className={cn(
          hitofudePuzzleToneClassNames.outline,
          "stroke-(length:--border-width-strong)",
        )}
      />
      <g data-target-nodes="">
        {openCells
          .filter((cell) => !visited.has(cell))
          .map((cell) => {
            const { x, y } = getCellCenter(size, cell);
            return (
              <circle
                key={cell}
                data-unvisited-node=""
                cx={x}
                cy={y}
                r={closingIn && remainingCount === 1 ? 0.155 : UNVISITED_RADIUS}
                fill="var(--hitofude-puzzle-target)"
              />
            );
          })}
      </g>
      <polyline
        data-continuous-track=""
        data-track-points={pathPoints}
        points={pathPoints}
        fill="none"
        stroke="var(--hitofude-puzzle-from)"
        strokeWidth={HITOFUDE_PUZZLE_PATH_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {solved ? (
        <polyline
          {...{ [hitofudePuzzleFigureParts.clearTrace]: "" }}
          points={pathPoints}
          pathLength={1}
          strokeDasharray="0.065 0.935"
          fill="none"
          opacity={0}
          strokeWidth={HITOFUDE_PUZZLE_PATH_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={hitofudePuzzleToneClassNames.clearTrace}
        />
      ) : null}
      <circle
        cx={start.x}
        cy={start.y}
        r={START_MARK_RADIUS}
        fill="var(--hitofude-puzzle-from)"
      />
      <circle
        cx={start.x}
        cy={start.y}
        r={0.055}
        fill="var(--hitofude-puzzle-cell)"
      />
      {solved ? (
        <circle
          {...{ [hitofudePuzzleFigureParts.endMark]: "" }}
          cx={head.x}
          cy={head.y}
          r={END_MARK_RADIUS}
          fill="var(--hitofude-puzzle-from)"
        />
      ) : (
        <g transform={`translate(${head.x} ${head.y})`}>
          <g {...{ [hitofudePuzzleFigureParts.head]: "" }}>
            {isDeadEnd ? (
              <>
                <circle
                  r={PATH_HALF_WIDTH}
                  fill="var(--hitofude-puzzle-from)"
                />
                <rect
                  x={-0.08}
                  y={-DEAD_END_BAR_WIDTH / 2}
                  width={0.16}
                  height={DEAD_END_BAR_WIDTH}
                  className={hitofudePuzzleToneClassNames.deadEndBar}
                />
              </>
            ) : (
              <circle r={PATH_HALF_WIDTH} fill="var(--hitofude-puzzle-from)" />
            )}
          </g>
        </g>
      )}
      {blockedMarkCenter === null ? null : (
        <g
          {...{ [hitofudePuzzleFigureParts.blockedMark]: "" }}
          transform={`translate(${blockedMarkCenter.x} ${blockedMarkCenter.y})`}
          opacity={showsBlockedMark ? 1 : 0}
          strokeLinecap="round"
        >
          <g
            strokeWidth={BLOCKED_MARK_OUTLINE_WIDTH}
            className={hitofudePuzzleToneClassNames.blockedMarkOutline}
          >
            {blockedMarkStrokes}
          </g>
          <g
            strokeWidth={BLOCKED_MARK_WIDTH}
            stroke="var(--hitofude-puzzle-from)"
          >
            {blockedMarkStrokes}
          </g>
        </g>
      )}
    </svg>
  );
}
