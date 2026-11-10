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
  isEveryEdgeDecided,
} from "@/games/bridges/problem/generation/bridge-bounds";
import {
  type BridgesBoard,
  getBridgesNetwork,
} from "@/games/bridges/puzzle/board";

/**
 * 人間向け解法器の推論の段。低い段から使い、止まったら次の段を使う。
 * - `A1` ちょうど: 足りた島の残りの行き先は0本。相手の島の残りより多くは架けない。行き先ごとの上限の合計が数字と同じなら全部上限。
 * - `A2` 少なくとも・多くとも: 他の行き先を上限まで使っても足りない分は、この行き先に要る。
 * - `C1p` 2島で閉じない: 架けると、2島だけの組の本数が足りて閉じるなら、その本数は架けない（1と1をつながない、2と2を2本にしない）。
 * - `C1g` 3島以上の組で閉じない: 同じことを、全島ではない3島以上の組で読む。
 * - `C3` 唯一の通り道: この行き先が無いと、架けられる橋だけでは全島がつながらないなら1本は要る。
 * - `D` 1手の先読み: 1手だけ仮に決め、両端の島が埋まった結果、本数が破れる・組が閉じる・数島が孤立するなら、その手は無い。
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

/**
 * 1回の手詰まりで使った段と、その段で範囲を狭めた辺。
 * - `edges`: 範囲を狭めた辺の番号。`edgeCount` はその数。
 * - `readsGroup`: 1手の先読み（D）で、3島以上の組が閉じるか数島が孤立するのを見て退けた手があったか。ほかの段では `false`。
 * - `readsCount`: 1手の先読みで、本数が破れるのを見て退けた手があったか。ほかの段では `false`。
 * - `lowersUpper`: 1手の先読みで、架けすぎる手（本数を多く仮に決める手）を退けて上限を下げたか。ほかの段では `false`。
 * - `readsIsolation`: 1手の先読みで、数島のまとまりが孤立するのを見て退けた手があったか。ほかの段では `false`。
 */
export type BridgesReasoningRound = {
  tier: BridgesReasoningTier;
  edgeCount: number;
  edges: readonly number[];
  readsGroup: boolean;
  readsCount: boolean;
  lowersUpper: boolean;
  readsIsolation: boolean;
};

/**
 * 1手の先読みで、孤立を見て退ける島のまとまりの大きさの上限。仮に決めた手で、架けられる橋だけでは残りとつながらなくなる
 * まとまりが、この数以下の島なら、その島々の行き先を見渡すだけで孤立が分かる。それより大きいまとまりの孤立は、
 * 盤面の一部を見ても分からず、試し置きと同じ探索になるので、1手の先読みでは使わない。
 */
export const BRIDGES_LOOKAHEAD_ISOLATION_LIMIT = 4;

/**
 * 1手の先読みで、閉じるのを見て退ける組の大きさの上限と、そのとき組の外に残る島の数の上限。組がこの数以下の島か、
 * 外に残る島がこの数以下なら、閉じた側か残った側のどちらかを見渡せば閉じたと分かる。どちらも超える組が閉じるのを
 * 確かめるには、十数島をたどる探索になり、試し置きと変わらないので、1手の先読みでは使わない。
 */
export const BRIDGES_LOOKAHEAD_CLOSED_GROUP_LIMIT = 7;
export const BRIDGES_LOOKAHEAD_REMAINING_LIMIT = 5;

/**
 * - `solved`: 全辺の本数が決まった。
 * - `stuck`: 使える段では、決まらない辺が残った。
 * - `contradiction`: 範囲が成り立たなくなった、または全辺の本数が決まったのに全島がつながらない（規則を満たす橋が無い盤面）。
 */
export type BridgesHumanSolveStatus = "solved" | "stuck" | "contradiction";

