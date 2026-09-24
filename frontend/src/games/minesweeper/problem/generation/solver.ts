import type { MinesweeperProblem } from "../problem";
import {
  createMinesweeperConstraintSystem,
  enumerateMinesweeperConstraintSolutions,
  type MinesweeperConstraintSystem,
} from "./constraint-search";
import {
  applyMinesweeperDeduction,
  collectMinesweeperNumberConstraints,
  countRemainingMinesweeperMines,
  createMinesweeperDeductionState,
  isMinesweeperDeductionComplete,
  isMinesweeperDeductionEmpty,
  listUndeterminedMinesweeperCellIndices,
  type MinesweeperDeduction,
  type MinesweeperDeductionState,
  type MinesweeperNumberConstraint,
} from "./deduction-state";

export const MINESWEEPER_SOLVER_MAXIMUM_NODE_COUNT = 2_000_000;

export type MinesweeperSolverOptions = {
  maximumNodeCount?: number;
};

/**
 * 可視情報から確実に言えるマス。
 * `withoutTotalMineCount` は数字制約だけから、`withTotalMineCount` は総地雷数も合わせて確定するマス。
 * 列挙が計算量上限を超えた場合は `truncated` になり、確定・未確定を判断しない。
 */
export type MinesweeperCertainCells =
  | {
      status: "complete";
      withoutTotalMineCount: MinesweeperDeduction;
      withTotalMineCount: MinesweeperDeduction;
    }
  | { status: "truncated" };

export type MinesweeperLogicalSolveResult = {
  status: "solved" | "guess-required" | "computation-limit";
  roundCount: number;
};

type PossibleValues = {
  canBeMine: Uint8Array;
  canBeSafe: Uint8Array;
};

type ComponentSolutions = {
  system: MinesweeperConstraintSystem;
  possibleValuesByMineCount: ReadonlyMap<number, PossibleValues>;
};

function splitConstraintComponents(
  constraints: readonly MinesweeperNumberConstraint[],
): MinesweeperNumberConstraint[][] {
  const parents = constraints.map((_, constraintId) => constraintId);
  function findRoot(constraintId: number): number {
    let root = constraintId;
    while (parents[root] !== root) {
      root = parents[root]!;
    }
    parents[constraintId] = root;
    return root;
  }

  const constraintIdByCell = new Map<number, number>();
  constraints.forEach((constraint, constraintId) => {
    for (const cellIndex of constraint.cellIndices) {
      const otherId = constraintIdByCell.get(cellIndex);
      if (otherId === undefined) {
        constraintIdByCell.set(cellIndex, constraintId);
      } else {
        parents[findRoot(constraintId)] = findRoot(otherId);
      }
    }
  });

  const components = new Map<number, MinesweeperNumberConstraint[]>();
  constraints.forEach((constraint, constraintId) => {
    const root = findRoot(constraintId);
    const component = components.get(root) ?? [];
    component.push(constraint);
    components.set(root, component);
  });
  return [...components.values()];
}

function enumerateComponentSolutions(
  constraints: readonly MinesweeperNumberConstraint[],
  remainingNodeCount: number,
): { solutions: ComponentSolutions; usedNodeCount: number } | null {
  const system = createMinesweeperConstraintSystem(constraints);
  const cellCount = system.cellIndices.length;
  const possibleValuesByMineCount = new Map<number, PossibleValues>();
  const { outcome, visitedNodeCount } = enumerateMinesweeperConstraintSolutions(
    system,
    (isMineByPosition, mineCount) => {
      let possibleValues = possibleValuesByMineCount.get(mineCount);
      if (!possibleValues) {
        possibleValues = {
          canBeMine: new Uint8Array(cellCount),
          canBeSafe: new Uint8Array(cellCount),
        };
        possibleValuesByMineCount.set(mineCount, possibleValues);
      }
      for (let position = 0; position < cellCount; position += 1) {
        if (isMineByPosition[position] === 1) {
          possibleValues.canBeMine[position] = 1;
        } else {
          possibleValues.canBeSafe[position] = 1;
        }
      }
      return "continue";
    },
    remainingNodeCount,
  );

  if (outcome === "truncated") {
    return null;
  }
  return {
    solutions: { system, possibleValuesByMineCount },
    usedNodeCount: visitedNodeCount,
  };
}

