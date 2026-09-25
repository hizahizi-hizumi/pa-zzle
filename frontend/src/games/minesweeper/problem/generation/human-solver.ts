import {
  createMinesweeperConstraintSystem,
  enumerateMinesweeperConstraintSolutions,
} from "@/games/minesweeper/problem/generation/constraint-search";
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
} from "@/games/minesweeper/problem/generation/deduction-state";
import {
  findMinesweeperCertainCells,
  type MinesweeperSolverOptions,
} from "@/games/minesweeper/problem/generation/solver";
import type { MinesweeperProblem } from "@/games/minesweeper/problem/problem";

/**
 * 人間向け推論の段階。小さいほど易しい。
 * マスを確定させるのに同時に考える必要がある、重なりで連結した数字の最小個数 k で決める。
 * 1: k=1、2: k=2 で一方の未確定マスが他方に含まれる、3: k=2 で部分的に重なる、4: k≥3、
 * 5: 数字制約の連結成分ごとの地雷数の組合せと総地雷数を突き合わせて初めて確定する。
 * 残り地雷数が0、または残り地雷数が未確定マス数と等しいという総地雷数だけの自明な確定は1とする。
 */
export type MinesweeperDeductionLevel = 1 | 2 | 3 | 4 | 5;

export const minesweeperDeductionLevels = [
  1, 2, 3, 4, 5,
] as const satisfies readonly MinesweeperDeductionLevel[];

/** 総地雷数をどう使ったか。`trivial` は残り地雷数だけで全未確定マスが決まる場合。 */
export type MinesweeperTotalMineCountUsage = "none" | "trivial" | "combination";

/**
 * 段階4の発見を作る制約の組み方。
 * - `nested-sum`: 1つの数字の未確定マスの中に、残りの数字が未確定マスを共有せずに収まる（「2の中に1が2つ」）。
 * - `chain`: それ以外の、重なりを順にたどる組み方。
 */
export type MinesweeperConnectedGroupShape = "nested-sum" | "chain";

/**
 * 段階5で総地雷数と突き合わせた数字の組み方。
 * - `one-number`: 1つの数字の残り地雷数が総残り地雷数と一致する、または、その数字の外側の未確定マスが全て地雷になる。
 * - `two-disjoint-numbers`: 未確定マスを共有しない2つの数字の残り地雷数の和が総残り地雷数と一致する。
 * - `three-or-more-disjoint-numbers`: 未確定マスを共有しない3つ以上の数字の残り地雷数の和が総残り地雷数と一致する。
 * - `component-combination`: 数字のまとまりごとに取りうる地雷数の組合せを突き合わせる必要がある。
 */
export type MinesweeperTotalMineCountCombinationShape =
  | "one-number"
  | "two-disjoint-numbers"
  | "three-or-more-disjoint-numbers"
  | "component-combination";

export const MINESWEEPER_MAXIMUM_INFERENCE_WIDTH = 5;
export const MINESWEEPER_MAXIMUM_LOCAL_SEARCH_NODE_COUNT = 1_000_000;

export type MinesweeperHumanSolverOptions = {
  maximumInferenceWidth?: number;
  maximumLocalSearchNodeCount?: number;
  solverOptions?: MinesweeperSolverOptions;
};

/**
 * 1ラウンドで同時に確定・適用したマスの記録。
 * 発見は、そのラウンドの段階で確定を与える最小の制約集合（総地雷数による確定は1つの発見）。
 * - `inferenceWidth`: 発見に使った制約の個数。総地雷数だけの発見しか無いラウンドでは `null`。
 * - `deductionLocationCount`: 確定マスを8近傍で連結したまとまりの数。
 * - `maximumDiscoveryRowSpan` / `maximumDiscoveryColumnSpan`: 発見に使った制約の未確定マス全体を囲む矩形の行数・列数の最大値。
 * - `connectedGroupShape`: 段階4のラウンドだけで値を持つ。いずれかの発見が `nested-sum` ならそのラウンドは `nested-sum`。
 * - `totalMineCountCombinationShape`: 段階5のラウンドだけで値を持つ。
 */
export type MinesweeperHumanSolveRound = {
  deductionLevel: MinesweeperDeductionLevel;
  inferenceWidth: number | null;
  totalMineCountUsage: MinesweeperTotalMineCountUsage;
  discoveryCount: number;
  safeCellCount: number;
  mineCellCount: number;
  deductionLocationCount: number;
  frontierCellCount: number;
  frontierConstraintCount: number;
  maximumDiscoveryRowSpan: number | null;
  maximumDiscoveryColumnSpan: number | null;
  connectedGroupShape: MinesweeperConnectedGroupShape | null;
  totalMineCountCombinationShape: MinesweeperTotalMineCountCombinationShape | null;
};