/**
 * - `rounds`: 手詰まりごとに使った段の記録。順に並ぶ。
 * - `crossingBlockCount`: 架かると決まった橋と交わって0本になった辺のうち、両端の島がまだ足りなかった辺の数。
 *   数字の読みでは塞がらない行き先を、交差が塞いだ回数。
 * - `bridges`: 解き終えた（止まった）ときの、辺ごとの決まった本数の下限。`solved` なら解。
 * - `decidedEdgeRatio`・`undecidedEdgeRatio`: 本数が決まった辺・決まらない辺の割合。辺が無ければ 1・0。
 *   割り算の丸めを境界の比べに持ち込まないよう、両方を数から求める。
 */
export type BridgesHumanSolveTrace = {
  status: BridgesHumanSolveStatus;
  rounds: readonly BridgesReasoningRound[];
  crossingBlockCount: number;
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
 * 1手の先読みで手を退けた理由。
 * - `count`: 本数が破れる。
 * - `closed-pair`・`closed-group`: 2島・3島以上の組が閉じる。
 * - `isolated`: `BRIDGES_LOOKAHEAD_ISOLATION_LIMIT` 以下の島のまとまりが、架けられる橋だけでは残りとつながらなくなる。
 */
type LookaheadFailure = "count" | "closed-pair" | "closed-group" | "isolated";

/**
 * 架かると決まった橋で閉じた（全島ではなく、どの島も足りた）組のうち、見渡せる組（`BRIDGES_LOOKAHEAD_CLOSED_GROUP_LIMIT`
 * 以下の島か、外に残る島が `BRIDGES_LOOKAHEAD_REMAINING_LIMIT` 以下）の最も小さい組の島の数。無ければ `null`。
 */
function findSmallestClosedGroup(
  context: BridgesSolverContext,
  lower: readonly number[],
): number | null {
  const { network, clues } = context;
  const components = findBridgeComponents(context, lower);
  const sizes = new Map<number, number>();
  const remaining = new Map<number, number>();
  for (const [island, root] of components.entries()) {
    sizes.set(root, (sizes.get(root) ?? 0) + 1);
    remaining.set(
      root,
      (remaining.get(root) ?? 0) +
        clues[island]! -
        sumOver(network.islandEdges[island]!, lower),
    );
  }
  let smallest: number | null = null;
  for (const [root, size] of sizes) {
    const visible =
      size <= BRIDGES_LOOKAHEAD_CLOSED_GROUP_LIMIT ||
      components.length - size <= BRIDGES_LOOKAHEAD_REMAINING_LIMIT;
    if (size < components.length && remaining.get(root) === 0 && visible) {
      smallest = Math.min(smallest ?? size, size);
    }
  }
  return smallest;
}

/** 架けられる橋（上限が1本以上の辺）でつながる島のまとまりのうち、最も小さいまとまりの島の数。全島が1つなら `null`。 */
function findSmallestSeparatedPiece(
  { board, endpoints }: BridgesSolverContext,
  upper: readonly number[],
): number | null {
  const parent = board.islands.map((_, island) => island);
  function find(island: number): number {
    let root = island;
    while (parent[root] !== root) {
      parent[root] = parent[parent[root]!]!;
      root = parent[root]!;
    }
    return root;
  }
  for (const [edge, [from, to]] of endpoints.entries()) {
    if (upper[edge]! > 0) {
      parent[find(from)] = find(to);
    }
  }
  const sizes = new Map<number, number>();
  for (const island of board.islands.keys()) {
    const root = find(island);
    sizes.set(root, (sizes.get(root) ?? 0) + 1);
  }
  return sizes.size > 1 ? Math.min(...sizes.values()) : null;
}

/**
 * 1手の先読み: 辺 `edge` の範囲を仮に `assumed` にし、交差と両端の島だけを1段進めて、本数・閉じた組・孤立が破れるか。
 * 1段進めるのは、両端の島が埋まる所だけ（足りた島の他の行き先は0本、行き先ごとの上限の合計が数字と同じなら全部上限）。
 * 本数の破れは、仮に決めた辺と1段で変わった辺の両端の島と、架かると決まった辺と交わる辺の両端の島で見る。
 * 閉じた組は、組か外に残る島の少ない側を見渡せるときだけ見る（`findSmallestClosedGroup`）。孤立は、残りとつながらなくなる
 * まとまりが `BRIDGES_LOOKAHEAD_ISOLATION_LIMIT` 以下の島のときだけ見る。破れなければ `null`。
 */
function failsAfterOneStep(
  context: BridgesSolverContext,
  bounds: BridgeBounds,
  edge: number,
  assumed: { lower?: number; upper?: number },
): LookaheadFailure | null {
  const { network, endpoints, clues } = context;
  const trial = copyBridgeBounds(bounds);
  const { lower, upper } = trial;
  lower[edge] = assumed.lower ?? lower[edge]!;
  upper[edge] = assumed.upper ?? upper[edge]!;
  if (lower[edge]! > upper[edge]!) {
    return "count";
  }
  const touched = new Set<number>();
  const touch = (changed: number) => {
    for (const island of endpoints[changed]!) {
      touched.add(island);
    }
  };
  const blockAndTouch = (decided: number): boolean => {
    if (!blockCrossings(context, trial, decided)) {
      return false;
    }
    for (const crossing of network.crossingEdges[decided]!) {
      touch(crossing);
    }
    return true;
  };
  touch(edge);
  if (lower[edge]! > 0 && !blockAndTouch(edge)) {
    return "count";
  }
  for (const island of endpoints[edge]!) {
    const edges = network.islandEdges[island]!;
    const clue = clues[island]!;
    if (sumOver(edges, lower) === clue) {
      for (const other of edges) {
        if (upper[other] !== lower[other]) {
          upper[other] = lower[other]!;
          touch(other);
        }
      }
    } else if (sumOver(edges, upper) === clue) {
      for (const other of edges) {
        if (lower[other] !== upper[other]) {
          lower[other] = upper[other]!;
          touch(other);
          if (lower[other]! > 0 && !blockAndTouch(other)) {
            return "count";
          }
        }
      }
    }
  }
  for (const island of touched) {
    if (violatesCount(context, trial, island)) {
      return "count";
    }
  }
  const closed = findSmallestClosedGroup(context, lower);
  if (closed !== null) {
    return closed === 2 ? "closed-pair" : "closed-group";
  }
  const separated = findSmallestSeparatedPiece(context, upper);
  return separated !== null && separated <= BRIDGES_LOOKAHEAD_ISOLATION_LIMIT
    ? "isolated"
    : null;
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
      if (failsAfterOneStep(context, bounds, edge, { lower: count }) !== null) {
        tighten(deductions, bounds, edge, lower[edge]!, count - 1);
        break;
      }
    }
    for (let count = upper[edge]! - 1; count >= lower[edge]!; count -= 1) {
      if (failsAfterOneStep(context, bounds, edge, { upper: count }) !== null) {
        tighten(deductions, bounds, edge, count + 1, upper[edge]!);
        break;
      }
    }
  }
  return deductions;
}

