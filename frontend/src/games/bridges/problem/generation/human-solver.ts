import {
  applyBridgeCrossings,
  areAllBridgeComponentsJoined,
  type BridgeBounds,
  BridgesContradiction,
  type BridgesSolverContext,
  canBridgesStillConnect,
  checkBridgeCounts,
  copyBridgeBounds,
  createBridgesSolverContext,
  createInitialBridgeBounds,
  findBridgeComponents,
  hasClosedBridgeComponent,
  isEveryEdgeDecided,
} from "@/games/bridges/problem/generation/bridge-bounds";
import type { BridgesBoard } from "@/games/bridges/puzzle/board";

/**
 * 人間向け解法器の推論の段。低い段から使い、止まったら次の段を使う。
 * - `A1` ちょうど: 足りた島の残りの行き先は0本。相手の島の残りより多くは架けない。行き先ごとの上限の合計が数字と同じなら全部上限。
 * - `A2` 少なくとも・多くとも: 他の行き先を上限まで使っても足りない分は、この行き先に要る。
 * - `C1p` 2島で閉じない: 架けると、2島だけの組の本数が足りて閉じるなら、その本数は架けない（1と1をつながない、2と2を2本にしない）。
 * - `C1g` 3島以上の組で閉じない: 同じことを、全島ではない3島以上の組で読む。
 * - `C3` 唯一の通り道: この行き先が無いと、架けられる橋だけでは全島がつながらないなら1本は要る。
 * - `D` 1手の先読み: 1手だけ仮に決め、両端の島が埋まった結果、どこかが閉じる・孤立する・本数が破れるなら、その手は無い。
 * - `T` 試し置き: 1手を仮に決めて A1〜D で進めると矛盾するなら、その手は無い。推理の範囲の外で、提供しない問題を見分けるためにだけ使う。
 */
export const bridgesReasoningTiers = [
  "A1",
  "A2",
  "C1p",
  "C1g",
  "C3",
  "D",
  "T",
] as const;

export type BridgesReasoningTier = (typeof bridgesReasoningTiers)[number];

/** 「決め打ち」に数える島の数字の下限。1 と 2 の島は行き先が1つなら決まるのが当たり前で、見せ場にならない。 */
const OPENING_SATURATION_MINIMUM_CLUE = 3;

/** 一か所の気づきとみなす手詰まりで決まる組の数の上限。これより多くまとめて決まる手詰まりは、盤面を同じ規則で掃く作業とみなす。 */
export const BRIDGES_SHARP_ROUND_EDGE_LIMIT = 2;

/** つながりを読む段。 */
export const bridgesConnectivityTiers = [
  "C1p",
  "C1g",
  "C3",
  "D",
] as const satisfies readonly BridgesReasoningTier[];

/** 1回の手詰まりで使った段と、その段で範囲を狭めた辺の数。 */
export type BridgesReasoningRound = {
  tier: BridgesReasoningTier;
  edgeCount: number;
};

/**
 * - `solved`: 全辺の本数が決まった。
 * - `stuck`: 使える段では、決まらない辺が残った。
 * - `contradiction`: 範囲が成り立たなくなった、または全辺の本数が決まったのに全島がつながらない（規則を満たす橋が無い盤面）。
 */
export type BridgesHumanSolveStatus = "solved" | "stuck" | "contradiction";

/**
 * - `rounds`: 手詰まりごとに使った段の記録。順に並ぶ。
 * - `bridges`: 解き終えた（止まった）ときの、辺ごとの決まった本数の下限。`solved` なら解。
 * - `decidedEdgeRatio`・`undecidedEdgeRatio`: 本数が決まった辺・決まらない辺の割合。辺が無ければ 1・0。
 *   割り算の丸めを境界の比べに持ち込まないよう、両方を数から求める。
 */
export type BridgesHumanSolveTrace = {
  status: BridgesHumanSolveStatus;
  rounds: readonly BridgesReasoningRound[];
  bridges: readonly number[];
  decidedEdgeRatio: number;
  undecidedEdgeRatio: number;
};

