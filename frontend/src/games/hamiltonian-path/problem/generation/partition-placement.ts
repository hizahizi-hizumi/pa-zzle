import {
  countHamiltonianPathSolutions,
  HAMILTONIAN_PATH_UNIQUENESS_SEARCH_STEP_LIMIT,
} from "@/games/hamiltonian-path/problem/generation/solver";
import {
  createHamiltonianPathPartition,
  type HamiltonianPathBoard,
  type HamiltonianPathPartition,
  normalizeHamiltonianPathPartitions,
} from "@/games/hamiltonian-path/puzzle/board";
import { type ProblemRandom, shuffleProblemValues } from "@/games/problem-seed";

function listPathEdges(path: readonly number[]): HamiltonianPathPartition[] {
  return path
    .slice(1)
    .map((cell, index) => createHamiltonianPathPartition(path[index]!, cell));
}

function edgeKey([left, right]: HamiltonianPathPartition): string {
  return `${left}-${right}`;
}

function isSamePath(
  left: readonly number[],
  right: readonly number[],
): boolean {
  return (
    left.length === right.length &&
    left.every((cell, index) => cell === right[index])
  );
}

/**
 * 解の道 `solution` を壊さずに、その道だけが解になるよう仕切りを置く（thin 方式）。
 * 別解が見つかる間、別解だけが通る辺から1本を無作為に選んで仕切りを足す。一意になったら、
 * 足した仕切りを無作為な順に1本ずつ外してみて、外しても一意のままなら外す。残る仕切りはどれも、外すと一意でなくなる。
 * 探索量の上限で一意かを確かめ切れなかったら `null` を返す。
 */
export function placeHamiltonianPathPartitions(
  board: Omit<HamiltonianPathBoard, "partitions">,
  solution: readonly number[],
  random: ProblemRandom,
  searchStepLimit = HAMILTONIAN_PATH_UNIQUENESS_SEARCH_STEP_LIMIT,
): HamiltonianPathPartition[] | null {
  const solutionEdges = new Set(listPathEdges(solution).map(edgeKey));

  function searchSolutions(partitions: readonly HamiltonianPathPartition[]) {
    return countHamiltonianPathSolutions(
      { ...board, partitions: normalizeHamiltonianPathPartitions(partitions) },
      { searchStepLimit },
    );
  }

  let partitions: HamiltonianPathPartition[] = [];
  for (;;) {
    const search = searchSolutions(partitions);
    if (search.status === "search-limit-reached") {
      return null;
    }
    if (search.solutionCount === 1) {
      break;
    }
    const otherSolution = search.firstSolutions.find(
      (candidate) => !isSamePath(candidate, solution),
    )!;
    const otherOnlyEdges = listPathEdges(otherSolution).filter(
      (edge) => !solutionEdges.has(edgeKey(edge)),
    );
    partitions.push(
      otherOnlyEdges[Math.floor(random() * otherOnlyEdges.length)]!,
    );
  }

  for (const partition of shuffleProblemValues(partitions, random)) {
    const remaining = partitions.filter((kept) => kept !== partition);
    const search = searchSolutions(remaining);
    if (search.status === "search-limit-reached") {
      return null;
    }
    if (search.solutionCount === 1) {
      partitions = remaining;
    }
  }
  return normalizeHamiltonianPathPartitions(partitions);
}
