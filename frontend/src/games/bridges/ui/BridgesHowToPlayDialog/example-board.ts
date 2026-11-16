import type { BridgesEdgeNotice } from "@/games/bridges/play/use-bridges-play";
import { getBridgesNetwork } from "@/games/bridges/puzzle/board";
import {
  type BridgesIslandStatus,
  findBridgesClosedGroups,
  isBridgesSolved,
  listBridgesIslandStatuses,
} from "@/games/bridges/puzzle/rules";
import type { BridgeCount } from "@/games/bridges/puzzle/state";
import {
  type BridgesCycleDirection,
  cycleBridgesEdge,
} from "@/games/bridges/puzzle/transitions";
import type {
  BridgesHowToPlayExample,
  BridgesHowToPlayHint,
} from "@/games/bridges/ui/BridgesHowToPlayDialog/figure-boards";
import type { BridgesEdgeGesture } from "@/games/bridges/ui/board/BridgesBoard";

/**
 * 触れる例の今の姿。橋は本番のルールの遷移（`cycleBridgesEdge`）で回す。経過時間と回数は使わない。
 * - `edgeNotice`: 盤面の反応と効果音に渡す、橋を回した・阻まれた直前の手。本番と同じく、橋に触れない手では替えない。
 * - `selectedIsland`: 盤面が知らせた、島を選んでから相手の島を押す操作で選んでいる島。
 * - `hintStep`: 次に見せる手の番号（`hints` の位置）。
 * - `candidatesShown`: 直前の手が、線が交差する所を押して、どちらの橋も回さずに2本の線を示させた手か。
 */
export type BridgesExampleBoard = {
  definition: BridgesHowToPlayExample;
  bridges: readonly BridgeCount[];
  edgeNotice: BridgesEdgeNotice | null;
  selectedIsland: number | null;
  hintStep: number;
  candidatesShown: boolean;
};

/** 橋を回す手。`direction` は右クリックのときだけ `backward`。 */
export type BridgesExampleCycle = {
  edge: number;
  gesture: BridgesEdgeGesture;
  direction: BridgesCycleDirection;
};

/** 例が見せる手を、触る前の橋から順に打ったときの、各手を打つ前の橋と選んでいる島。 */
type HintSituation = {
  bridges: readonly BridgeCount[];
  selectedIsland: number | null;
};

function haveSameBridges(
  left: readonly BridgeCount[],
  right: readonly BridgeCount[],
): boolean {
  return left.every((count, edge) => count === right[edge]);
}

function listHintSituations(
  definition: BridgesHowToPlayExample,
): HintSituation[] {
  const situations: HintSituation[] = [];
  let bridges = definition.bridges;
  let selectedIsland: number | null = null;
  for (const hint of definition.hints) {
    situations.push({ bridges, selectedIsland });
    if (hint.kind === "select") {
      selectedIsland = hint.island;
      continue;
    }
    if (hint.kind === "crossing") {
      continue;
    }
    const change = cycleBridgesEdge(
      definition.board,
      { bridges },
      hint.edge,
      hint.kind === "backward" ? "backward" : "forward",
    );
    if (change.kind === "changed") {
      bridges = change.state.bridges;
    }
    selectedIsland = null;
  }
  return situations;
}

/**
 * 今の姿が、例が見せる手の `step` 番目を打つ前の姿か。`comparesSelection` が偽なら橋だけを比べる
 * （盤面は、選んだ島の相手を押して橋を回す前に選びを解いて知らせるので、橋を回す手は橋だけで比べる）。
 */
function isAtHint(
  example: BridgesExampleBoard,
  step: number,
  comparesSelection = true,
): boolean {
  const situation = listHintSituations(example.definition)[step];
  return (
    situation !== undefined &&
    haveSameBridges(example.bridges, situation.bridges) &&
    (!comparesSelection || example.selectedIsland === situation.selectedIsland)
  );
}

/**
 * 手がかりを付ける手の番号。選んだ島の相手を押す手を見せている間に選びが解けたら、その前の島を選ぶ手を見せ直す。
 */
function findShownHintStep(example: BridgesExampleBoard): number {
  const { hints } = example.definition;
  const { hintStep } = example;
  if (
    hints[hintStep]?.kind === "pair" &&
    hints[hintStep - 1]?.kind === "select" &&
    !isAtHint(example, hintStep)
  ) {
    return hintStep - 1;
  }
  return hintStep;
}

