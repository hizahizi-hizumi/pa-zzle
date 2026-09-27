/**
 * パーキングジャム難易度5段階の設計調査（Issue #405）で使う分析用の特徴量。
 * 本番の盤面・ルール・難易度分析の関数をそのまま使い、盤面の幾何と単調削除の状態空間から、
 * 挑戦の候補特徴を観測する。本番の判定（`challenge-levers-v1`）が使う特徴は本番の分析結果から取り、
 * ここでは本番が使わない調査用の特徴だけを求める。
 */
import {
  assessParkingJamDifficulty,
  calculateParkingJamChallengeLevers,
  type ParkingJamChallengeLevers,
  type ParkingJamDifficultyAssessment,
} from "@/games/parking-jam/difficulty";
import {
  analyzeParkingJamDifficulty,
  type ParkingJamDifficultyAnalysis,
} from "@/games/parking-jam/problem/difficulty-analysis";
import { analyzeParkingJamSolvability } from "@/games/parking-jam/problem/generation/solvability";
import type { ParkingJamGeneratedProblem } from "@/games/parking-jam/problem/problem";
import {
  createParkingJamInitialState,
  listParkingJamFixedAreaCells,
  listParkingJamVehicleCells,
  type ParkingJamBoard,
  type ParkingJamDirection,
  type ParkingJamVehicle,
} from "@/games/parking-jam/puzzle/board";
import { listParkingJamLegalMoves } from "@/games/parking-jam/puzzle/rules";

type DirectionGeometry = {
  direction: ParkingJamDirection;
  /** その辺の車線位置に道路開口がある。 */
  hasOpening: boolean;
  /** 開口はないが、同じ辺の隣の車線に開口がある（1車線ずれの見誤りを誘う）。 */
  nearMissOpening: boolean;
  /** 進路上に固定領域がある。 */
  fixedBlocked: boolean;
  /** 出口までのセル数。 */
  pathLength: number;
  /** 進路上の車（近い順）。 */
  blockers: readonly { index: number; gap: number }[];
  blockerMask: number;
};

type VehicleGeometry = {
  vehicle: ParkingJamVehicle;
  directions: readonly DirectionGeometry[];
  /** 開口があり固定領域に塞がれない、出庫に使える方向。 */
  available: readonly DirectionGeometry[];
};

const axisDirections = {
  horizontal: ["left", "right"],
  vertical: ["up", "down"],
} as const satisfies Record<string, readonly ParkingJamDirection[]>;

function cellKey(row: number, column: number): string {
  return `${row}:${column}`;
}

function pathCells(
  board: ParkingJamBoard,
  vehicle: ParkingJamVehicle,
  direction: ParkingJamDirection,
): { row: number; column: number }[] {
  const cells: { row: number; column: number }[] = [];
  if (direction === "left") {
    for (let column = vehicle.column - 1; column >= 0; column -= 1)
      cells.push({ row: vehicle.row, column });
  } else if (direction === "right") {
    for (
      let column = vehicle.column + vehicle.length;
      column < board.width;
      column += 1
    )
      cells.push({ row: vehicle.row, column });
  } else if (direction === "up") {
    for (let row = vehicle.row - 1; row >= 0; row -= 1)
      cells.push({ row, column: vehicle.column });
  } else {
    for (let row = vehicle.row + vehicle.length; row < board.height; row += 1)
      cells.push({ row, column: vehicle.column });
  }
  return cells;
}

function openingCovers(
  board: ParkingJamBoard,
  direction: ParkingJamDirection,
  offset: number,
): boolean {
  return board.roadOpenings.some(
    (opening) =>
      opening.side === direction &&
      opening.startOffset <= offset &&
      offset < opening.startOffset + opening.length,
  );
}

