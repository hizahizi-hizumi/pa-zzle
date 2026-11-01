import {
  createHamiltonianPathAdjacency,
  type HamiltonianPathBoard,
  isHamiltonianPathCellOnBoard,
  listHamiltonianPathOpenCells,
} from "@/games/hamiltonian-path/puzzle/board";

/**
 * 道が規則を満たして全有効マスを通ったか。道を作った入力処理を信頼せず、規則だけで確かめる。
 * 先頭が始点で、続く2マスが上下左右に隣り合い、穴と同じマスを通らず、穴でない全マスを含むこと。
 * 問題は一意解なので、保存した解との一致は要らない。
 */
export function isHamiltonianPathSolved(
  board: HamiltonianPathBoard,
  path: readonly number[],
): boolean {
  if (path[0] !== board.start) {
    return false;
  }
  const openCellCount = listHamiltonianPathOpenCells(board).length;
  if (path.length !== openCellCount) {
    return false;
  }
  const adjacency = createHamiltonianPathAdjacency(board);
  const visited = new Set<number>();
  for (const [index, cell] of path.entries()) {
    const previous = path[index - 1];
    if (
      !isHamiltonianPathCellOnBoard(board.size, cell) ||
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

/** 全有効マスを通る前に、先端から延ばせる未通過マスが無くなったか。 */
export function isHamiltonianPathDeadEnd(
  board: HamiltonianPathBoard,
  path: readonly number[],
): boolean {
  const head = path.at(-1);
  if (
    head === undefined ||
    path.length >= listHamiltonianPathOpenCells(board).length
  ) {
    return false;
  }
  const adjacency = createHamiltonianPathAdjacency(board);
  return listUnvisitedNeighbors(adjacency, new Set(path), head).length === 0;
}

/**
 * 今の道のまま延ばしても全マスを通れないと、盤面から機械的に分かる未通過マス。
 * - `isolatedCells`: 先端からも他の未通過マスからも入れないマス。
 * - `deadEndCells`: 入れる隣が1つだけで、道の終点にしかなれないマス。終点は1つなので、2つ以上あるときだけ挙げる。
 * - `separatedCells`: 先端から未通過マスだけをたどって届かないマス。
 */
export type HamiltonianPathStranding = {
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

/**
 * 取り残し（孤立マス・余分な袋小路・道で切り離された領域）を見つける。何も無ければ `null`。
 * 先の手詰まりを示す情報なので、通常のプレイ画面には出さない。
 */
export function findHamiltonianPathStranding(
  board: HamiltonianPathBoard,
  path: readonly number[],
): HamiltonianPathStranding | null {
  const head = path.at(-1);
  if (head === undefined) {
    return null;
  }
  const adjacency = createHamiltonianPathAdjacency(board);
  const visited = new Set(path);
  const unvisitedCells = listHamiltonianPathOpenCells(board).filter(
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
    deadEndCells: deadEndCells.length >= 2 ? deadEndCells : [],
    separatedCells,
  };
  return Object.values(stranding).some((cells) => cells.length > 0)
    ? stranding
    : null;
}

/** 穴でないマスが、上下左右の隣接で1つにつながっているか。 */
export function areHamiltonianPathOpenCellsConnected(
  board: HamiltonianPathBoard,
): boolean {
  const adjacency = createHamiltonianPathAdjacency(board);
  const reachable = listCellsReachableThroughUnvisited(
    adjacency,
    new Set(),
    board.start,
  );
  reachable.add(board.start);
  return reachable.size === listHamiltonianPathOpenCells(board).length;
}