export type MinesweeperHumanSolveResult =
  | {
      status: "solved" | "guess-required";
      rounds: readonly MinesweeperHumanSolveRound[];
    }
  | {
      status: "unsupported";
      reason: "technique-limit" | "computation-limit";
      rounds: readonly MinesweeperHumanSolveRound[];
    };

type Discovery = {
  constraints: readonly MinesweeperNumberConstraint[] | null;
  deduction: MinesweeperDeduction;
};

type LevelDiscoveries = {
  deductionLevel: MinesweeperDeductionLevel;
  totalMineCountUsage: MinesweeperTotalMineCountUsage;
  discoveries: readonly Discovery[];
};

type LocalSearchBudget = {
  remainingNodeCount: number;
};

class LocalSearchBudgetExceededError extends Error {}

function createDeduction(
  cellIndices: readonly number[],
  isMine: boolean,
): MinesweeperDeduction {
  return isMine
    ? { safeCellIndices: [], mineCellIndices: cellIndices }
    : { safeCellIndices: cellIndices, mineCellIndices: [] };
}

function mergeDeductions(
  deductions: readonly MinesweeperDeduction[],
): MinesweeperDeduction {
  const safeCells = new Set(
    deductions.flatMap((deduction) => deduction.safeCellIndices),
  );
  const mineCells = new Set(
    deductions.flatMap((deduction) => deduction.mineCellIndices),
  );
  return {
    safeCellIndices: [...safeCells].sort((left, right) => left - right),
    mineCellIndices: [...mineCells].sort((left, right) => left - right),
  };
}

function discoverFromSingleConstraints(
  constraints: readonly MinesweeperNumberConstraint[],
): Discovery[] {
  return constraints.flatMap((constraint) => {
    if (constraint.mineCount === 0) {
      return [
        {
          constraints: [constraint],
          deduction: createDeduction(constraint.cellIndices, false),
        },
      ];
    }
    if (constraint.mineCount === constraint.cellIndices.length) {
      return [
        {
          constraints: [constraint],
          deduction: createDeduction(constraint.cellIndices, true),
        },
      ];
    }
    return [];
  });
}

function discoverFromTrivialTotalMineCount(
  state: MinesweeperDeductionState,
): Discovery[] {
  const remainingMineCount = countRemainingMinesweeperMines(state);
  const undeterminedCellIndices = listUndeterminedMinesweeperCellIndices(state);
  if (undeterminedCellIndices.length === 0) {
    return [];
  }
  if (remainingMineCount === 0) {
    return [
      {
        constraints: null,
        deduction: createDeduction(undeterminedCellIndices, false),
      },
    ];
  }
  if (remainingMineCount === undeterminedCellIndices.length) {
    return [
      {
        constraints: null,
        deduction: createDeduction(undeterminedCellIndices, true),
      },
    ];
  }
  return [];
}

function listOverlappingConstraintIds(
  constraints: readonly MinesweeperNumberConstraint[],
): number[][] {
  const constraintIdsByCell = new Map<number, number[]>();
  constraints.forEach((constraint, constraintId) => {
    for (const cellIndex of constraint.cellIndices) {
      const constraintIds = constraintIdsByCell.get(cellIndex) ?? [];
      constraintIds.push(constraintId);
      constraintIdsByCell.set(cellIndex, constraintIds);
    }
  });

  return constraints.map((constraint, constraintId) => {
    const overlappingIds = new Set<number>();
    for (const cellIndex of constraint.cellIndices) {
      for (const otherId of constraintIdsByCell.get(cellIndex)!) {
        if (otherId !== constraintId) {
          overlappingIds.add(otherId);
        }
      }
    }
    return [...overlappingIds].sort((left, right) => left - right);
  });
}

function isContainedPair(
  left: MinesweeperNumberConstraint,
  right: MinesweeperNumberConstraint,
): boolean {
  const [inner, outer] =
    left.cellIndices.length <= right.cellIndices.length
      ? [left, right]
      : [right, left];
  const outerCells = new Set(outer.cellIndices);
  return inner.cellIndices.every((cellIndex) => outerCells.has(cellIndex));
}

