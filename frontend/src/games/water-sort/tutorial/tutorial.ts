import type {
  Tutorial,
  TutorialMessage,
  TutorialMoveOutcome,
  TutorialSituation,
  TutorialStep,
} from "@/games/tutorial";
import {
  applyWaterSortMove,
  listWaterSortLegalMoves,
} from "@/games/water-sort/puzzle/rules";
import {
  createWaterSortStateKey,
  isCompleteWaterSortBottle,
  isWaterSortCleared,
  WATER_SORT_BOTTLE_CAPACITY,
  type WaterSortMove,
  type WaterSortState,
} from "@/games/water-sort/puzzle/state";

/**
 * - `empty`: 選んだボトルの液体は、空のボトルに注げる。
 * - `same-color`: いちばん上が同じ色のボトルにも、その上に重ねて注げる。
 * - `together`: いちばん上に続く同じ色は、まとめて移る。
 */
export type WaterSortTutorialRuleId = "empty" | "same-color" | "together";

/** 盤面と同じく、ボトルを押す。 */
export type WaterSortTutorialAction = { bottleIndex: number };

/**
 * - `move`: 印を付け、手順の間だけ受け付ける注ぎ。注ぎ元を押して選ぶと、印を注ぎ先へ移す。注ぐと次の手順へ進む。
 */
export type WaterSortTutorialStep = TutorialStep<WaterSortTutorialRuleId> & {
  move: WaterSortMove;
};

/**
 * 注げなかったわけ。
 * - `empty`: 空のボトルを選ぼうとした。
 * - `complete`: 1色で満杯にそろったボトルを選ぼうとした。
 * - `no-destination`: 注げる先が無いボトルを選ぼうとした。
 * - `different-color`: いちばん上の色が違うボトルに注ごうとした。
 * - `full`: 満杯のボトルに注ごうとした。
 */
export type WaterSortTutorialRejection =
  | "empty"
  | "complete"
  | "no-destination"
  | "different-color"
  | "full";

/**
 * 直前の手。盤面の動きに使う。
 * - `selected` / `deselected`: 注ぎ元を選んだ・選び直した。
 * - `poured`: 注いだ。`bottlesBefore` は注ぐ前の盤面。
 * - `rejected`: 選べなかったか、注げなかった。`bottleIndex` は押したボトル。
 */
export type WaterSortTutorialMove =
  | { type: "selected" | "deselected"; bottleIndex: number }
  | { type: "poured"; move: WaterSortMove; bottlesBefore: WaterSortState }
  | {
      type: "rejected";
      bottleIndex: number;
      rejection: WaterSortTutorialRejection;
    };

/**
 * - `sourceBottleIndex`: 選んでいる注ぎ元。
 * - `moveCount`: 盤面に反応した手の数。同じボトルへの動きをやり直す目印に使う。
 */
export type WaterSortTutorialBoardState = {
  bottles: WaterSortState;
  sourceBottleIndex: number | null;
  moveCount: number;
  lastMove: WaterSortTutorialMove | null;
};

type WaterSortTutorialSituation = TutorialSituation<
  WaterSortTutorialRuleId,
  WaterSortTutorialStep
>;

/**
 * 3色と空のボトル2本。どのボトルもいちばん上が緑で、緑を4本目へ集めていくと、3手目で緑がそろう。
 * 残りの赤と青は、空のボトル1本を使って、どの順に注いでも詰まずにそろえられる。
 *
 * ```text
 * 上から   1本目  2本目  3本目  4本目  5本目
 *         緑     緑     緑     空     空
 *         赤     緑     青
 *         青     青     赤
 *         赤     赤     青
 * ```
 */
const RED = 0;
const BLUE = 1;
const GREEN = 2;

const startBottles: WaterSortState = [
  [RED, BLUE, RED, GREEN],
  [RED, BLUE, GREEN, GREEN],
  [BLUE, RED, BLUE, GREEN],
  [],
  [],
];

const goalBottles: WaterSortState = [
  [RED, RED, RED, RED],
  [BLUE, BLUE, BLUE, BLUE],
  [],
  [GREEN, GREEN, GREEN, GREEN],
  [],
];

/**
 * 1本目の緑を空の4本目へ注ぎ、3本目の緑をその上に重ね、2本目の2つ続く緑をまとめて注いで緑をそろえる。
 */
const steps: readonly WaterSortTutorialStep[] = [
  {
    message: {
      headline: "ボトルを選んで\n空のボトルに注ぎます",
      detail: "印のボトルを順に押してください",
    },
    introducedRuleId: "empty",
    move: { sourceBottleIndex: 0, destinationBottleIndex: 3 },
  },
  {
    message: {
      headline: "いちばん上が同じ色なら\nその上に注げます",
      detail: null,
    },
    introducedRuleId: "same-color",
    move: { sourceBottleIndex: 2, destinationBottleIndex: 3 },
  },
  {
    message: {
      headline: "上に続く同じ色は\nまとめて移ります",
      detail: null,
    },
    introducedRuleId: "together",
    move: { sourceBottleIndex: 1, destinationBottleIndex: 3 },
  },
];

