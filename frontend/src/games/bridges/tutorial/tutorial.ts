import {
  BRIDGES_MAXIMUM_BRIDGE_COUNT,
  type BridgesBoard,
  getBridgesNetwork,
  parseBridgesBoard,
} from "@/games/bridges/puzzle/board";
import {
  type BridgesIslandStatus,
  countBridgesIslandBridges,
  isBridgesSolved,
  listBridgesIslandStatuses,
} from "@/games/bridges/puzzle/rules";
import type { BridgeCount } from "@/games/bridges/puzzle/state";
import { cycleBridgesEdge } from "@/games/bridges/puzzle/transitions";
import type {
  Tutorial,
  TutorialMessage,
  TutorialMoveOutcome,
  TutorialSituation,
  TutorialStep,
} from "@/games/tutorial";

export type BridgesTutorialRuleId = "count" | "double" | "cross";

/** 本番と同じく、島の間を押すか島からなぞって、辺の橋を 1本 → 2本 → なし と回す。 */
export type BridgesTutorialAction = { type: "cycle"; edge: number };

/** 手順で架ける辺と、その辺に架かる本数。 */
export type BridgesTutorialTarget = { edge: number; count: BridgeCount };

/**
 * - `targets`: この手順で架ける辺と本数。手順の間は、この辺を、この本数まで架ける手だけを受け付ける。すべて架けたら次の手順へ進む。
 * - `island`: 手を決めさせる島。伝えたルールで、この島から見て `targets` の本数が決まる。操作を教える手順では `null`。
 * - `pointed`: `targets` に印と指を付けるか。操作を教える手順だけが付ける。ルールを伝える手順と読みの手順は、
 *   どの辺に何本架けるかを自分で決めさせるため付けない。
 * - `midwayMessage`: `targets` の辺を1本にしたが、まだ2本に届いていない間の一言。2回押して2本にする操作を初めて使う手順だけが持つ。
 * - `offStepMessage`: 手順に無い辺を押したときの一言。今の手順で何をするかを言う。
 * - `blockedDetail`: 交差のルールを伝えた後に、交わる橋に阻まれたときの一言に添える、今の手順で何をするか。
 *   交差のルールを伝える前の手順では、阻まれた手を違反とせず `offStepMessage` で返すので持たない。
 */
export type BridgesTutorialStep = TutorialStep<BridgesTutorialRuleId> & {
  targets: readonly BridgesTutorialTarget[];
  island: number | null;
  pointed: boolean;
  midwayMessage: TutorialMessage | null;
  offStepMessage: TutorialMessage;
  blockedDetail: string | null;
};

/**
 * 決め手。手を決めるときに見る島と橋。
 * - `islands`: 数字を見る島。手を決めさせる島と、その行き先の島。
 * - `edges`: 手を決めさせる島から出る辺と、その辺を阻む、架かった橋の辺。
 */
export type BridgesTutorialReason = {
  islands: readonly number[];
  edges: readonly number[];
};

/**
 * 直前の手。盤面の反応と合図に使う。
 * - `changed`: 辺 `edge` の橋の本数を `previous` 本から変えた。`fitsStep` は、手を引いている手順の辺を、手順の本数まで架けたか。
 * - `blocked`: 辺 `edge` に架けようとしたが、交わる辺 `crossingEdges` の橋に阻まれた。本番と同じく盤面は変えない。
 */
export type BridgesTutorialMove =
  | { kind: "changed"; edge: number; previous: BridgeCount; fitsStep: boolean }
  | { kind: "blocked"; edge: number; crossingEdges: readonly number[] };

export type BridgesTutorialBoardState = {
  bridges: readonly BridgeCount[];
  /** 同じ辺への合図をやり直す目印に使う。 */
  moveCount: number;
  lastMove: BridgesTutorialMove | null;
};

export type BridgesTutorialSituation = TutorialSituation<
  BridgesTutorialRuleId,
  BridgesTutorialStep
>;

/**
 * 6×6 の盤面に島が11。
 *
 * ```text
 * 盤面      解
 * 4.5..1    4=5--1
 * ....1.    H.H.1.
 * 3....2    3.H.|2
 * ..6.3.    |.6=3H
 * ......    |.H..H
 * 1.3..3    1.3--3
 * ```
 */