/** 段が狭めた範囲。辺の番号ごとの新しい下限と上限。 */
type Deductions = Map<number, readonly [number, number]>;

function tighten(
  deductions: Deductions,
  { lower, upper }: BridgeBounds,
  edge: number,
  atLeast: number,
  atMost: number,
): void {
  const [currentLower, currentUpper] = deductions.get(edge) ?? [
    lower[edge]!,
    upper[edge]!,
  ];
  deductions.set(edge, [
    Math.max(currentLower, atLeast),
    Math.min(currentUpper, atMost),
  ]);
}

function sumOver(edges: readonly number[], values: readonly number[]): number {
  let total = 0;
  for (const edge of edges) {
    total += values[edge]!;
  }
  return total;
}

function deduceExactCounts(
  { network, endpoints, clues }: BridgesSolverContext,
  bounds: BridgeBounds,
): Deductions {
  const deductions: Deductions = new Map();
  const { lower, upper } = bounds;
  const remaining = network.islandEdges.map(
    (edges, island) => clues[island]! - sumOver(edges, lower),
  );
  const caps = endpoints.map(([from, to], edge) =>
    Math.min(
      upper[edge]!,
      lower[edge]! + remaining[from]!,
      lower[edge]! + remaining[to]!,
    ),
  );
  for (const [edge, cap] of caps.entries()) {
    if (cap < upper[edge]!) {
      tighten(deductions, bounds, edge, lower[edge]!, cap);
    }
  }
  for (const [island, edges] of network.islandEdges.entries()) {
    if (sumOver(edges, caps) !== clues[island]) {
      continue;
    }
    for (const edge of edges) {
      if (lower[edge]! < caps[edge]!) {
        tighten(deductions, bounds, edge, caps[edge]!, caps[edge]!);
      }
    }
  }
  return deductions;
}

function deduceRequiredCounts(
  { network, clues }: BridgesSolverContext,
  bounds: BridgeBounds,
): Deductions {
  const deductions: Deductions = new Map();
  const { lower, upper } = bounds;
  for (const [island, edges] of network.islandEdges.entries()) {
    const clue = clues[island]!;
    const lowerSum = sumOver(edges, lower);
    const upperSum = sumOver(edges, upper);
    for (const edge of edges) {
      const atLeast = clue - (upperSum - upper[edge]!);
      const atMost = clue - (lowerSum - lower[edge]!);
      if (atLeast > lower[edge]! || atMost < upper[edge]!) {
        tighten(
          deductions,
          bounds,
          edge,
          Math.max(lower[edge]!, atLeast),
          Math.min(upper[edge]!, atMost),
        );
      }
    }
  }
  return deductions;
}

function deduceUnclosedGroups(
  context: BridgesSolverContext,
  bounds: BridgeBounds,
  pairOnly: boolean,
): Deductions {
  const deductions: Deductions = new Map();
  const { network, endpoints, clues } = context;
  const { lower, upper } = bounds;
  const components = findBridgeComponents(context, lower);
  const islandCount = components.length;
  const memberCounts = new Map<number, number>();
  const remaining = new Map<number, number>();
  for (const [island, root] of components.entries()) {
    memberCounts.set(root, (memberCounts.get(root) ?? 0) + 1);
    remaining.set(
      root,
      (remaining.get(root) ?? 0) +
        clues[island]! -
        sumOver(network.islandEdges[island]!, lower),
    );
  }
  for (const [edge, [from, to]] of endpoints.entries()) {
    if (lower[edge]! >= upper[edge]!) {
      continue;
    }
    const fromRoot = components[from]!;
    const toRoot = components[to]!;
    const joined = fromRoot !== toRoot;
    const groupSize =
      memberCounts.get(fromRoot)! + (joined ? memberCounts.get(toRoot)! : 0);
    if (groupSize >= islandCount || pairOnly !== (groupSize === 2)) {
      continue;
    }
    const groupRemaining =
      remaining.get(fromRoot)! + (joined ? remaining.get(toRoot)! : 0);
    for (let count = lower[edge]! + 1; count <= upper[edge]!; count += 1) {
      if (groupRemaining - 2 * (count - lower[edge]!) === 0) {
        tighten(deductions, bounds, edge, lower[edge]!, count - 1);
        break;
      }
    }
  }
  return deductions;
}