/** 手が、例の見せる手 `hint` を、文の言う押し方で打ったか。 */
function matchesHint(
  hint: BridgesHowToPlayHint,
  { edge, gesture, direction }: BridgesExampleCycle,
  blocked: boolean,
): boolean {
  switch (hint.kind) {
    case "edge":
      // 本番で阻まれる手は、どう押しても同じに阻まれるので、押し方を問わない。
      return (
        hint.edge === edge &&
        direction === "forward" &&
        (blocked || gesture === "edge")
      );
    case "drag":
      return hint.edge === edge && gesture === "drag";
    case "pair":
      return hint.edge === edge && gesture === "islands";
    case "backward":
      return hint.edge === edge && direction === "backward";
    case "select":
    case "crossing":
      return false;
  }
}

/**
 * 手を打った後の、次に見せる手。例が見せる手を打ったら次の手へ進める。
 * 見せる手が残っていないまま橋が触る前に戻ったら、最初の手から見せ直す。
 */
function advanceHint(
  example: BridgesExampleBoard,
  next: BridgesExampleBoard,
  matched: boolean,
): number {
  const step =
    matched && isAtHint(example, example.hintStep, false)
      ? example.hintStep + 1
      : example.hintStep;
  const backToStart =
    haveSameBridges(next.bridges, example.definition.bridges) &&
    next.selectedIsland === null;
  return backToStart && (!matched || step >= example.definition.hints.length)
    ? 0
    : step;
}

export function createBridgesExampleBoard(
  definition: BridgesHowToPlayExample,
): BridgesExampleBoard {
  return {
    definition,
    bridges: definition.bridges,
    edgeNotice: null,
    selectedIsland: null,
    hintStep: 0,
    candidatesShown: false,
  };
}

/** 盤面から届いた、橋を回す手。本番のルールの遷移で回し、交わる橋があれば阻まれた手にする。 */
export function cycleBridgesExampleEdge(
  example: BridgesExampleBoard,
  cycle: BridgesExampleCycle,
): BridgesExampleBoard {
  const { board } = example.definition;
  const change = cycleBridgesEdge(
    board,
    { bridges: example.bridges },
    cycle.edge,
    cycle.direction,
  );
  const id = (example.edgeNotice?.id ?? 0) + 1;
  const next: BridgesExampleBoard =
    change.kind === "blocked"
      ? {
          ...example,
          selectedIsland: null,
          candidatesShown: false,
          edgeNotice: {
            id,
            change: "blocked",
            edge: cycle.edge,
            crossingEdges: change.crossingEdges,
          },
        }
      : {
          ...example,
          bridges: change.state.bridges,
          selectedIsland: null,
          candidatesShown: false,
          edgeNotice: {
            id,
            change: "changed",
            edge: cycle.edge,
            count: change.state.bridges[cycle.edge]!,
          },
        };
  const hint = example.definition.hints[example.hintStep];
  const matched =
    hint !== undefined && matchesHint(hint, cycle, change.kind === "blocked");
  return { ...next, hintStep: advanceHint(example, next, matched) };
}

/**
 * 盤面が知らせた、選んでいる島の変化。例が見せる手が島を選ぶ手で、その島を選んだら次の手へ進める。
 * 線が交差する所を押して示した2本の線は、盤面が選びを置き直すと消えるので、示したことも下げる。
 */
export function selectBridgesExampleIsland(
  example: BridgesExampleBoard,
  island: number | null,
): BridgesExampleBoard {
  if (island === example.selectedIsland) {
    return example;
  }
  const step = findShownHintStep(example);
  const hint = example.definition.hints[step];
  const selected =
    hint?.kind === "select" &&
    hint.island === island &&
    isAtHint(example, step, false);
  return {
    ...example,
    selectedIsland: island,
    candidatesShown: false,
    hintStep: selected ? step + 1 : example.hintStep,
  };
}

/** 盤面が知らせた、橋も島の選びも変えなかった押し（線から遠い所など）。線が交差する所を押して示したことを下げる。 */
export function missBridgesExamplePress(
  example: BridgesExampleBoard,
): BridgesExampleBoard {
  return example.candidatesShown
    ? { ...example, candidatesShown: false }
    : example;
}

/** 盤面が知らせた、線が交差する所を押して2本の線を示した手。例が見せる手がその手なら、次の手へ進める。 */
export function showBridgesExampleCandidates(
  example: BridgesExampleBoard,
): BridgesExampleBoard {
  const shown = { ...example, candidatesShown: true };
  const hint = example.definition.hints[example.hintStep];
  if (hint?.kind !== "crossing" || !isAtHint(example, example.hintStep)) {
    return shown;
  }
  return { ...shown, hintStep: example.hintStep + 1 };
}

/**
 * 押す所の手がかりを付ける手。触る前の橋から例が見せる手を順に打っていく途中の姿でだけ返す。
 * 阻まれた直後は、橋を回すまで返さない。
 */
export function findBridgesExampleHint(
  example: BridgesExampleBoard,
): BridgesHowToPlayHint | null {
  if (example.edgeNotice?.change === "blocked") {
    return null;
  }
  const step = findShownHintStep(example);
  const hint = example.definition.hints[step];
  return hint !== undefined && isAtHint(example, step) ? hint : null;
}