const board: BridgesBoard = parseBridgesBoard([
  "4.5..1",
  "....1.",
  "3....2",
  "..6.3.",
  "......",
  "1.3..3",
]);

const network = getBridgesNetwork(board);

function islandAt(oneBasedRow: number, oneBasedColumn: number): number {
  const island = board.islands.findIndex(
    (candidate) =>
      candidate.row === oneBasedRow - 1 &&
      candidate.column === oneBasedColumn - 1,
  );
  if (island < 0) {
    throw new RangeError(
      `No Bridges tutorial island at ${oneBasedRow}:${oneBasedColumn}`,
    );
  }
  return island;
}

function edgeBetween(
  [oneBasedFromRow, oneBasedFromColumn]: readonly [number, number],
  [oneBasedToRow, oneBasedToColumn]: readonly [number, number],
): number {
  const from = islandAt(oneBasedFromRow, oneBasedFromColumn);
  const to = islandAt(oneBasedToRow, oneBasedToColumn);
  const edge = network.edges.findIndex(
    (candidate) => candidate.from === from && candidate.to === to,
  );
  if (edge < 0) {
    throw new RangeError(
      `No Bridges tutorial edge between ${oneBasedFromRow}:${oneBasedFromColumn} and ${oneBasedToRow}:${oneBasedToColumn}`,
    );
  }
  return edge;
}

const solvedBridgeCounts: readonly (readonly [
  readonly [number, number],
  readonly [number, number],
  BridgeCount,
])[] = [
  [[1, 1], [1, 3], 2],
  [[1, 1], [3, 1], 2],
  [[1, 3], [1, 6], 1],
  [[1, 3], [4, 3], 2],
  [[2, 5], [4, 5], 1],
  [[3, 1], [6, 1], 1],
  [[3, 6], [6, 6], 2],
  [[4, 3], [4, 5], 2],
  [[4, 3], [6, 3], 2],
  [[6, 3], [6, 6], 1],
];

const solvedBridges: readonly BridgeCount[] = network.edges.map((_, edge) => {
  const solved = solvedBridgeCounts.find(
    ([from, to]) => edgeBetween(from, to) === edge,
  );
  return solved?.[2] ?? 0;
});

const emptyBridges: readonly BridgeCount[] = network.edges.map(() => 0);

/**
 * - 操作: 右の1から下の3へ1本架ける。右の1は行き先がここだけなので、ゴールと同じ1本。
 * - 数字と同じ本数: 下の3は上の1から1本。上の1は足りたので、残りの2本は左の6へ架ける。2回押して2本にする操作もここで使う。
 * - 2本まで: 左上の4は行き先が2つなので、どちらにも2本ずつ架ける。
 * - 交差しない: 左の3は上から2本。右へは操作の手順で架けた縦の橋と交わるので、残りの1本は下の1へ架ける。
 *   考えずに右へ押すと、本番と同じく板が突き当たって弾かれ、阻んだ橋が赤く揺れる。
 * - 読み: 右下の3は、どちらの行き先も2本までなので、片方だけでは足りない。どちらにも1本ずつ架ける。
 * 手を離した後は、上の5が同じ読み（右の1へは1本まで、下へは2本までで、足りない分を架ける）で決まり、
 * 右の2は右上の1が足りて下だけに決まり、残りも数字と同じ本数で決まる。
 */
