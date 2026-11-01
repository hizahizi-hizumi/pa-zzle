import {
  createHitofudePuzzleRefuter,
  type HitofudePuzzleHumanSolveOptions,
  type HitofudePuzzleRefutationStage,
} from "@/games/hitofude-puzzle/problem/generation/human-solver";
import {
  createHitofudePuzzleAdjacency,
  type HitofudePuzzleBoard,
  listHitofudePuzzleOpenCells,
} from "@/games/hitofude-puzzle/puzzle/board";
import { findHitofudePuzzleStranding } from "@/games/hitofude-puzzle/puzzle/rules";

/** 誤った手を退けるのに要った段階。`6` は1段仮置きを重ねても退けられなかった手。 */
export type HitofudePuzzleBranchRefutationStage =
  | HitofudePuzzleRefutationStage
  | 6;

/**
 * 始点から解の道を引き進めるプレイヤーが出会う分岐。
 * - `branchCount`: 先端から進める手のうち、取り残し（`findHitofudePuzzleStranding`）がすぐには見えない手が2つ以上ある地点の数。
 * - `fatalBranchCount`: そのうち、全マスを通れなくなる手を含む地点の数。一意解の問題では、解の道以外の手はすべてそう。
 * - `fatalBranchCountByStage`: 致命的な分岐を、そこで最も見抜きにくい誤った手を退けるのに要る段階で数えたもの。
 * - `longestTrapLength`: 誤った手に入ってから、取り残しがすぐには見えないまま引き進められる最も長いマス数。
 *   探索量の上限に達したら `null`（それより長い）。
 */
export type HitofudePuzzleDrawingBranches = {
  branchCount: number;
  fatalBranchCount: number;
  fatalBranchCountByStage: Readonly<
    Record<HitofudePuzzleBranchRefutationStage, number>
  >;
  longestTrapLength: number | null;
};

/** 誤った手から引き進める探索の節点数の上限。研究用 Python の `decision_profile` と同じ値。 */
const TRAP_SEARCH_STEP_LIMIT = 3_000;

/**
 * 取り残しがすぐには見えない間だけ道を延ばし続けたときに届く、最も長い道のマス数。解が見つかるか上限に達したら `null`。
 * 研究用 Python の `PathCounter.count`（パリティ・関節点の枝刈りなし）の `max_depth` と同じ量で、
 * 枝刈りの条件は `findHitofudePuzzleStranding` と同じ（孤立マス・2つ以上の袋小路・先端から届かないマス）。
 */
function measureLongestUnstrandedPath(
  adjacency: readonly (readonly number[])[],
  openCells: readonly number[],
  path: readonly number[],
): number | null {
  const visited = new Uint8Array(adjacency.length);
  for (const cell of path) {
    visited[cell] = 1;
  }
  const degrees = new Int32Array(adjacency.length);
  const unvisitedCells = openCells.filter((cell) => !visited[cell]);
  for (const cell of unvisitedCells) {
    degrees[cell] = adjacency[cell]!.filter(
      (neighbor) => !visited[neighbor],
    ).length;
  }
  const firstHead = path.at(-1)!;
  let deadEndCount = 0;
  for (const cell of unvisitedCells) {
    const entrances =
      degrees[cell]! + (adjacency[firstHead]!.includes(cell) ? 1 : 0);
    if (entrances === 0) {
      return 0;
    }
    if (entrances === 1) {
      deadEndCount += 1;
    }
  }
  let pathLength = path.length;
  let longest = 0;
  let steps = 0;
  let foundSolution = false;
  let limitReached = false;

  function isRestReachable(head: number, remaining: number): boolean {
    const reached = new Set<number>();
    const pending = [head];
    for (let cell = pending.pop(); cell !== undefined; cell = pending.pop()) {
      for (const neighbor of adjacency[cell]!) {
        if (!visited[neighbor] && !reached.has(neighbor)) {
          reached.add(neighbor);
          pending.push(neighbor);
        }
      }
    }
    return reached.size === remaining;
  }

  function extend(head: number, remaining: number, deadEnds: number): void {
    steps += 1;
    if (steps > TRAP_SEARCH_STEP_LIMIT) {
      limitReached = true;
      return;
    }
    longest = Math.max(longest, pathLength);
    for (const next of adjacency[head]!) {
      if (visited[next]) {
        continue;
      }
      const remainingAfter = remaining - 1;
      if (degrees[next] === 0 && remainingAfter > 0) {
        continue;
      }
      let nextDeadEnds = degrees[next] === 0 ? deadEnds - 1 : deadEnds;
      visited[next] = 1;
      for (const neighbor of adjacency[next]!) {
        if (!visited[neighbor]) {
          degrees[neighbor] = degrees[neighbor]! - 1;
        }
      }
      let stranded = false;
      for (const neighbor of adjacency[head]!) {
        if (visited[neighbor] || neighbor === next) {
          continue;
        }
        if (degrees[neighbor] === 0) {
          stranded = true;
        } else if (degrees[neighbor] === 1) {
          nextDeadEnds += 1;
        }
      }
      stranded ||= remainingAfter > 0 && nextDeadEnds > 1;
      stranded ||= remainingAfter > 0 && !isRestReachable(next, remainingAfter);
      if (!stranded) {
        pathLength += 1;
        if (remainingAfter === 0) {
          foundSolution = true;
        } else {
          extend(next, remainingAfter, nextDeadEnds);
        }
        pathLength -= 1;
      }
      for (const neighbor of adjacency[next]!) {
        if (!visited[neighbor]) {
          degrees[neighbor] = degrees[neighbor]! + 1;
        }
      }
      visited[next] = 0;
      if (foundSolution || limitReached) {
        return;
      }
    }
  }

  extend(firstHead, unvisitedCells.length, deadEndCount);
  return foundSolution || limitReached ? null : longest;
}