/** 1手の先読みで狭めた範囲を、退けた手の理由と向きで分ける。 */
function classifyLookahead(
  context: BridgesSolverContext,
  bounds: BridgeBounds,
  deductions: readonly [number, readonly [number, number]][],
): Pick<
  BridgesReasoningRound,
  "readsGroup" | "readsCount" | "lowersUpper" | "readsIsolation"
> {
  const failures: LookaheadFailure[] = [];
  let lowersUpper = false;
  for (const [edge, [atLeast, atMost]] of deductions) {
    if (atLeast > bounds.lower[edge]!) {
      const failure = failsAfterOneStep(context, bounds, edge, {
        upper: atLeast - 1,
      });
      if (failure !== null) {
        failures.push(failure);
      }
    }
    if (atMost < bounds.upper[edge]!) {
      lowersUpper = true;
      const failure = failsAfterOneStep(context, bounds, edge, {
        lower: atMost + 1,
      });
      if (failure !== null) {
        failures.push(failure);
      }
    }
  }
  return {
    readsGroup: failures.some(
      (failure) => failure === "closed-group" || failure === "isolated",
    ),
    readsCount: failures.includes("count"),
    lowersUpper,
    readsIsolation: failures.includes("isolated"),
  };
}

/** 解き進めた記録。`traceBridgesHumanSolve` の `rounds` と `crossingBlockCount` になる。 */
type SolveLog = {
  rounds: BridgesReasoningRound[];
  crossingBlockCount: number;
};