function deduceOnlyPassages(
  context: BridgesSolverContext,
  bounds: BridgeBounds,
): Deductions {
  const deductions: Deductions = new Map();
  const { lower, upper } = bounds;
  for (const edge of upper.keys()) {
    if (
      lower[edge] === 0 &&
      upper[edge]! > 0 &&
      !canBridgesStillConnect(context, upper, edge)
    ) {
      tighten(deductions, bounds, edge, 1, upper[edge]!);
    }
  }
  return deductions;
}

/** 架かると決まった辺 `edge` と交わる辺を0本にする。交わる辺に架かると決まっていれば `false`。 */
function blockCrossings(
  { network }: BridgesSolverContext,
  { lower, upper }: BridgeBounds,
  edge: number,
): boolean {
  for (const crossing of network.crossingEdges[edge]!) {
    if (lower[crossing]! > 0) {
      return false;
    }
    upper[crossing] = 0;
  }
  return true;
}

function violatesCount(
  { network, clues }: BridgesSolverContext,
  { lower, upper }: BridgeBounds,
  island: number,
): boolean {
  const edges = network.islandEdges[island]!;
  const clue = clues[island]!;
  return sumOver(edges, lower) > clue || sumOver(edges, upper) < clue;
}

/**
 * 1手の先読み: 辺 `edge` の範囲を仮に `assumed` にし、交差と両端の島だけを1段進めて、本数・閉じた組・つながりが破れるか。
 */
function failsAfterOneStep(
  context: BridgesSolverContext,
  bounds: BridgeBounds,
  edge: number,
  assumed: { lower?: number; upper?: number },
): boolean {
  const { network, endpoints, clues } = context;
  const trial = copyBridgeBounds(bounds);
  const { lower, upper } = trial;
  lower[edge] = assumed.lower ?? lower[edge]!;
  upper[edge] = assumed.upper ?? upper[edge]!;
  if (lower[edge]! > upper[edge]!) {
    return true;
  }
  const [from, to] = endpoints[edge]!;
  const touched = new Set([from, to]);
  if (lower[edge]! > 0) {
    if (!blockCrossings(context, trial, edge)) {
      return true;
    }
    for (const crossing of network.crossingEdges[edge]!) {
      for (const island of endpoints[crossing]!) {
        touched.add(island);
      }
    }
  }
  for (const island of touched) {
    if (violatesCount(context, trial, island)) {
      return true;
    }
  }
  for (const island of [from, to]) {
    const edges = network.islandEdges[island]!;
    const clue = clues[island]!;
    if (sumOver(edges, lower) === clue) {
      for (const other of edges) {
        upper[other] = lower[other]!;
      }
    } else if (sumOver(edges, upper) === clue) {
      for (const other of edges) {
        lower[other] = upper[other]!;
        if (lower[other]! > 0 && !blockCrossings(context, trial, other)) {
          return true;
        }
      }
    }
  }
  return (
    hasClosedBridgeComponent(context, lower) ||
    !canBridgesStillConnect(context, upper)
  );
}

function deduceByLookahead(
  context: BridgesSolverContext,
  bounds: BridgeBounds,
): Deductions {
  const deductions: Deductions = new Map();
  const { lower, upper } = bounds;
  for (const edge of upper.keys()) {
    if (lower[edge]! >= upper[edge]!) {
      continue;
    }
    for (let count = lower[edge]! + 1; count <= upper[edge]!; count += 1) {
      if (failsAfterOneStep(context, bounds, edge, { lower: count })) {
        tighten(deductions, bounds, edge, lower[edge]!, count - 1);
        break;
      }
    }
    for (let count = upper[edge]! - 1; count >= lower[edge]!; count -= 1) {
      if (failsAfterOneStep(context, bounds, edge, { upper: count })) {
        tighten(deductions, bounds, edge, count + 1, upper[edge]!);
        break;
      }
    }
  }
  return deductions;
}

