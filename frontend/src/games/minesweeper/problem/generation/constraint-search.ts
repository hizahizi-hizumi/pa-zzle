import type { MinesweeperNumberConstraint } from "./deduction-state";

/**
 * 数字制約の同時充足を列挙するための探索表現。
 * `cellIndices` は探索順で、制約が早く閉じるよう制約の重なりを幅優先でたどった順に並ぶ。
 */
export type MinesweeperConstraintSystem = {
  cellIndices: readonly number[];
  constraintIdsByPosition: readonly (readonly number[])[];
  constraintMineCounts: readonly number[];
  constraintCellCounts: readonly number[];
};

export type MinesweeperConstraintSolutionVisitor = (
  isMineByPosition: Uint8Array,
  mineCount: number,
) => "continue" | "stop";

export type MinesweeperConstraintSearchResult = {
  outcome: "exhausted" | "stopped" | "truncated";
  visitedNodeCount: number;
};

export function createMinesweeperConstraintSystem(
  constraints: readonly MinesweeperNumberConstraint[],
): MinesweeperConstraintSystem {
  const constraintIdsByCell = new Map<number, number[]>();
  constraints.forEach((constraint, constraintId) => {
    for (const cellIndex of constraint.cellIndices) {
      const constraintIds = constraintIdsByCell.get(cellIndex) ?? [];
      constraintIds.push(constraintId);
      constraintIdsByCell.set(cellIndex, constraintIds);
    }
  });

  const cellIndices: number[] = [];
  const orderedCells = new Set<number>();
  const visitedConstraints = new Set<number>();
  for (let startId = 0; startId < constraints.length; startId += 1) {
    if (visitedConstraints.has(startId)) {
      continue;
    }
    visitedConstraints.add(startId);
    const pendingConstraintIds = [startId];
    for (
      let pendingIndex = 0;
      pendingIndex < pendingConstraintIds.length;
      pendingIndex += 1
    ) {
      const constraint = constraints[pendingConstraintIds[pendingIndex]!]!;
      for (const cellIndex of constraint.cellIndices) {
        if (!orderedCells.has(cellIndex)) {
          orderedCells.add(cellIndex);
          cellIndices.push(cellIndex);
        }
        for (const neighborId of constraintIdsByCell.get(cellIndex)!) {
          if (!visitedConstraints.has(neighborId)) {
            visitedConstraints.add(neighborId);
            pendingConstraintIds.push(neighborId);
          }
        }
      }
    }
  }

  return {
    cellIndices,
    constraintIdsByPosition: cellIndices.map(
      (cellIndex) => constraintIdsByCell.get(cellIndex)!,
    ),
    constraintMineCounts: constraints.map((constraint) => constraint.mineCount),
    constraintCellCounts: constraints.map(
      (constraint) => constraint.cellIndices.length,
    ),
  };
}

/**
 * 全制約を満たす地雷配置をバックトラッキングで列挙する。
 * 割り当てのたびに関係する制約の地雷数が不足・超過しえないかを確かめて枝を刈る。
 * 試した割り当て数が `maximumNodeCount` を超えたら `truncated` で打ち切る。
 */
export function enumerateMinesweeperConstraintSolutions(
  system: MinesweeperConstraintSystem,
  visitSolution: MinesweeperConstraintSolutionVisitor,
  maximumNodeCount: number,
): MinesweeperConstraintSearchResult {
  const cellCount = system.cellIndices.length;
  const isMineByPosition = new Uint8Array(cellCount);
  const assignedMineCounts = Int32Array.from(
    system.constraintMineCounts,
    () => 0,
  );
  const unassignedCellCounts = Int32Array.from(system.constraintCellCounts);
  let nodeCount = 0;
  let outcome: MinesweeperConstraintSearchResult["outcome"] = "exhausted";

  function canAssign(position: number, isMine: number): boolean {
    for (const constraintId of system.constraintIdsByPosition[position]!) {
      const mines = assignedMineCounts[constraintId]! + isMine;
      const required = system.constraintMineCounts[constraintId]!;
      if (
        mines > required ||
        mines + unassignedCellCounts[constraintId]! - 1 < required
      ) {
        return false;
      }
    }
    return true;
  }

  function assign(position: number, isMine: number, direction: 1 | -1): void {
    isMineByPosition[position] = direction === 1 ? isMine : 0;
    for (const constraintId of system.constraintIdsByPosition[position]!) {
      assignedMineCounts[constraintId]! += isMine * direction;
      unassignedCellCounts[constraintId]! -= direction;
    }
  }

  function search(position: number, mineCount: number): boolean {
    if (position === cellCount) {
      if (visitSolution(isMineByPosition, mineCount) === "stop") {
        outcome = "stopped";
        return false;
      }
      return true;
    }

    for (let isMine = 0; isMine <= 1; isMine += 1) {
      nodeCount += 1;
      if (nodeCount > maximumNodeCount) {
        outcome = "truncated";
        return false;
      }
      if (!canAssign(position, isMine)) {
        continue;
      }
      assign(position, isMine, 1);
      const shouldContinue = search(position + 1, mineCount + isMine);
      assign(position, isMine, -1);
      if (!shouldContinue) {
        return false;
      }
    }
    return true;
  }

  search(0, 0);
  return { outcome, visitedNodeCount: Math.min(nodeCount, maximumNodeCount) };
}