/** 与えた数字制約を同時に満たす全配置で値が変わらないマスを求める。 */
function deduceFromJointConstraints(
  constraints: readonly MinesweeperNumberConstraint[],
  budget: LocalSearchBudget,
): MinesweeperDeduction {
  const system = createMinesweeperConstraintSystem(constraints);
  const cellCount = system.cellIndices.length;
  const seenMine = new Uint8Array(cellCount);
  const seenSafe = new Uint8Array(cellCount);
  let ambiguousCellCount = 0;

  const { outcome, visitedNodeCount } = enumerateMinesweeperConstraintSolutions(
    system,
    (isMineByPosition) => {
      for (let position = 0; position < cellCount; position += 1) {
        const seen = isMineByPosition[position] === 1 ? seenMine : seenSafe;
        if (seen[position] === 1) {
          continue;
        }
        seen[position] = 1;
        if (seenMine[position] === 1 && seenSafe[position] === 1) {
          ambiguousCellCount += 1;
        }
      }
      return ambiguousCellCount === cellCount ? "stop" : "continue";
    },
    budget.remainingNodeCount,
  );
  budget.remainingNodeCount -= visitedNodeCount;
  if (outcome === "truncated") {
    throw new LocalSearchBudgetExceededError();
  }

  const safeCellIndices: number[] = [];
  const mineCellIndices: number[] = [];
  system.cellIndices.forEach((cellIndex, position) => {
    if (seenMine[position] === 0) {
      safeCellIndices.push(cellIndex);
    } else if (seenSafe[position] === 0) {
      mineCellIndices.push(cellIndex);
    }
  });
  return mergeDeductions([{ safeCellIndices, mineCellIndices }]);
}

function discoverFromConstraintGroup(
  constraints: readonly MinesweeperNumberConstraint[],
  budget: LocalSearchBudget,
): Discovery[] {
  const deduction = deduceFromJointConstraints(constraints, budget);
  return isMinesweeperDeductionEmpty(deduction)
    ? []
    : [{ constraints, deduction }];
}

function discoverFromPairs(
  constraints: readonly MinesweeperNumberConstraint[],
  overlappingConstraintIds: readonly (readonly number[])[],
  isTargetPair: (
    left: MinesweeperNumberConstraint,
    right: MinesweeperNumberConstraint,
  ) => boolean,
  budget: LocalSearchBudget,
): Discovery[] {
  const discoveries: Discovery[] = [];
  overlappingConstraintIds.forEach((otherIds, constraintId) => {
    for (const otherId of otherIds) {
      const pair = [constraints[constraintId]!, constraints[otherId]!] as const;
      if (constraintId < otherId && isTargetPair(...pair)) {
        discoveries.push(...discoverFromConstraintGroup(pair, budget));
      }
    }
  });
  return discoveries;
}

/**
 * 重なりで連結した `size` 個の制約の組を、各組ちょうど1回ずつ列挙する（ESUアルゴリズム）。
 * 組の最小の制約を起点とし、起点より大きく、既存の組の近傍にない制約だけで拡張候補を広げる。
 */
function forEachConnectedConstraintGroup(
  overlappingConstraintIds: readonly (readonly number[])[],
  size: number,
  visit: (constraintIds: readonly number[]) => void,
): void {
  function extend(
    groupIds: readonly number[],
    extensionIds: readonly number[],
    closedNeighborhood: ReadonlySet<number>,
    rootId: number,
  ): void {
    if (groupIds.length === size) {
      visit(groupIds);
      return;
    }

    const remainingExtensionIds = [...extensionIds];
    while (remainingExtensionIds.length > 0) {
      const addedId = remainingExtensionIds.pop()!;
      const nextExtensionIds = [...remainingExtensionIds];
      const nextClosedNeighborhood = new Set(closedNeighborhood);
      for (const neighborId of overlappingConstraintIds[addedId]!) {
        if (neighborId > rootId && !closedNeighborhood.has(neighborId)) {
          nextExtensionIds.push(neighborId);
        }
        nextClosedNeighborhood.add(neighborId);
      }
      extend(
        [...groupIds, addedId],
        nextExtensionIds,
        nextClosedNeighborhood,
        rootId,
      );
    }
  }

  overlappingConstraintIds.forEach((neighborIds, rootId) => {
    extend(
      [rootId],
      neighborIds.filter((neighborId) => neighborId > rootId),
      new Set([rootId, ...neighborIds]),
      rootId,
    );
  });
}