const deductionTiers = [
  ["A1", deduceExactCounts],
  ["A2", deduceRequiredCounts],
  ["C1p", (context, bounds) => deduceUnclosedGroups(context, bounds, true)],
  ["C1g", (context, bounds) => deduceUnclosedGroups(context, bounds, false)],
  ["C3", deduceOnlyPassages],
  ["D", deduceByLookahead],
] as const satisfies readonly (readonly [
  Exclude<BridgesReasoningTier, "T">,
  (context: BridgesSolverContext, bounds: BridgeBounds) => Deductions,
])[];

function deduceByTier(
  tier: Exclude<BridgesReasoningTier, "T">,
  context: BridgesSolverContext,
  bounds: BridgeBounds,
): Deductions {
  const [, deduce] = deductionTiers.find(([name]) => name === tier)!;
  return deduce(context, bounds);
}

function tierRank(tier: BridgesReasoningTier): number {
  return bridgesReasoningTiers.indexOf(tier);
}

/** 範囲を実際に狭めた推論だけを残す。 */
function listEffectiveDeductions(
  deductions: Deductions,
  { lower, upper }: BridgeBounds,
): [number, readonly [number, number]][] {
  return [...deductions].filter(
    ([edge, [atLeast, atMost]]) =>
      atLeast !== lower[edge] || atMost !== upper[edge],
  );
}

/**
 * 試し置き: 未決の辺を順に、その辺の各本数を仮に決めて A1〜D で進め、矛盾した本数を外す。
 * 外せる本数のある最初の辺だけを返し、試し置きは1手ずつ数える。
 */
function deduceByTrial(
  context: BridgesSolverContext,
  bounds: BridgeBounds,
  options: BridgesHumanSolveOptions,
): Deductions {
  const { lower, upper } = bounds;
  for (const edge of upper.keys()) {
    if (lower[edge]! >= upper[edge]!) {
      continue;
    }
    let atLeast = lower[edge]!;
    let atMost = upper[edge]!;
    let excluded = false;
    for (let count = lower[edge]!; count <= upper[edge]!; count += 1) {
      const trial = copyBridgeBounds(bounds);
      trial.lower[edge] = count;
      trial.upper[edge] = count;
      try {
        runTiers(context, trial, "D", null, options);
        if (
          isEveryEdgeDecided(trial) &&
          !areAllBridgeComponentsJoined(context, trial.lower)
        ) {
          throw new BridgesContradiction();
        }
      } catch (error) {
        if (!(error instanceof BridgesContradiction)) {
          throw error;
        }
        excluded = true;
        if (count === atLeast) {
          atLeast += 1;
        }
        if (count === atMost) {
          atMost -= 1;
        }
      }
    }
    if (excluded) {
      return new Map([[edge, [atLeast, atMost]]]);
    }
  }
  return new Map();
}

/** 同じ辺の範囲をいくつかの推論が狭めたら、それらの重なりにする。 */
function mergeDeductions(
  deductions: readonly [number, readonly [number, number]][],
): [number, readonly [number, number]][] {
  const merged = new Map<number, readonly [number, number]>();
  for (const [edge, [atLeast, atMost]] of deductions) {
    const current = merged.get(edge);
    merged.set(
      edge,
      current
        ? [Math.max(current[0], atLeast), Math.min(current[1], atMost)]
        : [atLeast, atMost],
    );
  }
  return [...merged];
}