const steps: readonly BridgesTutorialStep[] = [
  {
    message: {
      headline: "島と島の間をタップして橋を架けます",
      detail: null,
    },
    introducedRuleId: null,
    targets: [{ edge: edgeBetween([2, 5], [4, 5]), count: 1 }],
    island: null,
    pointed: true,
    midwayMessage: null,
    offStepMessage: {
      headline: "島と島の間をタップして橋を架けます",
      detail: null,
    },
    blockedDetail: null,
  },
  {
    message: {
      headline: "島からは数字と同じ本数\n橋が出ます",
      detail: "緑の島は本数がそろっています",
    },
    introducedRuleId: "count",
    targets: [{ edge: edgeBetween([4, 3], [4, 5]), count: 2 }],
    island: islandAt(4, 5),
    pointed: false,
    midwayMessage: {
      headline: "もう一度タップして橋を2本にします",
      detail: "上の1の島はもう足りています",
    },
    offStepMessage: {
      headline: "上の1の島とつないだ3の島に残りの橋を架けます",
      detail: "緑の島は本数がそろっています",
    },
    blockedDetail: null,
  },
  {
    message: {
      headline: "島と島の間には\n橋を2本まで架けられます",
      detail: "左上の4の島から橋を架けられる島は2つです",
    },
    introducedRuleId: "double",
    targets: [
      { edge: edgeBetween([1, 1], [1, 3]), count: 2 },
      { edge: edgeBetween([1, 1], [3, 1]), count: 2 },
    ],
    island: islandAt(1, 1),
    pointed: false,
    midwayMessage: null,
    offStepMessage: {
      headline: "左上の4の島から橋を架けます",
      detail: "左上の4の島から橋を架けられる島は2つです",
    },
    blockedDetail: null,
  },
  {
    message: {
      headline: "橋どうしが交差しないように架けます",
      detail: "左の3の島にあと1本架けます",
    },
    introducedRuleId: "cross",
    targets: [{ edge: edgeBetween([3, 1], [6, 1]), count: 1 }],
    island: islandAt(3, 1),
    pointed: false,
    midwayMessage: null,
    offStepMessage: {
      headline: "左の3の島にあと1本架けます",
      detail: "右へ架けると縦の橋と交差します",
    },
    blockedDetail: "左の3の島からはほかの島へ架けます",
  },
  {
    message: {
      headline: "右下の3の島は片方の島へ架けるだけでは本数が足りません",
      detail: "両方の島に1本ずつ架けます",
    },
    introducedRuleId: null,
    targets: [
      { edge: edgeBetween([3, 6], [6, 6]), count: 1 },
      { edge: edgeBetween([6, 3], [6, 6]), count: 1 },
    ],
    island: islandAt(6, 6),
    pointed: false,
    midwayMessage: null,
    offStepMessage: {
      headline: "右下の3の島から両方の島へ1本ずつ架けます",
      detail: null,
    },
    blockedDetail: "右下の3の島から両方の島へ架けます",
  },
];

function getOtherIsland(edge: number, island: number): number {
  const { from, to } = network.edges[edge]!;
  return from === island ? to : from;
}

/** 架かった橋に阻まれて、今は架けられない辺か。 */
function isBlocked(bridges: readonly BridgeCount[], edge: number): boolean {
  return (
    bridges[edge] === 0 &&
    network.crossingEdges[edge]!.some((crossing) => bridges[crossing]! > 0)
  );
}

/**
 * 島 `island` から見て、辺 `edge` にあと何本架けられるか。手に入れたルールで盤面から分かる分だけ限る。
 * 自分の数字と行き先の数字の残り、2本まで、交わる橋で限る。
 */
function findRoom(
  bridges: readonly BridgeCount[],
  ruleIds: readonly BridgesTutorialRuleId[],
  counts: readonly number[],
  island: number,
  edge: number,
): number {
  const other = getOtherIsland(edge, island);
  const limits = [
    board.islands[island]!.clue - counts[island]!,
    board.islands[other]!.clue - counts[other]!,
    ...(ruleIds.includes("double")
      ? [BRIDGES_MAXIMUM_BRIDGE_COUNT - bridges[edge]!]
      : []),
    ...(ruleIds.includes("cross") && isBlocked(bridges, edge) ? [0] : []),
  ];
  return Math.max(0, Math.min(...limits));
}

/**
 * 手を決める読み。
 * - `single`: 架けられる行き先が1つしかない。
 * - `shortfall`: ほかの行き先に架けられるだけ架けても足りない分を、この行き先に架ける。
 */
export type BridgesTutorialRead = "single" | "shortfall";

/** 辺に、今の盤面と手に入れたルールだけで、少なくとも何本架かると決まるか。 */
type BridgesDeduction = {
  edge: number;
  island: number;
  minimum: number;
  read: BridgesTutorialRead;
};