/**
 * 一意解の問題で、始点から解の道 `solution` をたどり、各分岐で誤った手を退けるのに要る推論の段階を測る。
 * 研究用 Python の `decision_profile`（一意解の場合）と同じ分岐の数え方・同じ段階の判定をする。
 * 一意解なので、解の道以外の手はすべて誤りとして扱い、完成できるかを探索で確かめない。
 * 段階の判定が作業量の上限に達したら `work-limit-reached` を返す。
 */
export function analyzeHitofudePuzzleDrawingBranches(
  board: HitofudePuzzleBoard,
  solution: readonly number[],
  options: HitofudePuzzleHumanSolveOptions = {},
): HitofudePuzzleDrawingBranches | "work-limit-reached" {
  const adjacency = createHitofudePuzzleAdjacency(board);
  const openCells = listHitofudePuzzleOpenCells(board);
  const refuter = createHitofudePuzzleRefuter(board, options);
  const fatalBranchCountByStage = { 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  let branchCount = 0;
  let fatalBranchCount = 0;
  let longestTrapLength: number | null = 0;

  for (let index = 0; index + 1 < solution.length; index += 1) {
    const prefix = solution.slice(0, index + 1);
    const head = solution[index]!;
    const unstrandedMoves = adjacency[head]!.filter(
      (cell) =>
        !prefix.includes(cell) &&
        findHitofudePuzzleStranding(board, [...prefix, cell]) === null,
    );
    if (unstrandedMoves.length < 2) {
      continue;
    }
    branchCount += 1;
    let hardestStage: HitofudePuzzleBranchRefutationStage | null = null;
    for (const wrongMove of unstrandedMoves) {
      if (wrongMove === solution[index + 1]) {
        continue;
      }
      const wrongPath = [...prefix, wrongMove];
      const refutation = refuter.findRefutationStage(wrongPath);
      if (refutation === "work-limit-reached") {
        return refutation;
      }
      const stage = refutation ?? 6;
      hardestStage = Math.max(
        hardestStage ?? stage,
        stage,
      ) as HitofudePuzzleBranchRefutationStage;
      const trapPathLength = measureLongestUnstrandedPath(
        adjacency,
        openCells,
        wrongPath,
      );
      longestTrapLength =
        trapPathLength === null || longestTrapLength === null
          ? null
          : Math.max(longestTrapLength, trapPathLength - prefix.length);
    }
    if (hardestStage !== null) {
      fatalBranchCount += 1;
      fatalBranchCountByStage[hardestStage] += 1;
    }
  }
  return {
    branchCount,
    fatalBranchCount,
    fatalBranchCountByStage,
    longestTrapLength,
  };
}