/**
 * 解き方の選び方。
 * - `closingTiersTogether`: 2島で閉じない読み（C1p）で進める手詰まりでは、3島以上の組で閉じない読み（C1g）も同じ手詰まりで一緒に当てる。
 *   どちらも「架けると組が閉じる」同じ読みで、人は同じ局面で両方を見る。分けて当てると、低い段だけを当てる規則のせいで
 *   C1g で決まる所が次の手詰まりへ回り、つながりの読みの回数が増える。研究用の解法器との突き合わせでだけ `false` にする。
 */
type BridgesHumanSolveOptions = {
  closingTiersTogether: boolean;
};

const defaultHumanSolveOptions: BridgesHumanSolveOptions = {
  closingTiersTogether: true,
};

/**
 * `maximumTier` までの段で、全辺が決まるか手詰まるまで進める。全辺が決まれば `true`。
 * 各手詰まりでは、低い段から順に、範囲を狭められる最初の段を盤面全体へ同時に当てる。適用の順に依らない。
 * C1p で進める手詰まりでは、`options.closingTiersTogether` なら C1g も一緒に当て、C1g で新たに決まった辺があれば段を C1g と記録する。
 */
function runTiers(
  context: BridgesSolverContext,
  bounds: BridgeBounds,
  maximumTier: BridgesReasoningTier,
  rounds: BridgesReasoningRound[] | null,
  options: BridgesHumanSolveOptions = defaultHumanSolveOptions,
): boolean {
  const limit = tierRank(maximumTier);
  for (;;) {
    applyBridgeCrossings(context, bounds);
    checkBridgeCounts(context, bounds);
    if (isEveryEdgeDecided(bounds)) {
      return true;
    }
    let progressed = false;
    for (const [tier, deduce] of deductionTiers) {
      if (tierRank(tier) > limit) {
        break;
      }
      const effective = listEffectiveDeductions(
        deduce(context, bounds),
        bounds,
      );
      if (effective.length === 0) {
        continue;
      }
      const together =
        options.closingTiersTogether &&
        tier === "C1p" &&
        tierRank("C1g") <= limit
          ? listEffectiveDeductions(
              deduceByTier("C1g", context, bounds),
              bounds,
            )
          : [];
      const merged = mergeDeductions([...effective, ...together]);
      for (const [edge, [atLeast, atMost]] of merged) {
        if (atLeast > atMost) {
          throw new BridgesContradiction();
        }
        bounds.lower[edge] = atLeast;
        bounds.upper[edge] = atMost;
      }
      const narrowedFurtherByGroups = merged.some(
        ([edge, range]) =>
          !effective.some(
            ([own, ownRange]) =>
              own === edge &&
              ownRange[0] === range[0] &&
              ownRange[1] === range[1],
          ),
      );
      rounds?.push({
        tier: narrowedFurtherByGroups ? "C1g" : tier,
        edgeCount: merged.length,
      });
      progressed = true;
      break;
    }
    if (progressed) {
      continue;
    }
    if (limit < tierRank("T")) {
      return false;
    }
    const trialDeductions = deduceByTrial(context, bounds, options);
    if (trialDeductions.size === 0) {
      return false;
    }
    for (const [edge, [atLeast, atMost]] of trialDeductions) {
      bounds.lower[edge] = atLeast;
      bounds.upper[edge] = atMost;
    }
    rounds?.push({ tier: "T", edgeCount: trialDeductions.size });
  }
}

/** 島の数字と盤面だけから（解を見ずに）、`maximumTier` までの段で解き進めた経過。 */
export function traceBridgesHumanSolve(
  board: BridgesBoard,
  maximumTier: BridgesReasoningTier = "T",
): BridgesHumanSolveTrace {
  return traceHumanSolve(board, maximumTier, defaultHumanSolveOptions);
}