export function describeVehicleGeometry(
  board: ParkingJamBoard,
): VehicleGeometry[] {
  const vehicleIndexByCell = new Map<string, number>();
  board.vehicles.forEach((vehicle, index) => {
    for (const cell of listParkingJamVehicleCells(vehicle))
      vehicleIndexByCell.set(cellKey(cell.row, cell.column), index);
  });
  const fixedCells = new Set(
    board.fixedAreas
      .flatMap(listParkingJamFixedAreaCells)
      .map((cell) => cellKey(cell.row, cell.column)),
  );

  return board.vehicles.map((vehicle) => {
    const offset =
      vehicle.orientation === "horizontal" ? vehicle.row : vehicle.column;
    const directions = axisDirections[vehicle.orientation].map(
      (direction): DirectionGeometry => {
        const cells = pathCells(board, vehicle, direction);
        const blockers: { index: number; gap: number }[] = [];
        let blockerMask = 0;
        let fixedBlocked = false;
        cells.forEach((cell, gap) => {
          const key = cellKey(cell.row, cell.column);
          if (fixedCells.has(key)) fixedBlocked = true;
          const index = vehicleIndexByCell.get(key);
          if (index !== undefined && (blockerMask & (1 << index)) === 0) {
            blockerMask |= 1 << index;
            blockers.push({ index, gap });
          }
        });
        const hasOpening = openingCovers(board, direction, offset);
        return {
          direction,
          hasOpening,
          nearMissOpening:
            !hasOpening &&
            (openingCovers(board, direction, offset - 1) ||
              openingCovers(board, direction, offset + 1)),
          fixedBlocked,
          pathLength: cells.length,
          blockers,
          blockerMask,
        };
      },
    );
    return {
      vehicle,
      directions,
      available: directions.filter(
        (direction) => direction.hasOpening && !direction.fixedBlocked,
      ),
    };
  });
}

function popcount(mask: number): number {
  let count = 0;
  let remaining = mask;
  while (remaining !== 0) {
    remaining &= remaining - 1;
    count += 1;
  }
  return count;
}

const visualLocalLoadV1FactorRanges = {
  initialBlockedVehicleCount: { minimum: 2, maximum: 5 },
  initialAverageMinimumBlockingVehicleCount: { minimum: 1, maximum: 1.5 },
  averageExitPathLength: { minimum: 1.5, maximum: 2.5 },
} as const;

/**
 * 3段階時代の判定 `visual-local-load-v1` のスコアと区分。本番からは削除済みで、
 * 調査の比較（案V、18.5 の対応表）のためだけにここで再現する。
 */
function assessVisualLocalLoadV1({ features }: ParkingJamDifficultyAnalysis): {
  score: number;
  difficulty: "easy" | "normal" | "hard";
} {
  const factors = {
    initialBlockedVehicleCount:
      features.vehicleCount - features.initialLegalVehicleCount,
    initialAverageMinimumBlockingVehicleCount:
      features.initialAverageMinimumBlockingVehicleCount,
    averageExitPathLength: features.averageExitPathLength,
  };
  const score =
    (Object.keys(visualLocalLoadV1FactorRanges) as (keyof typeof factors)[])
      .map((name) => {
        const { minimum, maximum } = visualLocalLoadV1FactorRanges[name];
        return Math.min(
          1,
          Math.max(0, (factors[name] - minimum) / (maximum - minimum)),
        );
      })
      .reduce((total, value) => total + value, 0) / 3;
  return {
    score,
    difficulty: score <= 1 / 3 ? "easy" : score >= 2 / 3 ? "hard" : "normal",
  };
}