function discoverFromConnectedGroups(
  constraints: readonly MinesweeperNumberConstraint[],
  overlappingConstraintIds: readonly (readonly number[])[],
  groupSize: number,
  budget: LocalSearchBudget,
): Discovery[] {
  const discoveries: Discovery[] = [];
  forEachConnectedConstraintGroup(
    overlappingConstraintIds,
    groupSize,
    (constraintIds) => {
      discoveries.push(
        ...discoverFromConstraintGroup(
          constraintIds.map((constraintId) => constraints[constraintId]!),
          budget,
        ),
      );
    },
  );
  return discoveries;
}

function subtractDeduction(
  deduction: MinesweeperDeduction,
  excluded: MinesweeperDeduction,
): MinesweeperDeduction {
  const excludedSafe = new Set(excluded.safeCellIndices);
  const excludedMines = new Set(excluded.mineCellIndices);
  return {
    safeCellIndices: deduction.safeCellIndices.filter(
      (cellIndex) => !excludedSafe.has(cellIndex),
    ),
    mineCellIndices: deduction.mineCellIndices.filter(
      (cellIndex) => !excludedMines.has(cellIndex),
    ),
  };
}

type LevelSearchResult =
  | { status: "found"; levelDiscoveries: LevelDiscoveries }
  | {
      status: "stalled";
      reason: "guess-required" | "technique-limit" | "computation-limit";
    };

function foundAt(
  deductionLevel: MinesweeperDeductionLevel,
  totalMineCountUsage: MinesweeperTotalMineCountUsage,
  discoveries: readonly Discovery[],
): LevelSearchResult {
  return {
    status: "found",
    levelDiscoveries: { deductionLevel, totalMineCountUsage, discoveries },
  };
}

function findLocalDiscoveries(
  constraints: readonly MinesweeperNumberConstraint[],
  options: MinesweeperHumanSolverOptions,
): LevelSearchResult | null {
  const overlappingConstraintIds = listOverlappingConstraintIds(constraints);
  const budget = {
    remainingNodeCount:
      options.maximumLocalSearchNodeCount ??
      MINESWEEPER_MAXIMUM_LOCAL_SEARCH_NODE_COUNT,
  };

  const containedPairDiscoveries = discoverFromPairs(
    constraints,
    overlappingConstraintIds,
    isContainedPair,
    budget,
  );
  if (containedPairDiscoveries.length > 0) {
    return foundAt(2, "none", containedPairDiscoveries);
  }

  const overlappingPairDiscoveries = discoverFromPairs(
    constraints,
    overlappingConstraintIds,
    (left, right) => !isContainedPair(left, right),
    budget,
  );
  if (overlappingPairDiscoveries.length > 0) {
    return foundAt(3, "none", overlappingPairDiscoveries);
  }

  const maximumInferenceWidth =
    options.maximumInferenceWidth ?? MINESWEEPER_MAXIMUM_INFERENCE_WIDTH;
  for (let groupSize = 3; groupSize <= maximumInferenceWidth; groupSize += 1) {
    const groupDiscoveries = discoverFromConnectedGroups(
      constraints,
      overlappingConstraintIds,
      groupSize,
      budget,
    );
    if (groupDiscoveries.length > 0) {
      return foundAt(4, "none", groupDiscoveries);
    }
  }
  return null;
}

/**
 * 段階の小さい順に発見を探し、最初に発見があった段階の発見を全て返す。
 * 段階4は同時に考える制約の個数の小さい順に探し、最小の個数での発見だけを返す。
 */
function findEasiestDiscoveries(
  state: MinesweeperDeductionState,
  options: MinesweeperHumanSolverOptions,
): LevelSearchResult {
  const constraints = collectMinesweeperNumberConstraints(state);

  const singleDiscoveries = discoverFromSingleConstraints(constraints);
  const trivialTotalDiscoveries = discoverFromTrivialTotalMineCount(state);
  if (singleDiscoveries.length > 0 || trivialTotalDiscoveries.length > 0) {
    return foundAt(1, trivialTotalDiscoveries.length > 0 ? "trivial" : "none", [
      ...singleDiscoveries,
      ...trivialTotalDiscoveries,
    ]);
  }

  try {
    const localResult = findLocalDiscoveries(constraints, options);
    if (localResult) {
      return localResult;
    }
  } catch (error) {
    if (error instanceof LocalSearchBudgetExceededError) {
      return { status: "stalled", reason: "computation-limit" };
    }
    throw error;
  }

  const certainCells = findMinesweeperCertainCells(
    state,
    options.solverOptions,
  );
  if (certainCells.status === "truncated") {
    return { status: "stalled", reason: "computation-limit" };
  }
  const totalMineCountDeduction = subtractDeduction(
    certainCells.withTotalMineCount,
    certainCells.withoutTotalMineCount,
  );
  if (!isMinesweeperDeductionEmpty(totalMineCountDeduction)) {
    return foundAt(5, "combination", [
      { constraints: null, deduction: totalMineCountDeduction },
    ]);
  }
  if (!isMinesweeperDeductionEmpty(certainCells.withoutTotalMineCount)) {
    return { status: "stalled", reason: "technique-limit" };
  }
  return { status: "stalled", reason: "guess-required" };
}