function traceHumanSolve(
  board: BridgesBoard,
  maximumTier: BridgesReasoningTier,
  options: BridgesHumanSolveOptions,
): BridgesHumanSolveTrace {
  const context = createBridgesSolverContext(board);
  const bounds = createInitialBridgeBounds(context);
  const rounds: BridgesReasoningRound[] = [];
  const edgeCount = bounds.lower.length;
  let solved: boolean;
  try {
    solved = runTiers(context, bounds, maximumTier, rounds, options);
  } catch (error) {
    if (!(error instanceof BridgesContradiction)) {
      throw error;
    }
    return {
      status: "contradiction",
      rounds,
      bridges: bounds.lower,
      decidedEdgeRatio: 0,
      undecidedEdgeRatio: 1,
    };
  }
  if (solved && !areAllBridgeComponentsJoined(context, bounds.lower)) {
    return {
      status: "contradiction",
      rounds,
      bridges: bounds.lower,
      decidedEdgeRatio: 1,
      undecidedEdgeRatio: 0,
    };
  }
  const decidedCount = bounds.lower.filter(
    (value, edge) => value === bounds.upper[edge],
  ).length;
  return {
    status: solved ? "solved" : "stuck",
    rounds,
    bridges: bounds.lower,
    decidedEdgeRatio: edgeCount === 0 ? 1 : decidedCount / edgeCount,
    undecidedEdgeRatio:
      edgeCount === 0 ? 0 : (edgeCount - decidedCount) / edgeCount,
  };
}

/** 解き始めの盤面で、数字の読み（A1・A2）だけで範囲を狭められる辺の数。入口の広さ。 */
export function countBridgesOpeningEdges(board: BridgesBoard): number {
  const context = createBridgesSolverContext(board);
  const bounds = createInitialBridgeBounds(context);
  const edges = new Set(
    [
      ...listEffectiveDeductions(deduceExactCounts(context, bounds), bounds),
      ...listEffectiveDeductions(deduceRequiredCounts(context, bounds), bounds),
    ].map(([edge]) => edge),
  );
  return edges.size;
}

/**
 * 解き始めの盤面で、行き先ごとの上限（2本と相手の数字の小さい方）を足すと数字と同じになる、数字3以上の島の数。
 * 見ただけで全部の行き先の本数が決まる「決め打ち」（4 の島に行き先2つ、6 に3つ、8 に4つ、相手の数字で上限が下がる島など）。
 */
export function countBridgesOpeningSaturatedIslands(
  board: BridgesBoard,
): number {
  const context = createBridgesSolverContext(board);
  const { upper } = createInitialBridgeBounds(context);
  return context.network.islandEdges.filter((edges, island) => {
    const clue = context.clues[island]!;
    return (
      clue >= OPENING_SATURATION_MINIMUM_CLUE && sumOver(edges, upper) === clue
    );
  }).length;
}

/**
 * 数字の読み（A1・A2）だけで、決まるまで進める。止まったら `false`、範囲が成り立たなくなったら `BridgesContradiction` を投げる。
 * 素朴な解き方が1手ごとに使う。
 */
export function propagateBridgesCountReasoning(
  context: BridgesSolverContext,
  bounds: BridgeBounds,
): boolean {
  return runTiers(context, bounds, "A2", null);
}

/** 研究用の解法器と突き合わせるための、C1p と C1g を別の手詰まりで当てる経過。 */
function traceWithSeparateClosingTiers(
  board: BridgesBoard,
  maximumTier: BridgesReasoningTier = "T",
): BridgesHumanSolveTrace {
  return traceHumanSolve(board, maximumTier, { closingTiersTogether: false });
}

export const _private = { failsAfterOneStep, traceWithSeparateClosingTiers };

/**
 * 解く手順の指紋。人間向け解法器が手詰まりごとに使った段と、その手詰まりで狭めた組の数を順に並べる。
 * 指紋が同じ問題は、どこで止まりどう抜けるかの流れが同じなので、問題集で同じ指紋が並ばないようにするのに使う。
 */
export function describeBridgesSolveFingerprint(board: BridgesBoard): string {
  return traceBridgesHumanSolve(board, "D")
    .rounds.map(({ tier, edgeCount }) => `${tier}:${edgeCount}`)
    .join(",");
}