export type ParkingJamStudyFeatures = {
  // 本番の判定（challenge-levers-v1）
  /** 本番の3レバー。状態空間を解析できない問題では null。 */
  levers: ParkingJamChallengeLevers | null;
  assessment: ParkingJamDifficultyAssessment;
  // 規模（対照指標）
  width: number;
  height: number;
  cellCount: number;
  vehicleCount: number;
  occupancy: number;
  fixedAreaCount: number;
  fixedAreaCellCount: number;
  roadOpeningCellCount: number;
  // 現行 visual-local-load-v1
  v1Score: number;
  v1Difficulty: string;
  initialBlockedCount: number;
  initialAverageMinimumBlocking: number;
  averageExitPathLength: number;
  // 依存構造（解順に依らない）
  /** 並列に出せる車を全部出す手順での段数（依存の深さ）。 */
  depth: number;
  /** 段ごとの車数。 */
  layerSizes: number[];
  /** 3段目以降にしか出せない車（2回以上待つ車）。 */
  deepVehicleCount: number;
  /** 初期盤面で、どの方向も2台以上に塞がれている車。 */
  multiBlockedCount: number;
  /** 必ず先に出す必要がある順序対の数。 */
  requiredPrecedenceCount: number;
  /** 1台の車が、後に回さざるを得ない車の最大数（ボトルネック）。 */
  maximumRequiredSuccessorCount: number;
  /** 両方向に開口があり、初期盤面で片方だけ塞がれている車（方向判断）。 */
  directionChoiceCount: number;
  /** 開口のない方向が、同じ辺で1車線ずれた開口に接している車（見誤りを誘う）。 */
  nearMissVehicleCount: number;
  /** 塞いでいる車までの距離（空きセル数）の平均と、2セル以上離れた遮断の数。 */
  averageBlockerGap: number;
  farBlockerCount: number;
  // 読み違いの誘発（車両数で割った割合。車が多いだけでは増えない）
  /** 開口のない方向が1車線ずれた開口に接し、固定物にも塞がれない車の割合。 */
  nearMissRatio: number;
  /** 開口のない方向の進路が初期盤面で空いている（出られそうに見える縁石）車の割合。 */
  clearWallRatio: number;
  /** 両方向に開口があり、初期盤面で片方だけ塞がれている車の割合。 */
  directionChoiceRatio: number;
  /** 塞がれた車のうち、最も塞がれ方の少ない方向で最初の遮断車が2セル以上先にある車の割合。 */
  farBlockedRatio: number;
  /** 1車線ずれの開口・方向判断・遠い遮断のいずれかに当たる車の割合（読み違いを誘う車）。出られそうな縁石は含めない。 */
  misreadVehicleRatio: number;
  // 視覚探索
  /** 初期に出せる車のうち、出口まで2セル以上ある（縁に接していない）車の割合。 */
  hiddenLegalRatio: number;
  /** 同じ向きの車が隣の車線で横に並んでいる車の割合（車線の取り違えを誘う並走）。 */
  sideBySideRatio: number;
  // 状態空間（一様ランダムに合法車を選ぶプレイでの期待値）
  /** 手番ごとの「残りの車から順に見て合法車に当たるまでに見る台数」の平均。 */
  meanScanCost: number;
  /** 手番ごとの合法車数 / 残り車数 の平均。 */
  meanLegalRatio: number;
  /** 2台以上残っているのに合法車が1台だけの手番数の期待値。 */
  expectedForcedSteps: number;
  /** 合法車が2台以下で、残り4台以上の手番数の期待値（見つけにくい局面）。 */
  expectedScarceSteps: number;
  /** 直前の出庫で新たに出せるようになった車がある手番の割合（連鎖解放で次が示される）。 */
  cuedStepRatio: number;
  /** 直前の出庫で新たに出せる車がなく、しかも合法車が残り車の1/3以下の手番数（手がかりのない探索）。 */
  expectedUncuedScarceSteps: number;
  /** 全到達状態の最小合法車率。 */
  minimumLegalRatio: number;
  /** 各車を出せるようになるまでに最少で先に出す必要がある車の台数の最大値（最も奥に埋もれた車）。 */
  maximumPrerequisiteCount: number;
  /** 先に2台以上を出さないと出せない車の数。 */
  buriedVehicleCount: number;
  /** 合法車が1台しかない局面が続く最大の長さ（本番分析の値）。 */
  maximumForcedChainLength: number;
  /** 解順自由度（log 合法順序数 / log n!）。 */
  orderFreedom: number;
  reachableStateCount: number;
};

