import { placeHamiltonianPathPartitions } from "@/games/hamiltonian-path/problem/generation/partition-placement";
import { createRandomSelfAvoidingWalk } from "@/games/hamiltonian-path/problem/generation/self-avoiding-walk";
import { countHamiltonianPathSolutions } from "@/games/hamiltonian-path/problem/generation/solver";
import { createHamiltonianPathPartition } from "@/games/hamiltonian-path/puzzle/board";
import { createProblemSeededRandom } from "@/games/problem-seed";

function createWallBoard(size: number, solution: readonly number[]) {
  const openCells = new Set(solution);
  return {
    size,
    walls: Array.from({ length: size * size }, (_, cell) => cell).filter(
      (cell) => !openCells.has(cell),
    ),
    start: solution[0]!,
  };
}

describe("placeHamiltonianPathPartitions", () => {
  const size = 6;
  const solution = createRandomSelfAvoidingWalk(
    size,
    36,
    createProblemSeededRandom("partition-placement"),
  );
  const board = createWallBoard(size, solution);
  const solutionEdges = solution
    .slice(1)
    .map((cell, index) =>
      createHamiltonianPathPartition(solution[index]!, cell).join("-"),
    );

  test("元の道だけが解になる仕切りを置くこと", () => {
    const partitions = placeHamiltonianPathPartitions(
      board,
      solution,
      createProblemSeededRandom("place"),
    );

    const search = countHamiltonianPathSolutions({
      ...board,
      partitions: partitions ?? [],
    });
    expect(partitions).not.toBeNull();
    expect(search.status).toBe("complete");
    expect(search.solutionCount).toBe(1);
    expect(search.firstSolutions[0]).toEqual(solution);
  });

  test("元の道が通る辺には仕切りを置かないこと", () => {
    const partitions = placeHamiltonianPathPartitions(
      board,
      solution,
      createProblemSeededRandom("place"),
    );

    const blockedSolutionEdges = (partitions ?? []).filter((partition) =>
      solutionEdges.includes(partition.join("-")),
    );
    expect(blockedSolutionEdges).toEqual([]);
  });

  test("どの仕切りも、外すと解が一意でなくなること", () => {
    const partitions = placeHamiltonianPathPartitions(
      board,
      solution,
      createProblemSeededRandom("place"),
    );

    const solutionCountsWithoutEach = (partitions ?? []).map(
      (removed) =>
        countHamiltonianPathSolutions({
          ...board,
          partitions: (partitions ?? []).filter((kept) => kept !== removed),
        }).solutionCount,
    );
    expect(solutionCountsWithoutEach.length).toBeGreaterThan(0);
    expect(solutionCountsWithoutEach.every((count) => count >= 2)).toBe(true);
  });

  test("探索量の上限までに一意にし切れなければ null を返すこと", () => {
    const partitions = placeHamiltonianPathPartitions(
      board,
      solution,
      createProblemSeededRandom("place"),
      1,
    );

    expect(partitions).toBeNull();
  });
});