function countDeductionLocations(
  state: MinesweeperDeductionState,
  deduction: MinesweeperDeduction,
): number {
  const deducedCells = new Set([
    ...deduction.safeCellIndices,
    ...deduction.mineCellIndices,
  ]);
  const visitedCells = new Set<number>();
  let locationCount = 0;

  for (const startCellIndex of deducedCells) {
    if (visitedCells.has(startCellIndex)) {
      continue;
    }
    locationCount += 1;
    visitedCells.add(startCellIndex);
    const pendingCellIndices = [startCellIndex];
    while (pendingCellIndices.length > 0) {
      const cellIndex = pendingCellIndices.pop()!;
      for (const neighbor of state.neighborCellIndices[cellIndex]!) {
        if (deducedCells.has(neighbor) && !visitedCells.has(neighbor)) {
          visitedCells.add(neighbor);
          pendingCellIndices.push(neighbor);
        }
      }
    }
  }

  return locationCount;
}

function measureDiscoverySpan(
  state: MinesweeperDeductionState,
  constraints: readonly MinesweeperNumberConstraint[],
): { rowSpan: number; columnSpan: number } {
  const cellIndices = constraints.flatMap(
    (constraint) => constraint.cellIndices,
  );
  const rows = cellIndices.map((cellIndex) =>
    Math.floor(cellIndex / state.board.columns),
  );
  const columns = cellIndices.map(
    (cellIndex) => cellIndex % state.board.columns,
  );
  return {
    rowSpan: Math.max(...rows) - Math.min(...rows) + 1,
    columnSpan: Math.max(...columns) - Math.min(...columns) + 1,
  };
}

function maximumOrNull(values: readonly number[]): number | null {
  return values.length > 0 ? Math.max(...values) : null;
}

function isNestedSumGroup(
  constraints: readonly MinesweeperNumberConstraint[],
): boolean {
  return constraints.some((outer) => {
    const outerCells = new Set(outer.cellIndices);
    const innerCellIndices = constraints
      .filter((constraint) => constraint !== outer)
      .flatMap((constraint) => constraint.cellIndices);
    const innersShareNoCell =
      new Set(innerCellIndices).size === innerCellIndices.length;
    return (
      innersShareNoCell &&
      innerCellIndices.every((cellIndex) => outerCells.has(cellIndex))
    );
  });
}

function classifyConnectedGroupShape(
  constraintGroups: readonly (readonly MinesweeperNumberConstraint[])[],
): MinesweeperConnectedGroupShape {
  return constraintGroups.some(isNestedSumGroup) ? "nested-sum" : "chain";
}

/** 未確定マスを共有しない数字の組で、残り地雷数の和が `targetMineCount` になる最小の個数を返す。 */
function countFewestDisjointConstraintsSummingTo(
  constraints: readonly MinesweeperNumberConstraint[],
  targetMineCount: number,
): number | null {
  const candidates = constraints.filter(
    (constraint) => constraint.mineCount > 0,
  );
  const remainingMineCountSums = new Array<number>(candidates.length + 1).fill(
    0,
  );
  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    remainingMineCountSums[index] =
      candidates[index]!.mineCount + remainingMineCountSums[index + 1]!;
  }
  let fewestCount: number | null = null;

  function search(
    candidateIndex: number,
    usedCells: ReadonlySet<number>,
    mineCountSum: number,
    constraintCount: number,
  ): void {
    if (fewestCount !== null && constraintCount >= fewestCount) {
      return;
    }
    if (mineCountSum === targetMineCount) {
      fewestCount = constraintCount;
      return;
    }
    const reachableMineCountSum =
      mineCountSum + remainingMineCountSums[candidateIndex]!;
    if (reachableMineCountSum < targetMineCount) {
      return;
    }

    const candidate = candidates[candidateIndex]!;
    if (
      mineCountSum + candidate.mineCount <= targetMineCount &&
      candidate.cellIndices.every((cellIndex) => !usedCells.has(cellIndex))
    ) {
      search(
        candidateIndex + 1,
        new Set([...usedCells, ...candidate.cellIndices]),
        mineCountSum + candidate.mineCount,
        constraintCount + 1,
      );
    }
    search(candidateIndex + 1, usedCells, mineCountSum, constraintCount);
  }

  search(0, new Set(), 0, 0);
  return fewestCount;
}