export function analyzeParkingJamStudyFeatures(
  generated: ParkingJamGeneratedProblem,
): ParkingJamStudyFeatures {
  const board = generated.problem.board;
  const analysis = generated.difficultyAnalysis;
  const v1 = assessVisualLocalLoadV1(analysis);
  const n = board.vehicles.length;
  const full = (1 << n) - 1;
  const geometry = describeVehicleGeometry(board);

  // 本番ルールと幾何の一致を確認する（分析の前提）。
  const productionLegal = new Set(
    listParkingJamLegalMoves(board, createParkingJamInitialState(board)).map(
      (move) => move.vehicleId,
    ),
  );

  function legalMask(remaining: number): number {
    let mask = 0;
    geometry.forEach((vehicleGeometry, index) => {
      if ((remaining & (1 << index)) === 0) return;
      if (
        vehicleGeometry.available.some(
          (direction) => (direction.blockerMask & remaining) === 0,
        )
      )
        mask |= 1 << index;
    });
    return mask;
  }

  const initialLegal = legalMask(full);
  geometry.forEach((vehicleGeometry, index) => {
    const legal = (initialLegal & (1 << index)) !== 0;
    if (legal !== productionLegal.has(vehicleGeometry.vehicle.id))
      throw new Error("geometry and production rules disagree");
  });

  // 層（並列削除）
  const layerSizes: number[] = [];
  const layerOf = new Array<number>(n).fill(0);
  let remaining = full;
  while (remaining !== 0) {
    const legal = legalMask(remaining);
    if (legal === 0) throw new Error("unsolvable");
    for (let index = 0; index < n; index += 1)
      if (legal & (1 << index)) layerOf[index] = layerSizes.length + 1;
    layerSizes.push(popcount(legal));
    remaining &= ~legal;
  }

  // 初期盤面の局所構造
  let multiBlockedCount = 0;
  let directionChoiceCount = 0;
  let nearMissVehicleCount = 0;
  const gaps: number[] = [];
  for (const vehicleGeometry of geometry) {
    const counts = vehicleGeometry.available.map(
      (direction) => direction.blockers.length,
    );
    if (counts.length > 0 && Math.min(...counts) >= 2) multiBlockedCount += 1;
    if (
      vehicleGeometry.available.length === 2 &&
      counts.filter((count) => count === 0).length === 1
    )
      directionChoiceCount += 1;
    if (vehicleGeometry.directions.some((d) => d.nearMissOpening))
      nearMissVehicleCount += 1;
    for (const direction of vehicleGeometry.available)
      for (const blocker of direction.blockers) gaps.push(blocker.gap);
  }

  // 読み違いレバーの3種は本番の分析結果を使い、本番が使わない「出られそうな縁石」だけをここで数える。
  const clearWallCount = geometry.filter((vehicleGeometry) =>
    vehicleGeometry.directions.some(
      (direction) =>
        !direction.hasOpening &&
        !direction.fixedBlocked &&
        direction.blockers.length === 0 &&
        direction.pathLength > 0,
    ),
  ).length;
  const productionFeatures = analysis.features;
  const initialBlockedVehicleCount =
    productionFeatures.vehicleCount -
    productionFeatures.initialLegalVehicleCount;
  function ratioOf(count: number): number {
    return n === 0 ? 0 : count / n;
  }
  const initialLegalGeometry = geometry.filter(
    (_vehicleGeometry, index) => (initialLegal & (1 << index)) !== 0,
  );
  const hiddenLegalCount = initialLegalGeometry.filter((vehicleGeometry) =>
    vehicleGeometry.available
      .filter((direction) => direction.blockers.length === 0)
      .every((direction) => direction.pathLength >= 2),
  ).length;
  const sideBySideCount = board.vehicles.filter((vehicle) =>
    board.vehicles.some((other) => {
      if (other === vehicle || other.orientation !== vehicle.orientation)
        return false;
      const [laneOffset, start, otherLane, otherStart] =
        vehicle.orientation === "horizontal"
          ? [vehicle.row, vehicle.column, other.row, other.column]
          : [vehicle.column, vehicle.row, other.column, other.row];
      return (
        Math.abs(laneOffset - otherLane) === 1 &&
        start < otherStart + other.length &&
        otherStart < start + vehicle.length
      );
    }),
  ).length;

  // 到達状態と一様ランダムプレイ
  const probability = new Map<number, number>([[full, 1]]);
  const reachable: number[] = [];
  const byPopcount: number[][] = Array.from({ length: n + 1 }, () => []);
  byPopcount[n]?.push(full);
  const seen = new Set<number>([full]);
  let meanScanCostTotal = 0;
  let meanLegalRatioTotal = 0;
  let expectedForcedSteps = 0;
  let expectedScarceSteps = 0;
  let cuedTotal = 0;
  let expectedUncuedScarceSteps = 0;
  let minimumLegalRatio = 1;
  // 直前の出庫で新規に合法になった車があるか: 状態ごとに「親から来た確率」の内訳が要る。
  // 状態 R に遷移してきた確率のうち、新規合法車があった確率を cuedProbability に持つ。
  const cuedProbability = new Map<number, number>();
  const orderCount = new Map<number, number>([[0, 1]]);

  for (let count = n; count >= 1; count -= 1) {
    for (const state of byPopcount[count] ?? []) {
      reachable.push(state);
      const p = probability.get(state) ?? 0;
      const legal = legalMask(state);
      const legalCount = popcount(legal);
      const ratio = legalCount / count;
      minimumLegalRatio = Math.min(minimumLegalRatio, ratio);
      const cued = count === n ? 0 : (cuedProbability.get(state) ?? 0);
      meanScanCostTotal += (p * (count + 1)) / (legalCount + 1);
      meanLegalRatioTotal += p * ratio;
      if (count >= 2 && legalCount === 1) expectedForcedSteps += p;
      if (count >= 4 && legalCount <= 2) expectedScarceSteps += p;
      cuedTotal += cued;
      if (legalCount * 3 <= count) expectedUncuedScarceSteps += p - cued;
      for (let index = 0; index < n; index += 1) {
        if ((legal & (1 << index)) === 0) continue;
        const child = state & ~(1 << index);
        const share = p / legalCount;
        probability.set(child, (probability.get(child) ?? 0) + share);
        const childLegal = legalMask(child);
        const newlyLegal = childLegal & ~legal;
        if (newlyLegal !== 0)
          cuedProbability.set(child, (cuedProbability.get(child) ?? 0) + share);
        if (!seen.has(child)) {
          seen.add(child);
          byPopcount[count - 1]?.push(child);
        }
      }
    }
  }
  // 合法順序数（log）
  const sortedReachable = [...seen].sort((a, b) => popcount(a) - popcount(b));
  for (const state of sortedReachable) {
    if (state === 0) continue;
    const legal = legalMask(state);
    let total = 0;
    for (let index = 0; index < n; index += 1)
      if (legal & (1 << index))
        total += orderCount.get(state & ~(1 << index)) ?? 0;
    orderCount.set(state, total);
  }
  let logFactorial = 0;
  for (let k = 2; k <= n; k += 1) logFactorial += Math.log(k);
  const orders = orderCount.get(full) ?? 1;

  // 必須先行関係: X と Y が共に残り、Y が合法な到達状態が無いなら X は Y より先。
  const canExitWhileRemaining = Array.from({ length: n }, () => 0);
  for (const state of seen) {
    const legal = legalMask(state);
    for (let index = 0; index < n; index += 1)
      if (legal & (1 << index))
        canExitWhileRemaining[index] =
          (canExitWhileRemaining[index] ?? 0) | (state & ~(1 << index));
  }
  let requiredPrecedenceCount = 0;
  const successors = new Array<number>(n).fill(0);
  for (let target = 0; target < n; target += 1)
    for (let predecessor = 0; predecessor < n; predecessor += 1) {
      if (predecessor === target) continue;
      if (((canExitWhileRemaining[target] ?? 0) & (1 << predecessor)) !== 0)
        continue;
      requiredPrecedenceCount += 1;
      successors[predecessor] = (successors[predecessor] ?? 0) + 1;
    }

  // 最少先行台数: 車 i が合法になる到達状態のうち、既に出た車が最少のもの。
  const minimumPrerequisite = new Array<number>(n).fill(n);
  for (const state of seen) {
    const legal = legalMask(state);
    const removed = n - popcount(state);
    for (let index = 0; index < n; index += 1)
      if (legal & (1 << index))
        minimumPrerequisite[index] = Math.min(
          minimumPrerequisite[index] ?? n,
          removed,
        );
  }

  const fixedAreaCellCount = board.fixedAreas.reduce(
    (total, area) => total + area.width * area.height,
    0,
  );
  const vehicleCellCount = board.vehicles.reduce(
    (total, vehicle) => total + vehicle.length,
    0,
  );

  return {
    levers: calculateParkingJamChallengeLevers(analysis.features),
    assessment: assessParkingJamDifficulty(analysis),
    width: board.width,
    height: board.height,
    cellCount: board.width * board.height,
    vehicleCount: n,
    occupancy: vehicleCellCount / (board.width * board.height),
    fixedAreaCount: board.fixedAreas.length,
    fixedAreaCellCount,
    roadOpeningCellCount: board.roadOpenings.reduce(
      (total, opening) => total + opening.length,
      0,
    ),
    v1Score: v1.score,
    v1Difficulty: `visual-local-load-v1:${v1.difficulty}`,
    initialBlockedCount:
      analysis.features.vehicleCount -
      analysis.features.initialLegalVehicleCount,
    initialAverageMinimumBlocking:
      analysis.features.initialAverageMinimumBlockingVehicleCount,
    averageExitPathLength: analysis.features.averageExitPathLength,
    depth: layerSizes.length,
    layerSizes,
    deepVehicleCount: layerOf.filter((layer) => layer >= 3).length,
    multiBlockedCount,
    requiredPrecedenceCount,
    maximumRequiredSuccessorCount: Math.max(0, ...successors),
    directionChoiceCount,
    nearMissVehicleCount,
    averageBlockerGap:
      gaps.length === 0
        ? 0
        : gaps.reduce((total, gap) => total + gap, 0) / gaps.length,
    farBlockerCount: gaps.filter((gap) => gap >= 2).length,
    nearMissRatio: ratioOf(productionFeatures.adjacentLaneOpeningVehicleCount),
    clearWallRatio: ratioOf(clearWallCount),
    directionChoiceRatio: ratioOf(
      productionFeatures.directionChoiceVehicleCount,
    ),
    farBlockedRatio:
      initialBlockedVehicleCount === 0
        ? 0
        : productionFeatures.farBlockedVehicleCount /
          initialBlockedVehicleCount,
    misreadVehicleRatio: ratioOf(
      productionFeatures.misreadInducingVehicleCount,
    ),
    hiddenLegalRatio:
      initialLegalGeometry.length === 0
        ? 0
        : hiddenLegalCount / initialLegalGeometry.length,
    sideBySideRatio: n === 0 ? 0 : sideBySideCount / n,
    meanScanCost: meanScanCostTotal / n,
    meanLegalRatio: meanLegalRatioTotal / n,
    expectedForcedSteps,
    expectedScarceSteps,
    cuedStepRatio: n <= 1 ? 0 : cuedTotal / (n - 1),
    expectedUncuedScarceSteps,
    minimumLegalRatio,
    maximumPrerequisiteCount:
      productionFeatures.maximumPrerequisiteVehicleCount ??
      Math.max(0, ...minimumPrerequisite),
    buriedVehicleCount: minimumPrerequisite.filter((count) => count >= 2)
      .length,
    maximumForcedChainLength:
      analysis.features.maximumForcedChoiceChainLength ?? 0,
    orderFreedom: n <= 1 ? 1 : Math.log(orders) / logFactorial,
    reachableStateCount: reachable.length + 1,
  };
}

