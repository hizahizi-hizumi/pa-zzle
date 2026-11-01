import type {
  Tutorial,
  TutorialMessage,
  TutorialMoveOutcome,
  TutorialProgress,
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
 * - `together`: いちばん上で重なっている同じ色は、まとめて移る。
 * - `sorted`: 1色で満杯にそろったボトルからは注げない。
 * - `capacity`: 注ぎ先の空きより多ければ、入るだけ移り、残りは注ぎ元に残る。空きが無ければ注げない。
 */
export type WaterSortTutorialRuleId =
  | "empty"
  | "same-color"
  | "together"
  | "sorted"
  | "capacity";

/** 盤面と同じく、ボトルを押す。 */
export type WaterSortTutorialAction = { bottleIndex: number };

/**
 * 手順で印を付けて受け付ける手と、次の手順へ進む手。
 * - `selected`: `move` の注ぎ元を選んだところで進む。選び方を教える手順に使う。
 * - `poured`: `move` の注ぎ元を選ぶと印を注ぎ先へ移し、注いだところで進む。
 * - `rejected`: `bottleIndex` のボトルを押し、選べずに揺れたところで進む。できないことを反応で体験させる手順に使う。
 */
export type WaterSortTutorialStep = TutorialStep<WaterSortTutorialRuleId> &
  (
    | { endsWhen: "selected" | "poured"; move: WaterSortMove }
    | { endsWhen: "rejected"; bottleIndex: number }
  );

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
 * 4手目で、2本目の2つ重なった青を、空きが1つの1本目へ注ぎ、1つだけ移して1つ残す。
 * 残りの赤と青は、空のボトル1本を使って、どの順に注いでも詰まずにそろえられる。
 *
 * ```text
 * 上から   1本目  2本目  3本目  4本目  5本目
 *         緑     緑     緑     空     空
 *         青     青     緑
 *         赤     青     青
 *         赤     赤     赤
 * ```
 */
const RED = 0;
const BLUE = 1;
const GREEN = 2;

const startBottles: WaterSortState = [
  [RED, RED, BLUE, GREEN],
  [RED, BLUE, BLUE, GREEN],
  [RED, BLUE, GREEN, GREEN],
  [],
  [],
];

/** 手順を終えた後、手が止まって示されるボトルのとおりに注いだときにそろう並び。 */
const goalBottles: WaterSortState = [
  [],
  [],
  [RED, RED, RED, RED],
  [GREEN, GREEN, GREEN, GREEN],
  [BLUE, BLUE, BLUE, BLUE],
];

/** そろったボトルを選ぼうとしたときの一言。手順でも、そろったボトルを押させる前に同じ文で言い切る。 */
const COMPLETE_REJECTION_MESSAGE = "そろったボトルからは注げません";

/**
 * まず1本目を押して選ばせ、選んだら空の4本目へ注がせる。
 * 1本目の緑を空の4本目へ注ぎ、2本目の緑をその上に重ね、3本目の2つ重なった緑をまとめて注いで緑をそろえる。
 * そろった緑の4本目を押させ、選べずに揺れるのを見せる。
 * 最後に、2本目の2つ重なった青を、空きが1つの1本目へ注ぎ、入るだけ移す。
 */
const steps: readonly WaterSortTutorialStep[] = [
  {
    message: { headline: "注ぐボトルを押して選びます", detail: null },
    introducedRuleId: null,
    move: { sourceBottleIndex: 0, destinationBottleIndex: 3 },
    endsWhen: "selected",
  },
  {
    message: {
      headline: "空のボトルに注げます",
      detail: "もう一度押すと選び直せます",
    },
    introducedRuleId: "empty",
    move: { sourceBottleIndex: 0, destinationBottleIndex: 3 },
    endsWhen: "poured",
  },
  {
    message: {
      headline: "上の色が同じときだけ\n重ねて注げます",
      detail: null,
    },
    introducedRuleId: "same-color",
    move: { sourceBottleIndex: 1, destinationBottleIndex: 3 },
    endsWhen: "poured",
  },
  {
    message: {
      headline: "同じ色が重なっていれば\nまとめて移ります",
      detail: null,
    },
    introducedRuleId: "together",
    move: { sourceBottleIndex: 2, destinationBottleIndex: 3 },
    endsWhen: "poured",
  },
  {
    message: { headline: COMPLETE_REJECTION_MESSAGE, detail: null },
    introducedRuleId: "sorted",
    bottleIndex: 3,
    endsWhen: "rejected",
  },
  {
    message: {
      headline: "入るだけ移ります",
      detail: null,
    },
    introducedRuleId: "capacity",
    move: { sourceBottleIndex: 1, destinationBottleIndex: 0 },
    endsWhen: "poured",
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
    if (step !== null && bottleIndex !== getStepSourceBottle(step)) {
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
        outcome: step?.endsWhen === "rejected" ? "stepped" : "violated",
      };
    }
    return {
      state: withMove(
        state,
        { type: "selected", bottleIndex },
        { sourceBottleIndex: bottleIndex },
      ),
      outcome: step?.endsWhen === "selected" ? "stepped" : "continued",
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

  if (
    step !== null &&
    (step.endsWhen === "rejected" ||
      bottleIndex !== step.move.destinationBottleIndex)
  ) {
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
  complete: COMPLETE_REJECTION_MESSAGE,
  "no-destination": "このボトルはどこにも注げません",
  "different-color": "上の色が違うと注げません",
  full: "満杯のボトルには注げません",
} as const satisfies Record<WaterSortTutorialRejection, string>;

/** 選べないボトルを押したか、注げない先を押したとき。手を離した後にだけ起き、それまでに4つのルールを示している。 */
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

/** 手順で最初に押させるボトル。 */
function getStepSourceBottle(step: WaterSortTutorialStep): number {
  return step.endsWhen === "rejected"
    ? step.bottleIndex
    : step.move.sourceBottleIndex;
}

/**
 * 一言とルールの並びで見せる進行。選ぶ手順の次の手順で、選んだ注ぎ元を選び直したら、選ぶ手順に戻し、その手順で手に入れたルールも伏せて見せる。
 */
export function getWaterSortTutorialShownProgress<
  Progress extends TutorialProgress<
    WaterSortTutorialRuleId,
    WaterSortTutorialBoardState
  >,
>(progress: Progress): Progress {
  const { stepIndex, boardState, earnedRuleIds } = progress;
  const step = steps[stepIndex];
  const continuesSelection =
    step?.endsWhen === "poured" &&
    steps[stepIndex - 1]?.endsWhen === "selected";
  if (!continuesSelection || boardState.sourceBottleIndex !== null) {
    return progress;
  }
  return {
    ...progress,
    stepIndex: stepIndex - 1,
    earnedRuleIds: earnedRuleIds.filter(
      (ruleId) => ruleId !== step.introducedRuleId,
    ),
  };
}

/** 手順で印を付けるボトル。注ぎ元を選ぶ前は注ぎ元、選んだ後は注ぎ先。手を離した後は `null`。 */
export function getWaterSortTutorialStepBottle(
  { step }: WaterSortTutorialSituation,
  { sourceBottleIndex }: WaterSortTutorialBoardState,
): number | null {
  if (step === null) {
    return null;
  }
  if (step.endsWhen === "rejected" || sourceBottleIndex === null) {
    return getStepSourceBottle(step);
  }
  return step.move.destinationBottleIndex;
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
    purpose: "液体を注ぎ分けて\n色をそろえるパズルです",
    goalCaption: "色ごとに1本にそろえばゴールです",
    startCaption: "最初は色が混ざっています",
  },
  rules: [
    { id: "empty", label: "空ボトル" },
    { id: "same-color", label: "同じ色" },
    { id: "together", label: "まとめて" },
    { id: "sorted", label: "そろい済" },
    { id: "capacity", label: "入るだけ" },
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