/** 交差を当て、両端の島がまだ足りないのに交差で0本になった辺の数を返す。 */
function applyCrossingsCountingBlocks(
  context: BridgesSolverContext,
  bounds: BridgeBounds,
): number {
  const before = [...bounds.upper];
  applyBridgeCrossings(context, bounds);
  const { network, endpoints, clues } = context;
  const lacks = (island: number) =>
    sumOver(network.islandEdges[island]!, bounds.lower) < clues[island]!;
  return before.filter(
    (upper, edge) =>
      upper > 0 && bounds.upper[edge] === 0 && endpoints[edge]!.every(lacks),
  ).length;
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
 * 2島で閉じない読み（`own`）を当て、数字の読み（A1・A2）で止まるまで進めた盤面が、3島以上の組の読みを合わせた狭め方（`merged`）に
 * 届くか。届くなら、3島以上の組の読みはその手詰まりには要らない。
 */
function isReachedByCountReasoning(
  context: BridgesSolverContext,
  bounds: BridgeBounds,
  own: readonly [number, readonly [number, number]][],
  merged: readonly [number, readonly [number, number]][],
): boolean {
  const ownRanges = new Map(own);
  if (
    merged.every(([edge, [atLeast, atMost]]) => {
      const range = ownRanges.get(edge);
      return range?.[0] === atLeast && range[1] === atMost;
    })
  ) {
    return true;
  }
  const trial = copyBridgeBounds(bounds);
  for (const [edge, [atLeast, atMost]] of own) {
    trial.lower[edge] = atLeast;
    trial.upper[edge] = atMost;
  }
  try {
    runTiers(context, trial, "A2", null);
  } catch (error) {
    if (!(error instanceof BridgesContradiction)) {
      throw error;
    }
    return false;
  }
  return merged.every(
    ([edge, [atLeast, atMost]]) =>
      trial.lower[edge]! >= atLeast && trial.upper[edge]! <= atMost,
  );
}

/**
 * `maximumTier` までの段で、全辺が決まるか手詰まるまで進める。全辺が決まれば `true`。
 * 各手詰まりでは、低い段から順に、範囲を狭められる最初の段を盤面全体へ同時に当てる。適用の順に依らない。
 * C1p で進める手詰まりでは、`options.closingTiersTogether` なら C1g も一緒に見る。C1p を当てて数字の読みで止まるまで進めても
 * 届かない狭め方が C1g にあるときだけ、両方を当てて段を C1g と記録する。届くなら C1p だけを当てる。
 */
function runTiers(
  context: BridgesSolverContext,
  bounds: BridgeBounds,
  maximumTier: BridgesReasoningTier,
  log: SolveLog | null,
  options: BridgesHumanSolveOptions = defaultHumanSolveOptions,
): boolean {
  const limit = tierRank(maximumTier);
  for (;;) {
    const blocked = applyCrossingsCountingBlocks(context, bounds);
    if (log !== null) {
      log.crossingBlockCount += blocked;
    }
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
      const needsGroups =
        tier === "C1p" &&
        !isReachedByCountReasoning(context, bounds, effective, merged);
      const applied = tier === "C1p" && !needsGroups ? effective : merged;
      const lookahead =
        log !== null && tier === "D"
          ? classifyLookahead(context, bounds, applied)
          : {
              readsGroup: false,
              readsCount: false,
              lowersUpper: false,
              readsIsolation: false,
            };
      for (const [edge, [atLeast, atMost]] of applied) {
        if (atLeast > atMost) {
          throw new BridgesContradiction();
        }
        bounds.lower[edge] = atLeast;
        bounds.upper[edge] = atMost;
      }
      log?.rounds.push({
        tier: needsGroups ? "C1g" : tier,
        edgeCount: applied.length,
        edges: applied.map(([edge]) => edge),
        ...lookahead,
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
    log?.rounds.push({
      tier: "T",
      edgeCount: trialDeductions.size,
      edges: [...trialDeductions.keys()],
      readsGroup: false,
      readsCount: false,
      lowersUpper: false,
      readsIsolation: false,
    });
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
  const log: SolveLog = { rounds: [], crossingBlockCount: 0 };
  const { rounds } = log;
  const edgeCount = bounds.lower.length;
  let solved: boolean;
  try {
    solved = runTiers(context, bounds, maximumTier, log, options);
  } catch (error) {
    if (!(error instanceof BridgesContradiction)) {
      throw error;
    }
    return {
      status: "contradiction",
      rounds,
      crossingBlockCount: log.crossingBlockCount,
      bridges: bounds.lower,
      decidedEdgeRatio: 0,
      undecidedEdgeRatio: 1,
    };
  }
  if (solved && !areAllBridgeComponentsJoined(context, bounds.lower)) {
    return {
      status: "contradiction",
      rounds,
      crossingBlockCount: log.crossingBlockCount,
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
    crossingBlockCount: log.crossingBlockCount,
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
 * 解き始めの決め打ちの島（`countBridgesOpeningSaturatedIslands`）のうち、盤面の四隅の島の数。
 * 四隅の島は行き先が2つしかなく、4 なら見ただけで決まるので、どの盤面でも同じ始まりになりやすい。
 */
export function countBridgesCornerOpeningIslands(board: BridgesBoard): number {
  const context = createBridgesSolverContext(board);
  const { upper } = createInitialBridgeBounds(context);
  const last = board.width - 1;
  return context.network.islandEdges.filter((edges, island) => {
    const { row, column, clue } = board.islands[island]!;
    return (
      (row === 0 || row === last) &&
      (column === 0 || column === last) &&
      clue >= OPENING_SATURATION_MINIMUM_CLUE &&
      sumOver(edges, upper) === clue
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
 * 解く手順の流れ。人間向け解法器が手詰まりごとに使った段と、その手詰まりで狭めた組の数を順に並べる。
 * 流れが同じ問題は、どこで止まりどう抜けるかが同じなので、問題集で同じ流れが並ばないようにするのに使う。
 */
export function describeBridgesSolveFlow(board: BridgesBoard): string {
  return traceBridgesHumanSolve(board, "D")
    .rounds.map(({ tier, edgeCount }) => `${tier}:${edgeCount}`)
    .join(",");
}

/**
 * 解く手順の指紋。流れ（`describeBridgesSolveFlow`）に、手詰まりごとに狭めた組の形（両端の島の数字の組と、
 * 外周に沿う組かどうか）を足す。指紋が同じ問題は、同じ数字の並びを同じ順に読んで解けるので、ほぼ同じ問題になる。
 */
export function describeBridgesSolveFingerprint(board: BridgesBoard): string {
  const { edges } = getBridgesNetwork(board);
  const last = board.width - 1;
  const describeEdge = (edge: number) => {
    const from = board.islands[edges[edge]!.from]!;
    const to = board.islands[edges[edge]!.to]!;
    const [low, high] = [from.clue, to.clue].sort(
      (left, right) => left - right,
    );
    const alongBorder =
      (from.row === to.row && (from.row === 0 || from.row === last)) ||
      (from.column === to.column &&
        (from.column === 0 || from.column === last));
    return `${low}${high}${alongBorder ? "b" : ""}`;
  };
  return traceBridgesHumanSolve(board, "D")
    .rounds.map(
      ({ tier, edges: narrowed }) =>
        `${tier}:${narrowed.map(describeEdge).sort().join(".")}`,
    )
    .join(",");
}