/**
 * 島 `island` の数字の残りから、ほかの辺に架けられる分を引いて足りない分を、それぞれの辺に要る本数とみなす。
 * 数字と同じ本数のルールを手に入れるまでは、何も決まらない。
 */
function deduceFromIsland(
  bridges: readonly BridgeCount[],
  ruleIds: readonly BridgesTutorialRuleId[],
  island: number,
): BridgesDeduction[] {
  if (!ruleIds.includes("count")) {
    return [];
  }
  const counts = countBridgesIslandBridges(board, { bridges });
  const need = board.islands[island]!.clue - counts[island]!;
  if (need <= 0) {
    return [];
  }
  const edges = network.islandEdges[island]!;
  const rooms = edges.map((edge) =>
    findRoom(bridges, ruleIds, counts, island, edge),
  );
  const total = rooms.reduce((sum, room) => sum + room, 0);
  const openCount = rooms.filter((room) => room > 0).length;
  return edges.flatMap((edge, index) => {
    const added = Math.min(need - (total - rooms[index]!), rooms[index]!);
    return added > 0
      ? [
          {
            edge,
            island,
            minimum: bridges[edge]! + added,
            read: openCount === 1 ? "single" : "shortfall",
          },
        ]
      : [];
  });
}

/** 盤面のどこかの辺に、今の盤面と手に入れたルールだけで決まる手。 */
function listDeductions(
  bridges: readonly BridgeCount[],
  ruleIds: readonly BridgesTutorialRuleId[],
): BridgesDeduction[] {
  return board.islands.flatMap((_, island) =>
    deduceFromIsland(bridges, ruleIds, island),
  );
}

/** 島 `island` から手を決めるときに見る島と橋。その島と行き先の島、出る辺と、その辺を阻む架かった橋。 */
function getIslandReason(
  bridges: readonly BridgeCount[],
  island: number,
): BridgesTutorialReason {
  const edges = network.islandEdges[island]!;
  const blockingEdges = edges.flatMap((edge) =>
    isBlocked(bridges, edge)
      ? network.crossingEdges[edge]!.filter(
          (crossing) => bridges[crossing]! > 0,
        )
      : [],
  );
  return {
    islands: [island, ...edges.map((edge) => getOtherIsland(edge, island))],
    edges: [...new Set([...edges, ...blockingEdges])],
  };
}

function findTarget(
  step: BridgesTutorialStep,
  edge: number,
): BridgesTutorialTarget | undefined {
  return step.targets.find((target) => target.edge === edge);
}

function isStepDone(
  step: BridgesTutorialStep,
  bridges: readonly BridgeCount[],
): boolean {
  return step.targets.every(({ edge, count }) => bridges[edge]! >= count);
}

function listOverIslands(bridges: readonly BridgeCount[]): number[] {
  return listBridgesIslandStatuses(board, { bridges }).flatMap(
    (status, island) => (status === "over" ? [island] : []),
  );
}

function startBridgesTutorial(): BridgesTutorialBoardState {
  return { bridges: emptyBridges, moveCount: 0, lastMove: null };
}

function getBridgesTutorialGoal(): BridgesTutorialBoardState {
  return { bridges: solvedBridges, moveCount: 0, lastMove: null };
}

/**
 * 交わる橋に阻まれた手は、本番と同じく盤面を変えずに阻まれたことを残し、交差のルールを伝えた後はルールに合わない手とする。
 * 手を引いている間は、手順の辺を手順の本数まで架ける手だけを受け付け、それ以外は盤面を変えない。
 * 手順の辺は解と同じ本数を超えないので、手を引いている間に数字より多い島はできない。
 * 手を離した後は、本番と同じく回し、数字より多い島ができた手をルールに合わない手とする。
 */