/** 生成器を通さない盤面（プレビュー配置、開口を変換した盤面）の特徴を求める。 */
export function analyzeParkingJamBoardStudyFeatures(
  board: ParkingJamBoard,
): ParkingJamStudyFeatures {
  const solvabilityAnalysis = analyzeParkingJamSolvability(board);
  if (solvabilityAnalysis.status !== "solvable")
    throw new Error("Parking jam study board is unsolvable");
  return analyzeParkingJamStudyFeatures({
    problem: { board },
    identity: {
      generatorVersion: "2",
      seed: "study-board",
      conditions: {
        width: board.width,
        height: board.height,
        vehicleCount: board.vehicles.length,
        roadOpeningCount: board.roadOpenings.length,
        roadOpeningSpan: 1,
        fixedAreaCount: board.fixedAreas.length,
        fixedAreaLength: 1,
        blockingPlacementProbability: 0,
      },
      generationAttempt: 1,
    },
    solvabilityAnalysis,
    difficultyAnalysis: analyzeParkingJamDifficulty(board, solvabilityAnalysis),
  });
}

/** 盤面をテキスト図にする。外周の `=` は道路開口、`#` は縁石、`X` は固定領域。車は英字1字（横=小文字、縦=大文字）。 */
export function renderParkingJamBoard(board: ParkingJamBoard): string {
  const grid = Array.from({ length: board.height }, () =>
    Array.from({ length: board.width }, () => "."),
  );
  for (const cell of board.fixedAreas.flatMap(listParkingJamFixedAreaCells)) {
    const row = grid[cell.row];
    if (row) row[cell.column] = "X";
  }
  const letters = "abcdefghijklmnopqrstuvwxyz";
  board.vehicles.forEach((vehicle, index) => {
    const letter = /^[a-z]$/.test(vehicle.id)
      ? vehicle.id
      : (letters[index] ?? "?");
    const mark =
      vehicle.orientation === "vertical" ? letter.toUpperCase() : letter;
    for (const cell of listParkingJamVehicleCells(vehicle)) {
      const row = grid[cell.row];
      if (row) row[cell.column] = mark;
    }
  });
  function edge(side: ParkingJamDirection, offset: number): string {
    return openingCovers(board, side, offset) ? "=" : "#";
  }
  const lines: string[] = [];
  lines.push(
    `+${Array.from({ length: board.width }, (_, column) => edge("up", column)).join("")}+`,
  );
  grid.forEach((row, rowIndex) => {
    lines.push(
      `${edge("left", rowIndex)}${row.join("")}${edge("right", rowIndex)}`,
    );
  });
  lines.push(
    `+${Array.from({ length: board.width }, (_, column) => edge("down", column)).join("")}+`,
  );
  return lines.join("\n");
}