function classifyTotalMineCountCombinationShape(
  state: MinesweeperDeductionState,
): MinesweeperTotalMineCountCombinationShape {
  const constraints = collectMinesweeperNumberConstraints(state);
  const remainingMineCount = countRemainingMinesweeperMines(state);
  const undeterminedCellCount =
    listUndeterminedMinesweeperCellIndices(state).length;
  const isDecidedByOneNumber = constraints.some(
    (constraint) =>
      constraint.mineCount === remainingMineCount ||
      undeterminedCellCount - constraint.cellIndices.length ===
        remainingMineCount - constraint.mineCount,
  );
  if (isDecidedByOneNumber) {
    return "one-number";
  }

  const disjointConstraintCount = countFewestDisjointConstraintsSummingTo(
    constraints,
    remainingMineCount,
  );
  if (disjointConstraintCount === null) {
    return "component-combination";
  }
  return disjointConstraintCount === 2
    ? "two-disjoint-numbers"
    : "three-or-more-disjoint-numbers";
}

function recordRound(
  state: MinesweeperDeductionState,
  levelDiscoveries: LevelDiscoveries,
  deduction: MinesweeperDeduction,
): MinesweeperHumanSolveRound {
  const constraints = collectMinesweeperNumberConstraints(state);
  const constraintGroups = levelDiscoveries.discoveries.flatMap((discovery) =>
    discovery.constraints === null ? [] : [discovery.constraints],
  );
  const spans = constraintGroups.map((group) =>
    measureDiscoverySpan(state, group),
  );

  return {
    deductionLevel: levelDiscoveries.deductionLevel,
    inferenceWidth: maximumOrNull(
      constraintGroups.map((group) => group.length),
    ),
    totalMineCountUsage: levelDiscoveries.totalMineCountUsage,
    discoveryCount: levelDiscoveries.discoveries.length,
    safeCellCount: deduction.safeCellIndices.length,
    mineCellCount: deduction.mineCellIndices.length,
    deductionLocationCount: countDeductionLocations(state, deduction),
    frontierCellCount: new Set(
      constraints.flatMap((constraint) => constraint.cellIndices),
    ).size,
    frontierConstraintCount: constraints.length,
    maximumDiscoveryRowSpan: maximumOrNull(spans.map((span) => span.rowSpan)),
    maximumDiscoveryColumnSpan: maximumOrNull(
      spans.map((span) => span.columnSpan),
    ),
    connectedGroupShape:
      levelDiscoveries.deductionLevel === 4
        ? classifyConnectedGroupShape(constraintGroups)
        : null,
    totalMineCountCombinationShape:
      levelDiscoveries.deductionLevel === 5
        ? classifyTotalMineCountCombinationShape(state)
        : null,
  };
}

/**
 * 人間向け推論モデルで初期局面から解き進め、ラウンドごとの段階と選択肢の記録を返す。
 * 各ラウンドでは最も易しい段階の発見による確定を全て同時に適用するため、結果は探索順に依存しない。
 */
export function traceMinesweeperHumanSolve(
  problem: MinesweeperProblem,
  options: MinesweeperHumanSolverOptions = {},
): MinesweeperHumanSolveResult {
  let state = createMinesweeperDeductionState(problem);
  const rounds: MinesweeperHumanSolveRound[] = [];

  while (!isMinesweeperDeductionComplete(state)) {
    const search = findEasiestDiscoveries(state, options);
    if (search.status === "stalled") {
      return search.reason === "guess-required"
        ? { status: "guess-required", rounds }
        : { status: "unsupported", reason: search.reason, rounds };
    }

    const deduction = mergeDeductions(
      search.levelDiscoveries.discoveries.map(
        (discovery) => discovery.deduction,
      ),
    );
    rounds.push(recordRound(state, search.levelDiscoveries, deduction));
    state = applyMinesweeperDeduction(state, deduction);
  }

  return { status: "solved", rounds };
}

export const _private = {
  findEasiestDiscoveries,
  forEachConnectedConstraintGroup,
  isNestedSumGroup,
  countFewestDisjointConstraintsSummingTo,
};