function performBridgesTutorialAction(
  { step, earnedRuleIds }: BridgesTutorialSituation,
  state: BridgesTutorialBoardState,
  { edge }: BridgesTutorialAction,
): { state: BridgesTutorialBoardState; outcome: TutorialMoveOutcome } {
  const current = state.bridges[edge];
  if (current === undefined) {
    return { state, outcome: "ignored" };
  }
  const change = cycleBridgesEdge(board, { bridges: state.bridges }, edge);
  if (change.kind === "blocked") {
    return {
      state: {
        ...state,
        moveCount: state.moveCount + 1,
        lastMove: {
          kind: "blocked",
          edge,
          crossingEdges: change.crossingEdges,
        },
      },
      // まだ伝えていない交差のルールは、違反として言わない。盤面の反応だけ本番と同じに見せる。
      outcome: earnedRuleIds.includes("cross") ? "violated" : "continued",
    };
  }
  const target = step === null ? undefined : findTarget(step, edge);
  if (step !== null && (target === undefined || current >= target.count)) {
    return { state, outcome: "ignored" };
  }

  const { bridges } = change.state;
  const fitsStep = target !== undefined && bridges[edge] === target.count;
  const next: BridgesTutorialBoardState = {
    bridges,
    moveCount: state.moveCount + 1,
    lastMove: { kind: "changed", edge, previous: current, fitsStep },
  };
  if (isBridgesSolved(board, { bridges })) {
    return { state: next, outcome: "solved" };
  }
  if (listOverIslands(bridges).length > 0) {
    return { state: next, outcome: "violated" };
  }
  return {
    state: next,
    outcome:
      step !== null && isStepDone(step, bridges) ? "stepped" : "continued",
  };
}

/**
 * 数字より多くなった島を直すために押す辺と、押す回数で戻る本数。
 * 直前の手で多くなったなら、その手の前の本数へ戻す。そうでなければ、多い島から出る、解より多く架けた辺を、解の本数へ戻す。
 */
export type BridgesTutorialFix = {
  edge: number;
  count: BridgeCount;
  tapCount: number;
};

function getTapCount(from: BridgeCount, to: BridgeCount): number {
  return (
    (to - from + BRIDGES_MAXIMUM_BRIDGE_COUNT + 1) %
    (BRIDGES_MAXIMUM_BRIDGE_COUNT + 1)
  );
}

/** 数字より多い島があるときの、直す辺。無ければ `null`。画面はこの辺に印を付ける。 */
export function findBridgesTutorialFix({
  bridges,
  lastMove,
}: BridgesTutorialBoardState): BridgesTutorialFix | null {
  const overIslands = listOverIslands(bridges);
  if (overIslands.length === 0) {
    return null;
  }
  if (lastMove?.kind === "changed") {
    const { from, to } = network.edges[lastMove.edge]!;
    if (overIslands.includes(from) || overIslands.includes(to)) {
      // 解より多く架けた辺は、手の前の本数ではなく、解の本数まで外す。
      const count = Math.min(
        lastMove.previous,
        solvedBridges[lastMove.edge]!,
      ) as BridgeCount;
      return {
        edge: lastMove.edge,
        count,
        tapCount: getTapCount(bridges[lastMove.edge]!, count),
      };
    }
  }
  const mistakenEdge = overIslands
    .flatMap((island) => network.islandEdges[island]!)
    .find((edge) => bridges[edge]! > solvedBridges[edge]!);
  if (mistakenEdge === undefined) {
    return null;
  }
  return {
    edge: mistakenEdge,
    count: solvedBridges[mistakenEdge]!,
    tapCount: getTapCount(bridges[mistakenEdge]!, solvedBridges[mistakenEdge]!),
  };
}

function describeFix({ count, tapCount }: BridgesTutorialFix): string {
  const result = count === 0 ? "外れます" : `${count}本に戻ります`;
  return tapCount === 1
    ? `あと1回タップで${result}`
    : `あと${tapCount}回タップで${result}`;
}

/** 直前の手が当たったルールを言う。阻まれた手は交差、それ以外は数字より多い島。 */
function describeBridgesTutorialViolation(
  { step }: BridgesTutorialSituation,
  state: BridgesTutorialBoardState,
): TutorialMessage {
  const { bridges, lastMove } = state;
  if (lastMove?.kind === "blocked") {
    return {
      headline: "ここに架けるとほかの橋と交差します",
      detail: step?.blockedDetail ?? null,
    };
  }
  const overIslands = listOverIslands(bridges);
  const touched =
    lastMove === null
      ? []
      : [network.edges[lastMove.edge]!.from, network.edges[lastMove.edge]!.to];
  const island =
    overIslands.find((candidate) => touched.includes(candidate)) ??
    overIslands[0];
  const fix = findBridgesTutorialFix(state);
  return {
    headline:
      island === undefined
        ? "橋が数字より\n多く出ています"
        : `${board.islands[island]!.clue}の島から橋が\n数字より多く出ています`,
    detail: fix === null ? null : describeFix(fix),
  };
}