function startWaterSortTutorial(): WaterSortTutorialBoardState {
  return {
    bottles: startBottles,
    sourceBottleIndex: null,
    moveCount: 0,
    lastMove: null,
  };
}

function getWaterSortTutorialGoal(): WaterSortTutorialBoardState {
  return {
    bottles: goalBottles,
    sourceBottleIndex: null,
    moveCount: 0,
    lastMove: null,
  };
}

/** 注ぎ元に選べないわけ。選べるなら `null`。本番と同じく、そろったボトルと注げる先が無いボトルは選べない。 */
function findSourceRejection(
  bottles: WaterSortState,
  bottleIndex: number,
): WaterSortTutorialRejection | null {
  const bottle = bottles[bottleIndex];
  if (!bottle || bottle.length === 0) {
    return "empty";
  }
  if (isCompleteWaterSortBottle(bottle)) {
    return "complete";
  }
  return listWaterSortLegalMoves(bottles).some(
    (move) => move.sourceBottleIndex === bottleIndex,
  )
    ? null
    : "no-destination";
}

function findDestinationRejection(
  bottles: WaterSortState,
  destinationBottleIndex: number,
): WaterSortTutorialRejection {
  return (bottles[destinationBottleIndex]?.length ?? 0) >=
    WATER_SORT_BOTTLE_CAPACITY
    ? "full"
    : "different-color";
}

function withMove(
  state: WaterSortTutorialBoardState,
  lastMove: WaterSortTutorialMove,
  changes: Partial<WaterSortTutorialBoardState>,
): WaterSortTutorialBoardState {
  return {
    ...state,
    ...changes,
    moveCount: state.moveCount + 1,
    lastMove,
  };
}

/**
 * 手を引いている間は、印の注ぎ元と注ぎ先だけを受け付ける。選んだ注ぎ元をもう一度押すと選び直せる。
 * 手を離した後は本番と同じく、選べないボトルや注げない先は、手に入れたルールに合わない手として返す。
 */
function performWaterSortTutorialAction(
  { step }: WaterSortTutorialSituation,
  state: WaterSortTutorialBoardState,
  { bottleIndex }: WaterSortTutorialAction,
): { state: WaterSortTutorialBoardState; outcome: TutorialMoveOutcome } {
  const { bottles, sourceBottleIndex } = state;
  if (!bottles[bottleIndex]) {
    return { state, outcome: "ignored" };
  }

  if (sourceBottleIndex === null) {
    if (step !== null && bottleIndex !== step.move.sourceBottleIndex) {
      return { state, outcome: "ignored" };
    }
    const rejection = findSourceRejection(bottles, bottleIndex);
    if (rejection !== null) {
      return {
        state: withMove(
          state,
          { type: "rejected", bottleIndex, rejection },
          {},
        ),
        outcome: "violated",
      };
    }
    return {
      state: withMove(
        state,
        { type: "selected", bottleIndex },
        { sourceBottleIndex: bottleIndex },
      ),
      outcome: "continued",
    };
  }

  if (bottleIndex === sourceBottleIndex) {
    return {
      state: withMove(
        state,
        { type: "deselected", bottleIndex },
        { sourceBottleIndex: null },
      ),
      outcome: "continued",
    };
  }

  if (step !== null && bottleIndex !== step.move.destinationBottleIndex) {
    return { state, outcome: "ignored" };
  }

  const move = { sourceBottleIndex, destinationBottleIndex: bottleIndex };
  const next = applyWaterSortMove(bottles, move);
  if (!next) {
    return {
      state: withMove(
        state,
        {
          type: "rejected",
          bottleIndex,
          rejection: findDestinationRejection(bottles, bottleIndex),
        },
        {},
      ),
      outcome: "violated",
    };
  }

  const poured = withMove(
    state,
    { type: "poured", move, bottlesBefore: bottles },
    { bottles: next, sourceBottleIndex: null },
  );
  if (isWaterSortCleared(next)) {
    return { state: poured, outcome: "solved" };
  }
  return { state: poured, outcome: step !== null ? "stepped" : "continued" };
}

const rejectionMessages = {
  empty: "空のボトルからは注げません",
  complete: "このボトルはもうそろっています",
  "no-destination": "このボトルから注げるボトルはありません",
  "different-color": "いちばん上の色が違うボトルには注げません",
  full: "満杯のボトルには注げません",
} as const satisfies Record<WaterSortTutorialRejection, string>;

