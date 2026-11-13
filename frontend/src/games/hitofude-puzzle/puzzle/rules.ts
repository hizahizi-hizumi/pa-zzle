import {
  createHitofudePuzzleAdjacency,
  type HitofudePuzzleBoard,
  isHitofudePuzzleCellOnBoard,
  listHitofudePuzzleOpenCells,
} from "@/games/hitofude-puzzle/puzzle/board";

/**
 * 道を作った入力処理を信頼せず、規則だけで確かめる。
 * 問題は一意解なので、保存した解との一致は要らない。
 */
export function isHitofudePuzzleSolved(
  board: HitofudePuzzleBoard,
  path: readonly number[],
): boolean {
  if (path[0] !== board.start) {
    return false;
  }
  const openCellCount = listHitofudePuzzleOpenCells(board).length;
  if (path.length !== openCellCount) {
    return false;
  }
  const adjacency = createHitofudePuzzleAdjacency(board);
  const visited = new Set<number>();
  for (const [index, cell] of path.entries()) {
    const previous = path[index - 1];
    if (
      !isHitofudePuzzleCellOnBoard(board.size, cell) ||
      visited.has(cell) ||
      (previous !== undefined && !adjacency[previous]!.includes(cell))
    ) {
      return false;
    }
    visited.add(cell);
  }
  return true;
}

function listUnvisitedNeighbors(
  adjacency: readonly (readonly number[])[],
  visited: ReadonlySet<number>,
  cell: number,
): number[] {
  return adjacency[cell]!.filter((neighbor) => !visited.has(neighbor));
}

export function isHitofudePuzzleDeadEnd(
  board: HitofudePuzzleBoard,
  path: readonly number[],
): boolean {
  const head = path.at(-1);
  if (
    head === undefined ||
    path.length >= listHitofudePuzzleOpenCells(board).length
  ) {
    return false;
  }
  const adjacency = createHitofudePuzzleAdjacency(board);
  return listUnvisitedNeighbors(adjacency, new Set(path), head).length === 0;
}

/**
 * 今の道のまま延ばしても全マスを通れないと、盤面から機械的に分かる未通過マス。
 * - `deadEndCells`: 入れる隣が1つだけで、道の終点にしかなれないマス。
 */
export type HitofudePuzzleStranding = {
  isolatedCells: readonly number[];
  deadEndCells: readonly number[];
  separatedCells: readonly number[];
};

function listCellsReachableThroughUnvisited(
  adjacency: readonly (readonly number[])[],
  visited: ReadonlySet<number>,
  origin: number,
): Set<number> {
  const reached = new Set<number>();
  const pending = [origin];
  for (let cell = pending.pop(); cell !== undefined; cell = pending.pop()) {
    for (const neighbor of listUnvisitedNeighbors(adjacency, visited, cell)) {
      if (!reached.has(neighbor)) {
        reached.add(neighbor);
        pending.push(neighbor);
      }
    }
  }
  return reached;
}

export function findHitofudePuzzleStranding(
  board: HitofudePuzzleBoard,
  path: readonly number[],
): HitofudePuzzleStranding | null {
  const head = path.at(-1);
  if (head === undefined) {
    return null;
  }
  const adjacency = createHitofudePuzzleAdjacency(board);
  const visited = new Set(path);
  const unvisitedCells = listHitofudePuzzleOpenCells(board).filter(
    (cell) => !visited.has(cell),
  );
  const isolatedCells: number[] = [];
  const deadEndCells: number[] = [];
  for (const cell of unvisitedCells) {
    const entranceCount =
      listUnvisitedNeighbors(adjacency, visited, cell).length +
      (adjacency[head]!.includes(cell) ? 1 : 0);
    if (entranceCount === 0) {
      isolatedCells.push(cell);
    } else if (entranceCount === 1) {
      deadEndCells.push(cell);
    }
  }
  const reachable = listCellsReachableThroughUnvisited(
    adjacency,
    visited,
    head,
  );
  const separatedCells = unvisitedCells.filter((cell) => !reachable.has(cell));
  const stranding = {
    isolatedCells,
    // 終点は1つなので、2つ以上あるときだけ挙げる。
    deadEndCells: deadEndCells.length >= 2 ? deadEndCells : [],
    separatedCells,
  };
  return Object.values(stranding).some((cells) => cells.length > 0)
    ? stranding
    : null;
}

export function areHitofudePuzzleOpenCellsConnected(
  board: HitofudePuzzleBoard,
): boolean {
  const adjacency = createHitofudePuzzleAdjacency(board);
  const reachable = listCellsReachableThroughUnvisited(
    adjacency,
    new Set(),
    board.start,
  );
  reachable.add(board.start);
  return reachable.size === listHitofudePuzzleOpenCells(board).length;
}