export function getBridgesTutorialIslandStatuses({
  bridges,
}: BridgesTutorialBoardState): BridgesIslandStatus[] {
  return listBridgesIslandStatuses(board, { bridges });
}

/** 手順の一言。手順の辺を1本にして、まだ2本に届いていない間は、その手順が途中の一言を持っていれば替える。 */
export function describeBridgesTutorialStep(
  step: BridgesTutorialStep,
  { bridges }: BridgesTutorialBoardState,
): TutorialMessage {
  const midway = step.targets.some(
    ({ edge, count }) => bridges[edge]! > 0 && bridges[edge]! < count,
  );
  return midway ? (step.midwayMessage ?? step.message) : step.message;
}

/** 手順で印と指を付ける辺のうち、まだ手順の本数に届いていないもの。印を付けない手順と、手を離した後は空。 */
export function getBridgesTutorialStepEdges(
  { step }: BridgesTutorialSituation,
  { bridges }: BridgesTutorialBoardState,
): readonly number[] {
  if (step === null || !step.pointed) {
    return [];
  }
  return step.targets.flatMap(({ edge, count }) =>
    bridges[edge]! < count ? [edge] : [],
  );
}

/**
 * 手順の手を決めるもの（決め手）。手を決めさせる島と、その行き先の島、出る辺と、その辺を阻む架かった橋。
 * 手順の辺を架け終えた後も、同じ決め手を返す。操作を教える手順と、手を離した後は `null`。
 */
export function getBridgesTutorialStepReason(
  { step }: BridgesTutorialSituation,
  { bridges }: BridgesTutorialBoardState,
): BridgesTutorialReason | null {
  if (step?.island == null) {
    return null;
  }
  // 手順の辺を空けた盤面で求め、架けた後も、架ける前と同じ島と橋を見せ続ける。
  const cleared = step.targets.reduce<readonly BridgeCount[]>(
    (current, { edge }) => current.with(edge, 0),
    bridges,
  );
  return getIslandReason(cleared, step.island);
}

/**
 * 手を離した後、求められたときに示す手がかり。
 * - `edge`: 示す辺。
 * - `read`: その辺を決める読み。解と違う橋を示すときは `mistake`。
 * - `island`: その辺を決める島。解と違う橋を示すときは `null`。
 * - `reason`: 決め手。解と違う橋を示すときは `null`。
 * - `count`: その辺に架かると決まる本数。解と違う橋を示すときは、外して戻す解の本数。
 * - `tapCount`: `count` 本にするまでに押す回数。
 */
export type BridgesTutorialHint = {
  edge: number;
  read: BridgesTutorialRead | "mistake";
  island: number | null;
  reason: BridgesTutorialReason | null;
  count: BridgeCount;
  tapCount: number;
};

/**
 * 手を離した後に求められたとき示す手がかり。無ければ `null`。
 * 解より多く架けた橋があれば、行き止まりへ導かないよう、その橋を外す手がかりを先に示す。
 * 無ければ、今の盤面と手に入れたルールだけで橋が要ると決まる辺を、行き先が1つしかない島から先に示す。
 */
export function findBridgesTutorialHint(
  { earnedRuleIds }: BridgesTutorialSituation,
  { bridges }: BridgesTutorialBoardState,
): BridgesTutorialHint | null {
  // 解は1つなので、解より多く架けた橋が1本でもあれば、ルールで決まる手を続けても解けない。先にその橋を示す。
  const mistakenEdge = bridges.findIndex(
    (current, edge) => current > solvedBridges[edge]!,
  );
  if (mistakenEdge >= 0) {
    return {
      edge: mistakenEdge,
      read: "mistake",
      island: null,
      reason: null,
      count: solvedBridges[mistakenEdge]!,
      tapCount: getTapCount(
        bridges[mistakenEdge]!,
        solvedBridges[mistakenEdge]!,
      ),
    };
  }
  const deductions = listDeductions(bridges, earnedRuleIds);
  const deduction =
    deductions.find(({ read }) => read === "single") ?? deductions[0];
  return deduction
    ? {
        edge: deduction.edge,
        read: deduction.read,
        island: deduction.island,
        reason: getIslandReason(bridges, deduction.island),
        count: deduction.minimum as BridgeCount,
        tapCount: getTapCount(
          bridges[deduction.edge]!,
          deduction.minimum as BridgeCount,
        ),
      }
    : null;
}

