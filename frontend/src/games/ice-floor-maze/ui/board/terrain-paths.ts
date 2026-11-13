import {
  getIceFloorMazeCellPosition,
  type IceFloorMazeBoard,
} from "@/games/ice-floor-maze/puzzle/board";
import { roundIceFloorMazeCoordinate } from "@/games/ice-floor-maze/ui/board/path-coordinate";

function isIceFloorMazeDrawnCell(
  board: IceFloorMazeBoard,
  x: number,
  y: number,
): boolean {
  return (
    x >= 0 &&
    y >= 0 &&
    x < board.width &&
    y < board.height &&
    board.cells[y * board.width + x] !== "outside"
  );
}

function formatCellSquare(x: number, y: number): string {
  return `M${x} ${y}h1v1h-1Z`;
}

/** 外壁はこの形の縁を太く描いて、マスの外側へはみ出させる。 */
export function createIceFloorMazeDrawnCellPath(
  board: IceFloorMazeBoard,
): string {
  return board.cells
    .flatMap((cell, cellIndex) => {
      if (cell === "outside") {
        return [];
      }
      const { x, y } = getIceFloorMazeCellPosition(board, cellIndex);
      return [formatCellSquare(x, y)];
    })
    .join("");
}

/**
 * 盤面の外のマスを、外接の長方形の縁から上下左右にたどって届かないものを選ぶ。
 * 縁から届く盤面の外は盤面の形の切り欠きなので、含めない。
 */
export function listIceFloorMazeEnclosedOutsideCells(
  board: IceFloorMazeBoard,
): ReadonlySet<number> {
  const { width, height, cells } = board;
  function isOutside(x: number, y: number): boolean {
    return cells[y * width + x] === "outside";
  }
  const open = new Set<number>();
  const pending: [number, number][] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const onEdge = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      if (onEdge && isOutside(x, y)) {
        open.add(y * width + x);
        pending.push([x, y]);
      }
    }
  }
  while (pending.length > 0) {
    const [x, y] = pending.pop()!;
    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ] as const) {
      const index = ny * width + nx;
      if (
        nx >= 0 &&
        ny >= 0 &&
        nx < width &&
        ny < height &&
        isOutside(nx, ny) &&
        !open.has(index)
      ) {
        open.add(index);
        pending.push([nx, ny]);
      }
    }
  }

  return new Set(
    cells.flatMap((cell, cellIndex) =>
      cell === "outside" && !open.has(cellIndex) ? [cellIndex] : [],
    ),
  );
}

export function createIceFloorMazeEnclosedOutsidePath(
  board: IceFloorMazeBoard,
  enclosed: ReadonlySet<number>,
): string {
  return Array.from(enclosed, (cellIndex) => {
    const { x, y } = getIceFloorMazeCellPosition(board, cellIndex);
    return formatCellSquare(x, y);
  }).join("");
}

export function createIceFloorMazeJointPath(board: IceFloorMazeBoard): string {
  return board.cells
    .flatMap((cell, cellIndex) => {
      if (cell === "outside") {
        return [];
      }
      const { x, y } = getIceFloorMazeCellPosition(board, cellIndex);
      return [
        isIceFloorMazeDrawnCell(board, x + 1, y) ? `M${x + 1} ${y}v1` : "",
        isIceFloorMazeDrawnCell(board, x, y + 1) ? `M${x} ${y + 1}h1` : "",
      ];
    })
    .join("");
}

/** 盤面として描くマスと、外壁との境目の辺。 */
export function createIceFloorMazeBoundaryPath(
  board: IceFloorMazeBoard,
  enclosed: ReadonlySet<number>,
): string {
  function isInside(x: number, y: number): boolean {
    return (
      isIceFloorMazeDrawnCell(board, x, y) ||
      (x >= 0 && x < board.width && enclosed.has(y * board.width + x))
    );
  }
  return board.cells
    .flatMap((cell, cellIndex) => {
      if (cell === "outside") {
        return [];
      }
      const { x, y } = getIceFloorMazeCellPosition(board, cellIndex);
      return [
        isInside(x, y - 1) ? "" : `M${x} ${y}h1`,
        isInside(x + 1, y) ? "" : `M${x + 1} ${y}v1`,
        isInside(x, y + 1) ? "" : `M${x} ${y + 1}h1`,
        isInside(x - 1, y) ? "" : `M${x} ${y}v1`,
      ];
    })
    .join("");
}

/**
 * 隣り合うマスをつないだ、ひと続きの塊の形。各マスを `inset` だけ内へ寄せた四角にし、上下左右に隣り合うマスの間を埋める。
 * 2×2 に固まったマスの真ん中のすき間も埋める。丸い角は、描く側が同じ色の太い線で付ける。
 */
export function createIceFloorMazeMassPath(
  board: Pick<IceFloorMazeBoard, "width" | "height">,
  isMassCell: (cellIndex: number) => boolean,
  inset: number,
): string {
  const { width, height } = board;
  function isMass(x: number, y: number): boolean {
    return (
      x >= 0 && y >= 0 && x < width && y < height && isMassCell(y * width + x)
    );
  }
  function rect(left: number, top: number, w: number, h: number): string {
    return `M${roundIceFloorMazeCoordinate(left)} ${roundIceFloorMazeCoordinate(top)}h${roundIceFloorMazeCoordinate(w)}v${roundIceFloorMazeCoordinate(h)}h${roundIceFloorMazeCoordinate(-w)}Z`;
  }
  const size = 1 - inset * 2;
  const gap = inset * 2;
  const parts: string[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!isMass(x, y)) {
        continue;
      }
      parts.push(rect(x + inset, y + inset, size, size));
      const right = isMass(x + 1, y);
      const down = isMass(x, y + 1);
      if (right) {
        parts.push(rect(x + 1 - inset, y + inset, gap, size));
      }
      if (down) {
        parts.push(rect(x + inset, y + 1 - inset, size, gap));
      }
      if (right && down && isMass(x + 1, y + 1)) {
        parts.push(rect(x + 1 - inset, y + 1 - inset, gap, gap));
      }
    }
  }
  return parts.join("");
}