/** 橋が触る前と違うか。阻まれただけの手では橋が変わらないので、違うとしない。 */
export function isBridgesExampleChanged(example: BridgesExampleBoard): boolean {
  return !haveSameBridges(example.bridges, example.definition.bridges);
}

export function getBridgesExampleIslandStatuses(
  example: BridgesExampleBoard,
): BridgesIslandStatus[] {
  return listBridgesIslandStatuses(example.definition.board, {
    bridges: example.bridges,
  });
}

export function isBridgesExampleSolved(example: BridgesExampleBoard): boolean {
  return isBridgesSolved(example.definition.board, {
    bridges: example.bridges,
  });
}

/** 例の今の姿の判定。形のルールで、埋め切るまで決まらない姿は `incomplete`。 */
export type BridgesExampleVerdict = "allowed" | "disallowed" | "incomplete";

/** 数字と同じ本数のルールの判定。多すぎの島があればできない、どの島もちょうどならできる、ほかは途中。 */
export function judgeBridgesExampleCount(
  example: BridgesExampleBoard,
): BridgesExampleVerdict {
  const statuses = getBridgesExampleIslandStatuses(example);
  if (statuses.includes("over")) {
    return "disallowed";
  }
  return statuses.every((status) => status === "exact")
    ? "allowed"
    : "incomplete";
}

/**
 * 全部の島をつなげるルールの判定と、例が教えるルールとは別に破ったルール。
 * どの島もちょうどなのに全部の島ではない組（ほかへ架けると数字を超えて、もうつなげられない組）があればできない、
 * 完成していればできる、ほかは途中。多すぎの島があるときは、数字と同じ本数のルールを破ったものとしてできないにする。
 */
export function judgeBridgesExampleConnection(example: BridgesExampleBoard): {
  verdict: BridgesExampleVerdict;
  overIslands: boolean;
} {
  const { board } = example.definition;
  const state = { bridges: example.bridges };
  const overIslands = listBridgesIslandStatuses(board, state).includes("over");
  if (overIslands || findBridgesClosedGroups(board, state).length > 0) {
    return { verdict: "disallowed", overIslands };
  }
  return {
    verdict: isBridgesSolved(board, state) ? "allowed" : "incomplete",
    overIslands: false,
  };
}

/** 手ごとに架けられるかの印を付ける線と、その線が出る島。 */
export type BridgesExampleCandidate = {
  edge: number;
  island: number;
  allowed: boolean;
};

/**
 * 印を付ける島から出る、橋の無い線ごとに、本番のルールで今架けられるか。
 * 橋のある線は、押すと本数を変える（2本なら外す）手になるので、印を付けない。
 */
export function listBridgesExampleCandidates(
  example: BridgesExampleBoard,
): BridgesExampleCandidate[] {
  const { board, markedIsland } = example.definition;
  if (markedIsland === undefined) {
    return [];
  }
  return getBridgesNetwork(board)
    .islandEdges[markedIsland]!.filter((edge) => example.bridges[edge] === 0)
    .map((edge) => ({
      edge,
      island: markedIsland,
      allowed:
        cycleBridgesEdge(board, { bridges: example.bridges }, edge).kind ===
        "changed",
    }));
}

/**
 * 交差のルールの例の、図の下の言葉。今の盤面と直前の手から決める。
 * - `blocked`: 直前の手が、交差する橋に阻まれた。
 * - `ambiguous`: 直前の手が、線が交差する所を押して、どちらの橋も回さずに2本の線を示させた。島の選びを置き直すか、
 *   橋も選びも変えない押しをするまで言う。
 * - `legend`: 橋が触る前の姿にある。盤面の印の凡例を出す。
 * - `placed`: 直前の手で橋を架けた（1本・2本にした）。
 * - `removed`: 直前の手で2本の橋を押して外した。
 * `overIslands` は、例が教えるルールとは別に、多すぎの島があるか。
 */
export type BridgesExampleCrossingCaption = {
  kind: "legend" | "blocked" | "ambiguous" | "placed" | "removed";
  overIslands: boolean;
};

export function judgeBridgesExampleCrossing(
  example: BridgesExampleBoard,
): BridgesExampleCrossingCaption {
  const overIslands = getBridgesExampleIslandStatuses(example).includes("over");
  const notice = example.edgeNotice;
  if (example.candidatesShown) {
    return { kind: "ambiguous", overIslands };
  }
  if (notice?.change === "blocked") {
    return { kind: "blocked", overIslands };
  }
  if (notice?.change !== "changed" || !isBridgesExampleChanged(example)) {
    return { kind: "legend", overIslands };
  }
  return { kind: notice.count === 0 ? "removed" : "placed", overIslands };
}
