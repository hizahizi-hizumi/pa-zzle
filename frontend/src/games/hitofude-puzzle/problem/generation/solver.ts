import {
  createHitofudePuzzleAdjacency,
  getHitofudePuzzleCellPosition,
  type HitofudePuzzleBoard,
  listHitofudePuzzleOpenCells,
} from "@/games/hitofude-puzzle/puzzle/board";

/**
 * - `status`: `search-limit-reached` なら探索量の上限で打ち切ったため、`solutionCount` は下限にすぎない。
 * - `solutionCount`: 見つけた解の数。`solutionLimit` で頭打ちにする。
 * - `firstSolutions`: 最初に見つけた解を2本まで。別解を求める一意化で使う。
 * - `searchStepCount`: たどった探索の節点の数。
 */
export type HitofudePuzzleSolutionSearchResult = {
  status: "complete" | "search-limit-reached";
  solutionCount: number;
  firstSolutions: readonly (readonly number[])[];
  searchStepCount: number;
};

/**
 * - `solutionLimit`: この数の解が見つかったら打ち切る。一意性の確認には2で足りる。
 * - `searchStepLimit`: 探索の節点の数の上限。
 *   時間ではなく探索量で打ち切るのは、同じ入力に同じ結果を返し、生成器が identity から同じ問題を再現できるようにするため。
 */
export type HitofudePuzzleSolutionSearchOptions = {
  solutionLimit?: number;
  searchStepLimit?: number;
};

/** 一意性の確認で1回の探索に許す節点の数。 */
export const HITOFUDE_PUZZLE_UNIQUENESS_SEARCH_STEP_LIMIT = 20_000;

const keptSolutionCount = 2;

type SearchGraph = {
  neighbors: readonly (readonly number[])[];
  colors: Uint8Array;
  openCells: readonly number[];
};

function createSearchGraph(board: HitofudePuzzleBoard): SearchGraph {
  const cellCount = board.size * board.size;
  const colors = new Uint8Array(cellCount);
  for (let cell = 0; cell < cellCount; cell += 1) {
    const { row, column } = getHitofudePuzzleCellPosition(board.size, cell);
    colors[cell] = (row + column) & 1;
  }
  return {
    neighbors: createHitofudePuzzleAdjacency(board),
    colors,
    openCells: listHitofudePuzzleOpenCells(board),
  };
}

/**
 * 始点から道を延ばす全解探索。研究用 Python（`scripts/research/hamiltonian_path_experiment.py` の `PathCounter.count`）と
 * 同じ枝刈り・同じ手順で、同じ盤面には同じ解の数と節点の数を返す。
 *
 * 枝刈り: 次へ進めないマスが残る（孤立）、終点にしかなれないマスが2つ以上残る（行き止まり）、
 * 残りのマスの色（市松模様）の数が交互にたどれない（パリティ）、残りのマスが先端から1つにつながらない（連結）、
 * 先端と残りのマスのつながりが関節点で切れ、切り離された側を通り切れない（関節点）。
 */
class SolutionSearch {
  readonly #graph: SearchGraph;
  readonly #solutionLimit: number;
  readonly #searchStepLimit: number;
  readonly #visited: Uint8Array;
  readonly #unvisitedDegrees: Int32Array;
  readonly #colorCounts: [number, number] = [0, 0];
  readonly #path: number[] = [];
  readonly #solutions: number[][] = [];
  #solutionCount = 0;
  #searchStepCount = 0;
  #limitReached = false;

  readonly #reachStamps: Int32Array;
  #reachStamp = 0;
  readonly #pendingCells: Int32Array;
  readonly #discovery: Int32Array;
  readonly #low: Int32Array;
  readonly #subtreeSizes: Int32Array;
  readonly #subtreeColorZeroCounts: Int32Array;
  readonly #separatedCounts: Int32Array;
  readonly #stackCells: Int32Array;
  readonly #stackParents: Int32Array;
  readonly #stackNextNeighbors: Int32Array;

  constructor(
    graph: SearchGraph,
    solutionLimit: number,
    searchStepLimit: number,
  ) {
    this.#graph = graph;
    this.#solutionLimit = solutionLimit;
    this.#searchStepLimit = searchStepLimit;
    const cellCount = graph.colors.length;
    this.#visited = new Uint8Array(cellCount);
    this.#unvisitedDegrees = new Int32Array(cellCount);
    this.#reachStamps = new Int32Array(cellCount);
    this.#pendingCells = new Int32Array(cellCount);
    this.#discovery = new Int32Array(cellCount);
    this.#low = new Int32Array(cellCount);
    this.#subtreeSizes = new Int32Array(cellCount);
    this.#subtreeColorZeroCounts = new Int32Array(cellCount);
    this.#separatedCounts = new Int32Array(cellCount);
    this.#stackCells = new Int32Array(cellCount);
    this.#stackParents = new Int32Array(cellCount);
    this.#stackNextNeighbors = new Int32Array(cellCount);
  }