/** 手がかりに添える一言。どの読みで決まるかを、決め手の島の数字で言う。 */
export function describeBridgesTutorialHint({
  read,
  island,
  count,
  tapCount,
}: BridgesTutorialHint): TutorialMessage {
  const clue = island === null ? null : board.islands[island]!.clue;
  switch (read) {
    case "single":
      return {
        headline: `${clue}の島から橋を架けられるのはもうここだけです`,
        detail: `ここに${count}本架けます`,
      };
    case "shortfall":
      return {
        headline: `${clue}の島はほかの島へ架けるだけでは本数が足りません`,
        detail: `ここに${count}本は架けます`,
      };
    case "mistake":
      return {
        headline: "この橋を外すと\n続きが解けます",
        detail: describeFix({ edge: -1, count, tapCount }),
      };
  }
}

/**
 * 手を引いている間に、手順に無い辺を押したときの一言。
 * 手順で2本まで架け終えた辺をもう一度押したときは、2本までのルールで返す。それ以外は、今の手順で何をするかを言う。
 */
export function describeBridgesTutorialOffStep(
  step: BridgesTutorialStep,
  { bridges }: BridgesTutorialBoardState,
  edge: number | null,
): TutorialMessage {
  const target = edge === null ? undefined : findTarget(step, edge);
  if (
    target !== undefined &&
    bridges[target.edge]! >= BRIDGES_MAXIMUM_BRIDGE_COUNT
  ) {
    return {
      headline: "島と島の間には\n橋を2本まで架けられます",
      detail: step.offStepMessage.detail,
    };
  }
  return step.offStepMessage;
}

/** 解の橋の本数の合計。入口から完成までの段の数にする。 */
export const BRIDGES_TUTORIAL_PROGRESS_STEP_COUNT =
  solvedBridges.reduce<number>((total, count) => total + count, 0);

/** 入口から完成までの進み具合（0〜1）。解と同じ所に架けた橋の割合。解より多く架けた分では進めない。 */
export function getBridgesTutorialProgressRatio({
  bridges,
}: BridgesTutorialBoardState): number {
  const fitted = bridges.reduce<number>(
    (total, count, edge) => total + Math.min(count, solvedBridges[edge]!),
    0,
  );
  return fitted / BRIDGES_TUTORIAL_PROGRESS_STEP_COUNT;
}

export const BRIDGES_TUTORIAL_BOARD = board;

export const bridgesTutorial: Tutorial<
  BridgesTutorialRuleId,
  BridgesTutorialStep,
  BridgesTutorialBoardState,
  BridgesTutorialAction
> = {
  intro: {
    purpose: "島と島の間に橋を架けて全部の島を1つにつなぐパズルです",
    goalCaption: "島の数字の数だけ\n橋を架けます",
  },
  rules: [
    { id: "count", label: "島からは数字と同じ本数の橋が出ます" },
    { id: "double", label: "島と島の間には橋を2本まで架けられます" },
    { id: "cross", label: "橋どうしが交差しないように架けます" },
  ],
  steps,
  freePlay: {
    headline: "残りの橋も\n架けてみましょう",
    detail: null,
  },
  completion: {
    home: {
      headline: "完成です",
      detail: "本番はもっと大きな盤面です",
    },
    play: {
      headline: "完成です",
      detail: "プレイ中の盤面と同じルールです",
    },
  },
  start: startBridgesTutorial,
  goal: getBridgesTutorialGoal,
  perform: performBridgesTutorialAction,
  describeViolation: describeBridgesTutorialViolation,
};

export const _private = {
  board,
  solvedBridges,
  steps,
  edgeBetween,
  islandAt,
  listDeductions,
};