function addReachableSums(
  reachable: Uint8Array,
  addends: readonly number[],
): Uint8Array {
  const next = new Uint8Array(reachable.length);
  for (let sum = 0; sum < reachable.length; sum += 1) {
    if (reachable[sum] !== 1) {
      continue;
    }
    for (const addend of addends) {
      if (sum + addend < next.length) {
        next[sum + addend] = 1;
      }
    }
  }
  return next;
}

function combineReachableSums(left: Uint8Array, right: Uint8Array): Uint8Array {
  const combined = new Uint8Array(left.length);
  for (let leftSum = 0; leftSum < left.length; leftSum += 1) {
    if (left[leftSum] !== 1) {
      continue;
    }
    for (
      let rightSum = 0;
      leftSum + rightSum < combined.length;
      rightSum += 1
    ) {
      if (right[rightSum] === 1) {
        combined[leftSum + rightSum] = 1;
      }
    }
  }
  return combined;
}

function hasReachableSumInRange(
  reachable: Uint8Array,
  minimum: number,
  maximum: number,
): boolean {
  for (
    let sum = Math.max(0, minimum);
    sum <= Math.min(maximum, reachable.length - 1);
    sum += 1
  ) {
    if (reachable[sum] === 1) {
      return true;
    }
  }
  return false;
}

/**
 * 成分ごとの地雷数の組合せのうち、内部マス（数字に隣接しない未確定マス）へ残りを配れて
 * 総地雷数と整合するものだけを残す。
 */
function selectMineCountsConsistentWithTotal(
  components: readonly ComponentSolutions[],
  remainingMineCount: number,
  interiorCellCount: number,
): {
  feasibleMineCountsByComponent: Set<number>[];
  interiorMineCounts: number[];
} {
  const mineCountsByComponent = components.map((component) => [
    ...component.possibleValuesByMineCount.keys(),
  ]);
  const sumLength = remainingMineCount + 1;
  const prefixSums: Uint8Array[] = [
    Uint8Array.from({ length: sumLength }, (_, sum) => (sum === 0 ? 1 : 0)),
  ];
  for (const mineCounts of mineCountsByComponent) {
    prefixSums.push(addReachableSums(prefixSums.at(-1)!, mineCounts));
  }
  const suffixSums: Uint8Array[] = [prefixSums[0]!];
  for (const mineCounts of [...mineCountsByComponent].reverse()) {
    suffixSums.unshift(addReachableSums(suffixSums[0]!, mineCounts));
  }

  const feasibleMineCountsByComponent = mineCountsByComponent.map(
    (mineCounts, componentIndex) => {
      const otherSums = combineReachableSums(
        prefixSums[componentIndex]!,
        suffixSums[componentIndex + 1]!,
      );
      return new Set(
        mineCounts.filter((mineCount) =>
          hasReachableSumInRange(
            otherSums,
            remainingMineCount - mineCount - interiorCellCount,
            remainingMineCount - mineCount,
          ),
        ),
      );
    },
  );

  const allComponentSums = prefixSums.at(-1)!;
  const interiorMineCounts: number[] = [];
  for (
    let interiorMineCount = 0;
    interiorMineCount <= Math.min(interiorCellCount, remainingMineCount);
    interiorMineCount += 1
  ) {
    if (allComponentSums[remainingMineCount - interiorMineCount] === 1) {
      interiorMineCounts.push(interiorMineCount);
    }
  }

  return { feasibleMineCountsByComponent, interiorMineCounts };
}

function collectCertainComponentCells(
  component: ComponentSolutions,
  allowedMineCounts: ReadonlySet<number>,
  safeCellIndices: number[],
  mineCellIndices: number[],
): void {
  const cellCount = component.system.cellIndices.length;
  const canBeMine = new Uint8Array(cellCount);
  const canBeSafe = new Uint8Array(cellCount);
  for (const [
    mineCount,
    possibleValues,
  ] of component.possibleValuesByMineCount) {
    if (!allowedMineCounts.has(mineCount)) {
      continue;
    }
    for (let position = 0; position < cellCount; position += 1) {
      canBeMine[position]! |= possibleValues.canBeMine[position]!;
      canBeSafe[position]! |= possibleValues.canBeSafe[position]!;
    }
  }

  component.system.cellIndices.forEach((cellIndex, position) => {
    if (canBeMine[position] === 0) {
      safeCellIndices.push(cellIndex);
    } else if (canBeSafe[position] === 0) {
      mineCellIndices.push(cellIndex);
    }
  });
}

