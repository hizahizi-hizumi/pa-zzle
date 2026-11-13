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
  listBridgesIslandGroups,
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

export type BridgesTutorialRuleId = "double" | "count" | "cross" | "connect";

/** 本番と同じく、島の間を押すか島からなぞって、辺の橋を 1本 → 2本 → なし と回す。 */
export type BridgesTutorialAction = { type: "cycle"; edge: number };

export type BridgesTutorialStep = TutorialStep<BridgesTutorialRuleId> & {
  /** 印を付け、手順の間だけ操作を受け付ける辺。 */
  edge: number;
  /** この手順で `edge` に架ける本数。ここまで架けたら次の手順へ進む。 */
  bridgeCount: BridgeCount;
  /**
   * `edge` の本数を、数字から決めさせる島。伝えたルールで、この島から見て `edge` が `bridgeCount` 本に決まる。
   * 操作を教える手順では `null`。
   */
  island: number | null;
  /**
   * この手順で受け付ける架け方。`between` は島の間を押す（島を選んでから相手の島を押す、なぞるも受ける）。
   * `fromIsland` は島から架ける操作（なぞる、島を選んでから相手の島を押す）だけを受け、島の間を押しても架けない。
   */
  gesture: "between" | "fromIsland";
  /**
   * `edge` より先に印を付けて押させ、交わる橋に阻まれる盤面の反応を見せる辺。阻まれるのを見せたら、
   * 印を `edge` へ移す。見せない手順では `null`。
   */
  blockedEdge: number | null;
};

/** 決め手。手を決めるときに見る島と橋。 */
export type BridgesTutorialReason = {
  /** 数字を見る島。 */
  islands: readonly number[];
  /** 架かっている橋のうち、手を決めるもの（2本で上限の橋、交わる橋）。 */
  edges: readonly number[];
};

/** 直前の手。盤面の反応と合図に使う。 */
export type BridgesTutorialMove =
  /**
   * `fitsStep` は、手を引いている手順の辺を、手順の本数まで架けたか。
   * `removing` は、手がかりで外させている解と違う橋を、1本 → 2本 → なし と回して外す途中の2本にしたか。
   */
  | { kind: "changed"; edge: number; fitsStep: boolean; removing: boolean }
  | { kind: "blocked"; edge: number; crossingEdges: readonly number[] };

export type BridgesTutorialBoardState = {
  bridges: readonly BridgeCount[];
  /** 同じ辺への合図をやり直す目印に使う。 */
  moveCount: number;
  lastMove: BridgesTutorialMove | null;
  /** 手順で押させて、交わる橋に阻まれるのを見せ終えた辺。 */
  shownBlockedEdges: readonly number[];
};

export type BridgesTutorialSituation = TutorialSituation<
  BridgesTutorialRuleId,
  BridgesTutorialStep
>;

/**
 * 5×5 の盤面に島が8つ。ルールの下で、解はこの1つに決まる。
 *
 * ```text
 * 盤面      解
 * 2.4.2    2---4---2
 * .....    |   H   |
 * 1...3    1   H   3
 * ..2..        2   H
 * 1...3    1-------3
 * ```
 */
