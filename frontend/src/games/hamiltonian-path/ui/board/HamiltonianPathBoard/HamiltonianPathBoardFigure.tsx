import {
  getHamiltonianPathCellPosition,
  type HamiltonianPathBoard,
  type HamiltonianPathPartition,
  listHamiltonianPathCells,
} from "@/games/hamiltonian-path/puzzle/board";
import { hamiltonianPathToneClassNames } from "@/games/hamiltonian-path/ui/hamiltonian-path-tone";
import { cn } from "@/lib/utils";

type HamiltonianPathBoardFigureProps = {
  board: HamiltonianPathBoard;
  path: readonly number[];
};

/** 図の寸法はマス幅を 1 とした値。 */
const PATH_LINE_WIDTH = 0.3;
const START_MARK_RADIUS = 0.2;
const HEAD_MARK_RADIUS = 0.3;
const HEAD_CORE_RADIUS = 0.13;
/** 仕切りは辺いっぱいにせず、両端を空けた短い棒にする。辺いっぱいだと隣り合う仕切りがつながり迷路の壁に見える。 */
const PARTITION_THICKNESS = 0.16;
const PARTITION_END_INSET = 0.18;

function getCellCenter(size: number, cell: number): { x: number; y: number } {
  const { row, column } = getHamiltonianPathCellPosition(size, cell);
  return { x: column + 0.5, y: row + 0.5 };
}

function getPartitionRect(
  size: number,
  [left, right]: HamiltonianPathPartition,
): { x: number; y: number; width: number; height: number } {
  const { row, column } = getHamiltonianPathCellPosition(size, left);
  const length = 1 - PARTITION_END_INSET * 2;
  const separatesColumns = right === left + 1;
  return separatesColumns
    ? {
        x: column + 1 - PARTITION_THICKNESS / 2,
        y: row + PARTITION_END_INSET,
        width: PARTITION_THICKNESS,
        height: length,
      }
    : {
        x: column + PARTITION_END_INSET,
        y: row + 1 - PARTITION_THICKNESS / 2,
        width: length,
        height: PARTITION_THICKNESS,
      };
}

/**
 * 盤面の絵。マスの塗り・道・仕切り・始点・先端を、下から順にこの層で描く。
 * 道が仕切りに沿って走っても隠れないよう、仕切りと始点・先端の印は道より上に描く。
 */
export function HamiltonianPathBoardFigure({
  board,
  path,
}: HamiltonianPathBoardFigureProps) {
  const { size } = board;
  const walls = new Set(board.walls);
  const visited = new Set(path);
  const start = getCellCenter(size, board.start);
  const head = getCellCenter(size, path.at(-1) ?? board.start);
  const pathPoints = path
    .map((cell) => {
      const { x, y } = getCellCenter(size, cell);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 size-full"
    >
      {listHamiltonianPathCells(size).map((cell) => {
        const { row, column } = getHamiltonianPathCellPosition(size, cell);
        const isWall = walls.has(cell);
        return (
          <rect
            key={cell}
            x={column}
            y={row}
            width={1}
            height={1}
            vectorEffect="non-scaling-stroke"
            className={cn(
              isWall
                ? hamiltonianPathToneClassNames.wallCell
                : [
                    hamiltonianPathToneClassNames.gridLine,
                    visited.has(cell)
                      ? hamiltonianPathToneClassNames.visitedCell
                      : hamiltonianPathToneClassNames.unvisitedCell,
                  ],
            )}
          />
        );
      })}
      <polyline
        points={pathPoints}
        fill="none"
        strokeWidth={PATH_LINE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={hamiltonianPathToneClassNames.pathLine}
      />
      {board.partitions.map((partition) => (
        <rect
          key={partition.join("-")}
          {...getPartitionRect(size, partition)}
          rx={PARTITION_THICKNESS / 2}
          className={hamiltonianPathToneClassNames.partition}
        />
      ))}
      <circle
        cx={start.x}
        cy={start.y}
        r={START_MARK_RADIUS}
        className={hamiltonianPathToneClassNames.pathMark}
      />
      <circle
        cx={head.x}
        cy={head.y}
        r={HEAD_MARK_RADIUS}
        className={hamiltonianPathToneClassNames.pathMark}
      />
      <circle
        cx={head.x}
        cy={head.y}
        r={HEAD_CORE_RADIUS}
        className={hamiltonianPathToneClassNames.headCore}
      />
    </svg>
  );
}