/** 選べないボトルを押したか、注げない先を押したとき。手を離した後にだけ起き、それまでに3つのルールを示している。 */
function describeWaterSortTutorialViolation(
  _situation: WaterSortTutorialSituation,
  { lastMove }: WaterSortTutorialBoardState,
): TutorialMessage {
  return {
    headline:
      lastMove?.type === "rejected"
        ? rejectionMessages[lastMove.rejection]
        : rejectionMessages["different-color"],
    detail: null,
  };
}

/** 今の盤面から、そろえるまでに要る最も少ない手数。そろえられなければ `null`。 */
function countMovesToClear(bottles: WaterSortState): number | null {
  const visited = new Set([createWaterSortStateKey(bottles)]);
  let frontier: readonly WaterSortState[] = [bottles];
  for (let depth = 0; frontier.length > 0; depth += 1) {
    if (frontier.some(isWaterSortCleared)) {
      return depth;
    }
    const next: WaterSortState[] = [];
    for (const current of frontier) {
      for (const move of listWaterSortLegalMoves(current)) {
        const reached = applyWaterSortMove(current, move);
        if (!reached) {
          continue;
        }
        const key = createWaterSortStateKey(reached);
        if (!visited.has(key)) {
          visited.add(key);
          next.push(reached);
        }
      }
    }
    frontier = next;
  }
  return null;
}

/** 今の盤面から最も少ない手数でそろえる注ぎ。`sourceBottleIndex` を渡すと、その注ぎ元からの注ぎに限る。 */
function findShortestMove(
  bottles: WaterSortState,
  sourceBottleIndex: number | null,
): WaterSortMove | null {
  if (isWaterSortCleared(bottles)) {
    return null;
  }
  let best: { move: WaterSortMove; moveCount: number } | null = null;
  for (const move of listWaterSortLegalMoves(bottles)) {
    if (
      sourceBottleIndex !== null &&
      move.sourceBottleIndex !== sourceBottleIndex
    ) {
      continue;
    }
    const reached = applyWaterSortMove(bottles, move);
    const moveCount = reached && countMovesToClear(reached);
    if (
      moveCount !== null &&
      moveCount !== undefined &&
      (best === null || moveCount < best.moveCount)
    ) {
      best = { move, moveCount };
    }
  }
  return best?.move ?? null;
}

/** 手順で印を付けるボトル。注ぎ元を選ぶ前は注ぎ元、選んだ後は注ぎ先。手を離した後は `null`。 */
export function getWaterSortTutorialStepBottle(
  { step }: WaterSortTutorialSituation,
  { sourceBottleIndex }: WaterSortTutorialBoardState,
): number | null {
  if (step === null) {
    return null;
  }
  return sourceBottleIndex === null
    ? step.move.sourceBottleIndex
    : step.move.destinationBottleIndex;
}

/**
 * 手を離した後、手が止まったときに示すボトル。最も少ない手数でそろえる注ぎの、注ぎ元を選ぶ前は注ぎ元、選んだ後は注ぎ先。
 * 選んだ注ぎ元から注げる先が無いか、そろえ終えていれば `null`。
 */
export function findWaterSortTutorialHintBottle({
  bottles,
  sourceBottleIndex,
}: WaterSortTutorialBoardState): number | null {
  const move = findShortestMove(bottles, sourceBottleIndex);
  if (!move) {
    return null;
  }
  return sourceBottleIndex === null
    ? move.sourceBottleIndex
    : move.destinationBottleIndex;
}

export const waterSortTutorial: Tutorial<
  WaterSortTutorialRuleId,
  WaterSortTutorialStep,
  WaterSortTutorialBoardState,
  WaterSortTutorialAction
> = {
  intro: {
    purpose: "液体を注ぎ分けて\n色ごとに1本のボトルへそろえるパズルです",
    goalCaption: "この形がゴールです",
    startCaption: "最初は色が混ざっています",
  },
  rules: [
    { id: "empty", label: "空のボトルへ" },
    { id: "same-color", label: "同じ色の上へ" },
    { id: "together", label: "まとめて移る" },
  ],
  steps,
  freePlay: {
    headline: "残りの色もそろえると完成です",
    detail: null,
  },
  completion: {
    selection: {
      headline: "完成です",
      detail: "レベル1は色が増えますが\nルールは同じです",
    },
    play: {
      headline: "完成です",
      detail: "プレイ中の盤面も同じルールで解けます",
    },
  },
  start: startWaterSortTutorial,
  goal: getWaterSortTutorialGoal,
  perform: performWaterSortTutorialAction,
  describeViolation: describeWaterSortTutorialViolation,
};

export const _private = {
  startBottles,
  goalBottles,
  countMovesToClear,
  findShortestMove,
};