const board: BridgesBoard = parseBridgesBoard([
  "2.4.2",
  ".....",
  "1...3",
  "..2..",
  "1...3",
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

const topEdge = edgeBetween([1, 1], [1, 3]);
const leftTopEdge = edgeBetween([1, 1], [3, 1]);
const topRightEdge = edgeBetween([1, 3], [1, 5]);
const centerEdge = edgeBetween([1, 3], [4, 3]);
const rightTopEdge = edgeBetween([1, 5], [3, 5]);
const rightBottomEdge = edgeBetween([3, 5], [5, 5]);
const middleRowEdge = edgeBetween([3, 1], [3, 5]);
const bottomEdge = edgeBetween([5, 1], [5, 5]);

const emptyBridges: readonly BridgeCount[] = network.edges.map(() => 0);

const solvedBridgeCounts = new Map<number, BridgeCount>([
  [topEdge, 1],
  [leftTopEdge, 1],
  [topRightEdge, 1],
  [centerEdge, 2],
  [rightTopEdge, 1],
  [rightBottomEdge, 2],
  [bottomEdge, 1],
]);

const solvedBridges: readonly BridgeCount[] = network.edges.map(
  (_, edge) => solvedBridgeCounts.get(edge) ?? 0,
);

/**
 * 真ん中の縦の辺で、押して1本、もう一度押して2本と架け、ルールを1つずつ使って1本ずつ決めていく。
 * - 操作: 上の4と真ん中の2の間に1本、続けて2本目を架ける。真ん中の2は行き先が上の4だけなので、ゴールと同じ2本。
 * - 2本まで: もう一度押した2本目で、同じ2島の間は2本までと伝える。この上限は、交差の手順で右の3の下の橋を2本で止める決め手になる。
 * - 数字と同じ本数: 右下の3から、左の1へは1本しか出せないので、上の3へ2本架ける。
 * - 交差しない: 先に右の3から左の1へ架けさせ、真ん中の縦の2本に阻まれる盤面の反応（板が突き当たって弾かれ、阻んだ橋が
 *   赤く揺れる）を見せる。右の3は、あと1本要る。下は2本で上限、左は真ん中の縦の2本と交わるので、上の2へ架ける。
 * - 全部つなげる: 左の真ん中の1は、右へは交わって架けられず、下の1とつなぐと2島だけで閉じるので、上の2へ架ける。
 * - 操作: 左上の2から上の4へなぞって架ける。本番の、島から架ける操作（なぞる、島を選んでから相手の島を押す）を体験させる。
 *   左上の2は下へ1本架かり、あと1本は右の4へしか出せないので、ゴールと同じ1本。
 * 手順を終えると2本が残り、数字と同じ本数だけで1本ずつ決まる。
 */
const steps: readonly BridgesTutorialStep[] = [
  {
    message: { headline: "島と島の間を押すと\n橋が架かります", detail: null },
    introducedRuleId: null,
    edge: centerEdge,
    bridgeCount: 1,
    island: null,
    gesture: "between",
    blockedEdge: null,
  },
  {
    message: {
      headline: "もう一度押すと\n2本になります",
      detail: "2本までです。もう一度押すと外れます",
    },
    introducedRuleId: "double",
    edge: centerEdge,
    bridgeCount: 2,
    island: null,
    gesture: "between",
    blockedEdge: null,
  },
  {
    message: {
      headline: "島から出す橋は\n数字と同じ本数にします",
      detail: "右下の3は、左の1へは1本までです",
    },
    introducedRuleId: "count",
    edge: rightBottomEdge,
    bridgeCount: 2,
    island: islandAt(5, 5),
    gesture: "between",
    blockedEdge: null,
  },
  {
    message: { headline: "橋どうしは\n交差できません", detail: null },
    introducedRuleId: "cross",
    edge: rightTopEdge,
    bridgeCount: 1,
    island: islandAt(3, 5),
    gesture: "between",
    blockedEdge: middleRowEdge,
  },
  {
    message: {
      headline: "全部の島を\n1つにつなげます",
      detail: "左の1を左下の1とつなぐと2島で閉じます",
    },
    introducedRuleId: "connect",
    edge: leftTopEdge,
    bridgeCount: 1,
    island: islandAt(3, 1),
    gesture: "between",
    blockedEdge: null,
  },
  {
    message: {
      headline: "島から相手の島へ\nなぞっても架かります",
      detail: "島を押し、相手の島を押しても架かります",
    },
    introducedRuleId: null,
    edge: topEdge,
    bridgeCount: 1,
    island: null,
    gesture: "fromIsland",
    blockedEdge: null,
  },
];

const noReason: BridgesTutorialReason = { islands: [], edges: [] };

function getOtherIsland(edge: number, island: number): number {
  const { from, to } = network.edges[edge]!;
  return from === island ? to : from;
}

/** 橋でたどれる島の組のうち、どの島も数字とちょうどで、全部の島ではないもの。ほかの島へ橋を架けられないまま閉じている。 */
function findClosedGroups(bridges: readonly BridgeCount[]): number[][] {
  const statuses = listBridgesIslandStatuses(board, { bridges });
  return listBridgesIslandGroups(board, { bridges }).filter(
    (group) =>
      group.length < board.islands.length &&
      group.every((island) => statuses[island] === "exact"),
  );
}

/** 辺に架けられる残りの本数と、それを限った決め手。 */
type BridgesRoom = { room: number; reason: BridgesTutorialReason };

/**
 * 島 `island` から見て、辺 `edge` にあと何本架けられるか。手に入れたルールで盤面から分かる分だけ限る。
 * 最も強く限ったものを決め手に添える。同じだけ限るものが複数あれば、2本で上限の橋、行き先の島の数字、交わる橋の順に選ぶ。
 * 交わる橋で限ったときは、架けられない辺も決め手に添え、どこで交わるかを見せる。限った後に、閉じてしまう島の組でさらに限り、
 * 閉じる組の島と、架けると閉じる辺を決め手に添えて、閉じる所を見せる。
 */
function findRoom(
  bridges: readonly BridgeCount[],
  ruleIds: readonly BridgesTutorialRuleId[],
  island: number,
  edge: number,
): BridgesRoom {
  const current = bridges[edge]!;
  const counts = countBridgesIslandBridges(board, { bridges });
  const other = getOtherIsland(edge, island);
  const own = Math.max(0, board.islands[island]!.clue - counts[island]!);
  const crossing = network.crossingEdges[edge]!.filter(
    (crossingEdge) => bridges[crossingEdge] !== 0,
  );
  const limits: BridgesRoom[] = [
    { room: own, reason: noReason },
    ...(ruleIds.includes("double")
      ? [
          {
            room: BRIDGES_MAXIMUM_BRIDGE_COUNT - current,
            reason: { islands: [], edges: current > 0 ? [edge] : [] },
          },
        ]
      : []),
    {
      room: Math.max(0, board.islands[other]!.clue - counts[other]!),
      reason: { islands: [other], edges: [] },
    },
    ...(ruleIds.includes("cross") && current === 0 && crossing.length > 0
      ? [{ room: 0, reason: { islands: [], edges: [edge, ...crossing] } }]
      : []),
  ];
  const limit = limits.reduce((tightest, candidate) =>
    candidate.room < tightest.room ? candidate : tightest,
  );
  if (!ruleIds.includes("connect")) {
    return limit;
  }
  for (let added = 1; added <= limit.room; added += 1) {
    const next = bridges.with(edge, (current + added) as BridgeCount);
    const closed = findClosedGroups(next).find((group) =>
      group.includes(island),
    );
    if (closed) {
      return {
        room: added - 1,
        reason: {
          islands: closed.filter((member) => member !== island),
          edges: [edge],
        },
      };
    }
  }
  return limit;
}

/** 辺に架かる橋の本数が、今の盤面と手に入れたルールだけで少なくとも何本と決まるか。 */
type BridgesDeduction = { minimum: number; reason: BridgesTutorialReason };

function mergeReasons(
  reasons: readonly BridgesTutorialReason[],
): BridgesTutorialReason {
  return {
    islands: [...new Set(reasons.flatMap(({ islands }) => islands))],
    edges: [...new Set(reasons.flatMap(({ edges }) => edges))],
  };
}

/**
 * 島 `island` の数字の残りから、ほかの辺に架けられる分を引いて足りない分を、辺 `edge` に要る本数とみなす。
 * 数字と同じ本数のルールを手に入れるまでは、何も決まらない。決まらなければ `null`。
 */
function deduceEdgeFromIsland(
  bridges: readonly BridgeCount[],
  ruleIds: readonly BridgesTutorialRuleId[],
  island: number,
  edge: number,
): BridgesDeduction | null {
  if (!ruleIds.includes("count")) {
    return null;
  }
  const current = bridges[edge]!;
  const counts = countBridgesIslandBridges(board, { bridges });
  const need = board.islands[island]!.clue - counts[island]!;
  const rooms = network.islandEdges[island]!.flatMap((otherEdge) =>
    otherEdge === edge ? [] : [findRoom(bridges, ruleIds, island, otherEdge)],
  );
  const shortage = need - rooms.reduce((total, { room }) => total + room, 0);
  const added = Math.min(
    shortage,
    findRoom(bridges, ruleIds, island, edge).room,
  );
  if (added <= 0) {
    return null;
  }
  return {
    minimum: current + added,
    reason: mergeReasons([
      { islands: [island], edges: [] },
      ...rooms.map(({ reason }) => reason),
    ]),
  };
}

/** 辺の両端の島のうち、より多くの本数が決まる方から見た、辺に要る本数。決まらなければ `null`。 */
function deduceEdge(
  bridges: readonly BridgeCount[],
  ruleIds: readonly BridgesTutorialRuleId[],
  edge: number,
): BridgesDeduction | null {
  const { from, to } = network.edges[edge]!;
  return [from, to].reduce<BridgesDeduction | null>((best, island) => {
    const deduction = deduceEdgeFromIsland(bridges, ruleIds, island, edge);
    return deduction && deduction.minimum > (best?.minimum ?? 0)
      ? deduction
      : best;
  }, null);
}

/** 手に入れたルールに合わないところ。 */
type BridgesVisibleViolations = {
  overIslands: readonly number[];
  closedGroups: readonly (readonly number[])[];
};

function findVisibleViolations(
  bridges: readonly BridgeCount[],
  ruleIds: readonly BridgesTutorialRuleId[],
): BridgesVisibleViolations {
  const statuses = listBridgesIslandStatuses(board, { bridges });
  return {
    overIslands: ruleIds.includes("count")
      ? statuses.flatMap((status, island) =>
          status === "over" ? [island] : [],
        )
      : [],
    closedGroups: ruleIds.includes("connect") ? findClosedGroups(bridges) : [],
  };
}

function hasVisibleViolation({
  overIslands,
  closedGroups,
}: BridgesVisibleViolations): boolean {
  return overIslands.length > 0 || closedGroups.length > 0;
}

function hasShownBlockedEdge(
  step: BridgesTutorialStep,
  { shownBlockedEdges }: BridgesTutorialBoardState,
): boolean {
  return (
    step.blockedEdge === null || shownBlockedEdges.includes(step.blockedEdge)
  );
}

function startBridgesTutorial(): BridgesTutorialBoardState {
  return {
    bridges: emptyBridges,
    moveCount: 0,
    lastMove: null,
    shownBlockedEdges: [],
  };
}

function getBridgesTutorialGoal(): BridgesTutorialBoardState {
  return {
    bridges: solvedBridges,
    moveCount: 0,
    lastMove: null,
    shownBlockedEdges: [],
  };
}

/**
 * 手を引いている間は、手順の辺を手順の本数まで架ける手だけを受け付ける。架けるほど本数が手順の本数へ近づくので、通り過ぎない。
 * 交わる橋に阻まれた手は、本番と同じく盤面を変えずに阻まれたことを残す。手を引いている間は、手順の一言を保つため
 * ルールに合わない手とはせず、手を離した後はルールに合わない手とする。
 * 手を離した後は、本番と同じく回し、数字より多い島・閉じた島の組ができた手もルールに合わない手とする。
 * ただし、手がかりで外させている橋を外す途中の2本は、手がかりに従った手なので、ルールに合わない手とはしない。
 * 島の色は本番と同じく多すぎになる。
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
        shownBlockedEdges:
          step?.blockedEdge === edge
            ? [...state.shownBlockedEdges, edge]
            : state.shownBlockedEdges,
      },
      outcome: step === null ? "violated" : "continued",
    };
  }
  if (
    step !== null &&
    (step.edge !== edge ||
      current >= step.bridgeCount ||
      !hasShownBlockedEdge(step, state))
  ) {
    return { state, outcome: "ignored" };
  }

  const { bridges } = change.state;
  const fitsStep = step !== null && bridges[edge] === step.bridgeCount;
  const removing =
    step === null &&
    isRemovalHint({ step, earnedRuleIds }, state, edge) &&
    bridges[edge]! > solvedBridges[edge]!;
  const next: BridgesTutorialBoardState = {
    ...state,
    bridges,
    moveCount: state.moveCount + 1,
    lastMove: { kind: "changed", edge, fitsStep, removing },
  };
  if (isBridgesSolved(board, { bridges })) {
    return { state: next, outcome: "solved" };
  }
  if (
    !removing &&
    hasVisibleViolation(findVisibleViolations(bridges, earnedRuleIds))
  ) {
    return { state: next, outcome: "violated" };
  }
  return { state: next, outcome: fitsStep ? "stepped" : "continued" };
}

const crossingViolation: TutorialMessage = {
  headline: "ほかの橋と交差するので\n架けられません",
  detail: null,
};

const overViolation: TutorialMessage = {
  headline: "橋が数字より\n多く出ています",
  detail: null,
};

const closedViolation: TutorialMessage = {
  headline: "ほかとつながらない島が\nできています",
  detail: null,
};

/** 直前の手が当たったルールを先に言う。古い違反が残っていても、今の手の結果を返すため。 */
function describeBridgesTutorialViolation(
  { earnedRuleIds }: BridgesTutorialSituation,
  { bridges, lastMove }: BridgesTutorialBoardState,
): TutorialMessage {
  if (lastMove?.kind === "blocked") {
    return crossingViolation;
  }
  const { overIslands, closedGroups } = findVisibleViolations(
    bridges,
    earnedRuleIds,
  );
  const touched =
    lastMove === null
      ? []
      : [network.edges[lastMove.edge]!.from, network.edges[lastMove.edge]!.to];
  const touchesOver = overIslands.some((island) => touched.includes(island));
  const touchesClosed = closedGroups.some((group) =>
    group.some((island) => touched.includes(island)),
  );
  if (touchesOver || (!touchesClosed && overIslands.length > 0)) {
    return overViolation;
  }
  return closedViolation;
}

function isRemovalHint(
  situation: BridgesTutorialSituation,
  state: BridgesTutorialBoardState,
  edge: number,
): boolean {
  return (
    findBridgesTutorialHintEdge(situation, state) === edge &&
    state.bridges[edge]! > solvedBridges[edge]!
  );
}

/**
 * 盤面に、手に入れたルールに合わないところ（数字より多い島、閉じた島の組）があるか。阻まれた手は盤面を変えないので含まない。
 * 手がかりで外させている橋を外す途中の盤面も、手がかりに従っている途中なので含まない。
 */
export function hasBridgesTutorialBoardViolation(
  { earnedRuleIds }: BridgesTutorialSituation,
  { bridges, lastMove }: BridgesTutorialBoardState,
): boolean {
  if (lastMove?.kind === "changed" && lastMove.removing) {
    return false;
  }
  return hasVisibleViolation(findVisibleViolations(bridges, earnedRuleIds));
}

export function getBridgesTutorialIslandStatuses({
  bridges,
}: BridgesTutorialBoardState): BridgesIslandStatus[] {
  return listBridgesIslandStatuses(board, { bridges });
}

/** 手順で印を付ける辺。 */
export function getBridgesTutorialStepEdge(
  { step }: BridgesTutorialSituation,
  state: BridgesTutorialBoardState,
): number | null {
  if (step === null) {
    return null;
  }
  if (!hasShownBlockedEdge(step, state)) {
    return step.blockedEdge;
  }
  return state.bridges[step.edge]! < step.bridgeCount ? step.edge : null;
}

/** 手順の辺の本数を決めるもの（決め手）。手順で伝えたルールまでで、手順の辺が手順の本数に決まる島と橋。 */
export function getBridgesTutorialStepReason(
  { step, earnedRuleIds }: BridgesTutorialSituation,
  state: BridgesTutorialBoardState,
): BridgesTutorialReason {
  if (
    step !== null &&
    step.blockedEdge !== null &&
    !hasShownBlockedEdge(step, state)
  ) {
    return {
      islands: [],
      edges: network.crossingEdges[step.blockedEdge]!.filter(
        (crossing) => state.bridges[crossing]! > 0,
      ),
    };
  }
  if (step?.island == null) {
    return noReason;
  }
  return (
    deduceEdgeFromIsland(state.bridges, earnedRuleIds, step.island, step.edge)
      ?.reason ?? noReason
  );
}

/**
 * 手を引いている間に、画面全体の覆いから抜いて元の明るさで見せる島と辺。
 * 次に押す辺とその両端の島、その本数を決める島と橋（決め手）に加えて、直前に手順どおりに架けた辺も抜き、その手への応えを見せる。
 */
export function getBridgesTutorialSpotlight(
  situation: BridgesTutorialSituation,
  state: BridgesTutorialBoardState,
): BridgesTutorialReason {
  const stepEdge = getBridgesTutorialStepEdge(situation, state);
  const { lastMove } = state;
  const shownEdges = [
    ...(stepEdge === null ? [] : [stepEdge]),
    ...(lastMove?.kind === "changed" && lastMove.fitsStep
      ? [lastMove.edge]
      : []),
  ];
  return mergeReasons([
    {
      islands: shownEdges.flatMap((edge) => [
        network.edges[edge]!.from,
        network.edges[edge]!.to,
      ]),
      edges: shownEdges,
    },
    getBridgesTutorialStepReason(situation, state),
  ]);
}

/**
 * 手を離した後、手が止まったときに示す辺。無ければ `null`。
 * 解と違う橋の辺を示した後、その橋を外す途中の2本にしたら、外し終えるまで同じ辺を示す。
 */
export function findBridgesTutorialHintEdge(
  { step, earnedRuleIds }: BridgesTutorialSituation,
  { bridges, lastMove }: BridgesTutorialBoardState,
): number | null {
  if (step !== null) {
    return null;
  }
  if (lastMove?.kind === "changed" && lastMove.removing) {
    return lastMove.edge;
  }
  const deducibleEdge = bridges.findIndex((current, edge) => {
    const deduction = deduceEdge(bridges, earnedRuleIds, edge);
    return (
      deduction !== null &&
      current < solvedBridges[edge]! &&
      deduction.minimum <= solvedBridges[edge]!
    );
  });
  if (deducibleEdge >= 0) {
    return deducibleEdge;
  }
  const mistakenEdge = bridges.findIndex(
    (current, edge) => current > solvedBridges[edge]!,
  );
  return mistakenEdge >= 0 ? mistakenEdge : null;
}

export const BRIDGES_TUTORIAL_BOARD = board;

export const bridgesTutorial: Tutorial<
  BridgesTutorialRuleId,
  BridgesTutorialStep,
  BridgesTutorialBoardState,
  BridgesTutorialAction
> = {
  intro: {
    purpose: "橋を架けて\n全部の島を1つにつなげるパズルです",
    goalCaption: "完成するとこうなります",
    startCaption: "まだ橋は1本もありません",
  },
  rules: [
    { id: "double", label: "2本まで" },
    { id: "count", label: "数字と同じ本数" },
    { id: "cross", label: "交差しない" },
    { id: "connect", label: "全部つなげる" },
  ],
  steps,
  freePlay: {
    headline: "残りの橋を架ければ\n完成です",
    detail: null,
  },
  completion: {
    home: {
      headline: "完成です",
      detail: "本番はもっと大きな盤面で遊べます",
    },
    play: {
      headline: "完成です",
      detail: "プレイ中の盤面も同じルールで解けます",
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
  edgeBetween,
  islandAt,
  deduceEdge,
  deduceEdgeFromIsland,
  findVisibleViolations,
};