  run(start: number): HitofudePuzzleSolutionSearchResult {
    const { neighbors, colors, openCells } = this.#graph;
    const visited = this.#visited;
    visited[start] = 1;
    const remainingCells = openCells.filter((cell) => cell !== start);
    for (const cell of remainingCells) {
      this.#unvisitedDegrees[cell] = neighbors[cell]!.filter(
        (neighbor) => !visited[neighbor],
      ).length;
      this.#colorCounts[colors[cell]!] = this.#colorCounts[colors[cell]!]! + 1;
    }
    this.#path.push(start);

    let deadEndCount = 0;
    for (const cell of remainingCells) {
      const entranceCount =
        this.#unvisitedDegrees[cell]! +
        (neighbors[start]!.includes(cell) ? 1 : 0);
      if (entranceCount === 0) {
        return this.#result();
      }
      if (entranceCount === 1) {
        deadEndCount += 1;
      }
    }
    if (remainingCells.length === 0) {
      this.#recordSolution();
      return this.#result();
    }
    this.#extend(start, remainingCells.length, deadEndCount);
    return this.#result();
  }

  #result(): HitofudePuzzleSolutionSearchResult {
    return {
      status: this.#limitReached ? "search-limit-reached" : "complete",
      solutionCount: Math.min(this.#solutionCount, this.#solutionLimit),
      firstSolutions: this.#solutions,
      searchStepCount: this.#searchStepCount,
    };
  }

  #recordSolution(): void {
    this.#solutionCount += 1;
    if (this.#solutions.length < keptSolutionCount) {
      this.#solutions.push([...this.#path]);
    }
  }

  /** 打ち切ったときは探索の状態を戻さずに抜ける。結果を返した後は使わない。 */
  #extend(head: number, remaining: number, deadEndCount: number): void {
    this.#searchStepCount += 1;
    if (this.#searchStepCount > this.#searchStepLimit) {
      this.#limitReached = true;
      return;
    }
    const { neighbors, colors } = this.#graph;
    const visited = this.#visited;
    const degrees = this.#unvisitedDegrees;
    const colorCounts = this.#colorCounts;
    const candidates = neighbors[head]!.filter((cell) => !visited[cell]).sort(
      (left, right) => degrees[left]! - degrees[right]!,
    );

    for (const next of candidates) {
      const remainingAfter = remaining - 1;
      if (degrees[next] === 0 && remainingAfter > 0) {
        continue;
      }
      let nextDeadEndCount = deadEndCount;
      if (degrees[next] === 0) {
        nextDeadEndCount -= 1;
      }
      const nextColor = colors[next]!;
      if (remainingAfter > 0) {
        // 残りのマスは next の次のマスの色から交互に並ぶので、次の色が半分を切り上げた数だけ要る。
        const followingColorCount = colorCounts[1 - nextColor]!;
        const sameColorCountAfter = colorCounts[nextColor]! - 1;
        if (
          followingColorCount !== Math.ceil(remainingAfter / 2) ||
          sameColorCountAfter !== Math.floor(remainingAfter / 2)
        ) {
          continue;
        }
      }

      visited[next] = 1;
      colorCounts[nextColor] = colorCounts[nextColor]! - 1;
      for (const neighbor of neighbors[next]!) {
        if (!visited[neighbor]) {
          degrees[neighbor] = degrees[neighbor]! - 1;
        }
      }
      let pruned = false;
      for (const neighbor of neighbors[head]!) {
        if (visited[neighbor] || neighbor === next) {
          continue;
        }
        if (degrees[neighbor] === 0) {
          pruned = true;
        } else if (degrees[neighbor] === 1) {
          nextDeadEndCount += 1;
        }
      }
      pruned ||= remainingAfter > 0 && nextDeadEndCount > 1;
      pruned ||=
        remainingAfter > 0 && !this.#isRestConnected(next, remainingAfter);
      pruned ||=
        remainingAfter > 2 && !this.#isCutStructureSound(next, remainingAfter);
      if (!pruned) {
        this.#path.push(next);
        if (remainingAfter === 0) {
          this.#recordSolution();
        } else {
          this.#extend(next, remainingAfter, nextDeadEndCount);
          if (this.#limitReached) {
            return;
          }
        }
        this.#path.pop();
      }
      for (const neighbor of neighbors[next]!) {
        if (!visited[neighbor]) {
          degrees[neighbor] = degrees[neighbor]! + 1;
        }
      }
      colorCounts[nextColor] = colorCounts[nextColor]! + 1;
      visited[next] = 0;
      if (this.#solutionCount >= this.#solutionLimit) {
        return;
      }
    }
  }

  /** 先端から未訪問マスだけをたどって、残りの全マスへ届くか。 */
  #isRestConnected(head: number, remaining: number): boolean {
    const { neighbors } = this.#graph;
    const visited = this.#visited;
    this.#reachStamp += 1;
    const stamp = this.#reachStamp;
    const pending = this.#pendingCells;
    let pendingCount = 0;
    let reachedCount = 0;
    pending[pendingCount++] = head;
    this.#reachStamps[head] = stamp;
    while (pendingCount > 0) {
      const cell = pending[--pendingCount]!;
      for (const neighbor of neighbors[cell]!) {
        if (!visited[neighbor] && this.#reachStamps[neighbor] !== stamp) {
          this.#reachStamps[neighbor] = stamp;
          reachedCount += 1;
          pending[pendingCount++] = neighbor;
        }
      }
    }
    return reachedCount === remaining;
  }

  /**
   * 先端と未訪問マスがなすグラフを深さ優先でたどり、関節点で切り離される部分を調べる。
   * 先端そのものが関節点なら、道はどちらか一方へしか進めない。先端以外の関節点で切り離される部分は、
   * 道がその関節点から入って終点まで通り切るしかないので、高々1つで、市松模様の色の数と、関節点に着く順番の偶奇が合う必要がある。
   */
  #isCutStructureSound(head: number, remaining: number): boolean {
    const { neighbors, colors } = this.#graph;
    const visited = this.#visited;
    const discovery = this.#discovery.fill(-1);
    const low = this.#low;
    const sizes = this.#subtreeSizes;
    const colorZeroCounts = this.#subtreeColorZeroCounts;
    const separatedCounts = this.#separatedCounts.fill(0);
    const stackCells = this.#stackCells;
    const stackParents = this.#stackParents;
    const stackNextNeighbors = this.#stackNextNeighbors;
    const headColor = colors[head]!;
    const total = remaining + 1;

    discovery[head] = 0;
    low[head] = 0;
    sizes[head] = 1;
    colorZeroCounts[head] = 1 - headColor;
    let timer = 1;
    let rootChildCount = 0;
    let top = 0;
    stackCells[0] = head;
    stackParents[0] = -1;
    stackNextNeighbors[0] = 0;

    while (top >= 0) {
      const cell = stackCells[top]!;
      const parent = stackParents[top]!;
      const cellNeighbors = neighbors[cell]!;
      let descended = false;
      while (stackNextNeighbors[top]! < cellNeighbors.length) {
        const neighbor = cellNeighbors[stackNextNeighbors[top]!]!;
        stackNextNeighbors[top] = stackNextNeighbors[top]! + 1;
        if ((visited[neighbor] && neighbor !== head) || neighbor === parent) {
          continue;
        }
        if (discovery[neighbor]! >= 0) {
          low[cell] = Math.min(low[cell]!, discovery[neighbor]!);
          continue;
        }
        discovery[neighbor] = timer;
        low[neighbor] = timer;
        timer += 1;
        sizes[neighbor] = 1;
        colorZeroCounts[neighbor] = 1 - colors[neighbor]!;
        top += 1;
        stackCells[top] = neighbor;
        stackParents[top] = cell;
        stackNextNeighbors[top] = 0;
        descended = true;
        break;
      }
      if (descended) {
        continue;
      }
      top -= 1;
      if (parent === -1) {
        continue;
      }
      low[parent] = Math.min(low[parent]!, low[cell]!);
      sizes[parent] = sizes[parent]! + sizes[cell]!;
      colorZeroCounts[parent] =
        colorZeroCounts[parent]! + colorZeroCounts[cell]!;
      if (parent === head) {
        rootChildCount += 1;
        if (rootChildCount >= 2) {
          return false;
        }
        continue;
      }
      if (low[cell]! >= discovery[parent]!) {
        separatedCounts[parent] = separatedCounts[parent]! + 1;
        if (separatedCounts[parent]! >= 2) {
          return false;
        }
        const componentSize = sizes[cell]!;
        const parentColor = colors[parent]!;
        const otherColorCount =
          parentColor === 1
            ? colorZeroCounts[cell]!
            : componentSize - colorZeroCounts[cell]!;
        if (otherColorCount !== Math.floor((componentSize + 1) / 2)) {
          return false;
        }
        const prefixLength = total - componentSize;
        const colorAtParent =
          prefixLength % 2 === 1 ? headColor : 1 - headColor;
        if (colorAtParent !== parentColor) {
          return false;
        }
      }
    }
    return true;
  }
}

/** 始点から全有効マスをちょうど1回ずつ通る道を数える。 */
export function countHitofudePuzzleSolutions(
  board: HitofudePuzzleBoard,
  options: HitofudePuzzleSolutionSearchOptions = {},
): HitofudePuzzleSolutionSearchResult {
  const search = new SolutionSearch(
    createSearchGraph(board),
    options.solutionLimit ?? 2,
    options.searchStepLimit ?? HITOFUDE_PUZZLE_UNIQUENESS_SEARCH_STEP_LIMIT,
  );
  return search.run(board.start);
}

/** 解がただ1つだと、探索量の上限までに確かめられたか。上限に達した盤面は一意とみなさない。 */
export function isHitofudePuzzleUniquelySolvable(
  board: HitofudePuzzleBoard,
  searchStepLimit = HITOFUDE_PUZZLE_UNIQUENESS_SEARCH_STEP_LIMIT,
): boolean {
  const result = countHitofudePuzzleSolutions(board, { searchStepLimit });
  return result.status === "complete" && result.solutionCount === 1;
}