function sortDeduction(
  safeCellIndices: number[],
  mineCellIndices: number[],
): MinesweeperDeduction {
  return {
    safeCellIndices: safeCellIndices.sort((left, right) => left - right),
    mineCellIndices: mineCellIndices.sort((left, right) => left - right),
  };
}

/**
 * 数字制約を連結成分に分けて全解を列挙し、総地雷数の有無それぞれで確実に安全・地雷と言えるマスを求める。
 */
export function findMinesweeperCertainCells(
  state: MinesweeperDeductionState,
  options: MinesweeperSolverOptions = {},
): MinesweeperCertainCells {
  const maximumNodeCount =
    options.maximumNodeCount ?? MINESWEEPER_SOLVER_MAXIMUM_NODE_COUNT;
  const constraints = collectMinesweeperNumberConstraints(state);
  const components: ComponentSolutions[] = [];
  let remainingNodeCount = maximumNodeCount;
  for (const componentConstraints of splitConstraintComponents(constraints)) {
    const enumerated = enumerateComponentSolutions(
      componentConstraints,
      remainingNodeCount,
    );
    if (!enumerated) {
      return { status: "truncated" };
    }
    remainingNodeCount -= enumerated.usedNodeCount;
    components.push(enumerated.solutions);
  }

  const withoutTotalSafe: number[] = [];
  const withoutTotalMines: number[] = [];
  for (const component of components) {
    collectCertainComponentCells(
      component,
      new Set(component.possibleValuesByMineCount.keys()),
      withoutTotalSafe,
      withoutTotalMines,
    );
  }

  const frontierCells = new Set(
    constraints.flatMap((constraint) => constraint.cellIndices),
  );
  const interiorCellIndices = listUndeterminedMinesweeperCellIndices(
    state,
  ).filter((cellIndex) => !frontierCells.has(cellIndex));
  const { feasibleMineCountsByComponent, interiorMineCounts } =
    selectMineCountsConsistentWithTotal(
      components,
      countRemainingMinesweeperMines(state),
      interiorCellIndices.length,
    );

  const withTotalSafe: number[] = [];
  const withTotalMines: number[] = [];
  components.forEach((component, componentIndex) => {
    collectCertainComponentCells(
      component,
      feasibleMineCountsByComponent[componentIndex]!,
      withTotalSafe,
      withTotalMines,
    );
  });
  if (interiorCellIndices.length > 0) {
    if (interiorMineCounts.every((mineCount) => mineCount === 0)) {
      withTotalSafe.push(...interiorCellIndices);
    } else if (
      interiorMineCounts.every(
        (mineCount) => mineCount === interiorCellIndices.length,
      )
    ) {
      withTotalMines.push(...interiorCellIndices);
    }
  }

  return {
    status: "complete",
    withoutTotalMineCount: sortDeduction(withoutTotalSafe, withoutTotalMines),
    withTotalMineCount: sortDeduction(withTotalSafe, withTotalMines),
  };
}

/**
 * 初期状態から、確実に言えるマスを全て確定・開示することを繰り返し、推測なしで全安全マスを開けられるかを判定する。
 */
export function solveMinesweeperLogically(
  problem: MinesweeperProblem,
  options: MinesweeperSolverOptions = {},
): MinesweeperLogicalSolveResult {
  let state = createMinesweeperDeductionState(problem);
  let roundCount = 0;

  while (!isMinesweeperDeductionComplete(state)) {
    const certainCells = findMinesweeperCertainCells(state, options);
    if (certainCells.status === "truncated") {
      return { status: "computation-limit", roundCount };
    }
    if (isMinesweeperDeductionEmpty(certainCells.withTotalMineCount)) {
      return { status: "guess-required", roundCount };
    }
    state = applyMinesweeperDeduction(state, certainCells.withTotalMineCount);
    roundCount += 1;
  }

  return { status: "solved", roundCount };
}

export const _private = {
  splitConstraintComponents,
  selectMineCountsConsistentWithTotal,
};
