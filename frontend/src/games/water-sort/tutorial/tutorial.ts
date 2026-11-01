import type {
  Tutorial,
  TutorialMessage,
  TutorialMoveOutcome,
  TutorialSituation,
  TutorialStep,
} from "@/games/tutorial";
import {
  applyWaterSortMove,
  getWaterSortPourAmount,
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
import { listWaterSortDistinctTransitions } from "@/games/water-sort/puzzle/transitions";

/**
 * - `where`: 注げるのは、空のボトルか、上の色が同じボトル。
 * - `together`: 上に続く同じ色は、入るだけまとめて移る。
 */
export type WaterSortTutorialRuleId = "where" | "together";

/** 盤面と同じく、ボトルをタップする。 */
export type WaterSortTutorialAction = { bottleIndex: number };

/**
 * - `move`: 印を付け、手順の間だけ受け付ける注ぎ。注ぎ元、注ぎ先の順に印を付け、注ぐと次の手順へ進む。
 */
export type WaterSortTutorialStep = TutorialStep<WaterSortTutorialRuleId> & {
  move: WaterSortMove;
};

/**
 * 本番と同じく、選べないボトルや注げない先をタップしたわけ。
 * - `empty`: 空のボトルを注ぎ元に選ぼうとした。
 * - `complete`: 1色で満杯になったボトルを注ぎ元に選ぼうとした。
 * - `no-destination`: 注げる先が無いボトルを注ぎ元に選ぼうとした。
 * - `full`: 満杯のボトルへ注ごうとした。
 * - `different-color`: 上の色が違うボトルへ注ごうとした。
 */
export type WaterSortTutorialRejection =
  | "empty"
  | "complete"
  | "no-destination"
  | "full"
  | "different-color";

/**
 * 直前の手。盤面の動きに使う。
 * - `selected` / `deselected`: 注ぎ元を選んだ・選び直した。
 * - `poured`: 注いだ。`stateBefore` は注ぐ前の盤面。
 * - `rejected`: 選べないボトルや注げない先をタップし、盤面が揺れて応える。
 */
export type WaterSortTutorialMove =
  | { type: "selected" | "deselected"; bottleIndex: number }
  | { type: "poured"; move: WaterSortMove; stateBefore: WaterSortState }
  | {
      type: "rejected";
      bottleIndex: number;
      rejection: WaterSortTutorialRejection;
    };

/**
 * - `sourceBottleIndex`: 注ぎ元に選んでいるボトル。
 * - `moveCount`: 盤面が応えた手の数。同じボトルへの動きをやり直す目印に使う。
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

/** 色の番号。盤面と同じ並びで、赤・青・緑に見える。 */
const RED = 0;
const BLUE = 1;
const GREEN = 2;

/**
 * 3色と空のボトル2本。どのボトルも上が青なので、青を空のボトルへ集めながら、ルールを1つずつ使う。
 * 手順を終えると青がそろい、赤と緑が残る。ここからはどう注いでも詰まず、同じ色を重ねていけば3手でそろう。
 *
 * ```text
 * 最初（左が底）  手順の後        ゴール
 * 1 赤赤青青      1 赤赤          1 赤赤赤赤
 * 2 赤緑緑青      2 赤緑緑        2
 * 3 緑緑赤青      3 緑緑赤        3 緑緑緑緑
 * 4               4 青青青青      4 青青青青
 * 5               5               5
 * ```
 */
const startState: WaterSortState = [
  [RED, RED, BLUE, BLUE],
  [RED, GREEN, GREEN, BLUE],
  [GREEN, GREEN, RED, BLUE],
  [],
  [],
];

/** 手順の後、同じ色を重ねていく最短の3手でそろえた盤面。導入で、始めの盤面より先に見せる。 */
const goalState: WaterSortState = [
  [RED, RED, RED, RED],
  [],
  [GREEN, GREEN, GREEN, GREEN],
  [BLUE, BLUE, BLUE, BLUE],
  [],
];

/**
 * 青を4本目へ集める。
 * 2本目と3本目の青は1つずつ移るので、まとめて移るルールを示す前に注がせる。1本目は青が2つ続くので、最後に注いで、まとめて移ることを示す。
 */
const steps: readonly WaterSortTutorialStep[] = [
  {
    message: {
      headline: "ボトルをタップして選び\n注ぐ先をタップします",
      detail: "印のボトルをタップしてください",
    },
    introducedRuleId: null,
    move: { sourceBottleIndex: 1, destinationBottleIndex: 3 },
  },
  {
    message: {
      headline: "注げるのは、空のボトルか\n同じ色の上だけです",
      detail: null,
    },
    introducedRuleId: "where",
    move: { sourceBottleIndex: 2, destinationBottleIndex: 3 },
  },
  {
    message: {
      headline: "上に続く同じ色は\nまとめて移ります",
      detail: null,
    },
    introducedRuleId: "together",
    move: { sourceBottleIndex: 0, destinationBottleIndex: 3 },
  },
];

/** 本番で注ぎ元に選べないわけ。選べるなら `null`。 */
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
  const hasDestination = listWaterSortLegalMoves(bottles).some(
    (move) => move.sourceBottleIndex === bottleIndex,
  );
  return hasDestination ? null : "no-destination";
}

/** 注げないわけ。注げるなら `null`。 */
function findPourRejection(
  bottles: WaterSortState,
  move: WaterSortMove,
): WaterSortTutorialRejection | null {
  if (getWaterSortPourAmount(bottles, move) > 0) {
    return null;
  }
  const destination = bottles[move.destinationBottleIndex] ?? [];
  return destination.length >= WATER_SORT_BOTTLE_CAPACITY
    ? "full"
    : "different-color";
}

/**
 * 注ぎを決めるのに要るルール。空のボトルへ1つ移すだけなら、ボトルを選んで注ぐ操作のほかに要らない。
 * 注げない注ぎは `null`。
 */
function listRulesForMove(
  bottles: WaterSortState,
  move: WaterSortMove,
): WaterSortTutorialRuleId[] | null {
  const amount = getWaterSortPourAmount(bottles, move);
  if (amount === 0) {
    return null;
  }
  const destination = bottles[move.destinationBottleIndex] ?? [];
  return [
    ...(destination.length > 0 ? (["where"] as const) : []),
    ...(amount > 1 ? (["together"] as const) : []),
  ];
}

/** 今の盤面からそろえるまでの最短手数。どの盤面からも、数十の盤面をたどるだけで求まる。 */
function countShortestMovesToClear(bottles: WaterSortState): number | null {
  const seen = new Set([createWaterSortStateKey(bottles)]);
  let frontier: WaterSortState[] = [bottles];
  for (let moveCount = 0; frontier.length > 0; moveCount += 1) {
    if (frontier.some(isWaterSortCleared)) {
      return moveCount;
    }
    const next: WaterSortState[] = [];
    for (const state of frontier) {
      for (const transition of listWaterSortDistinctTransitions(state)) {
        if (!seen.has(transition.stateKey)) {
          seen.add(transition.stateKey);
          next.push(transition.state);
        }
      }
    }
    frontier = next;
  }
  return null;
}

/** 注いだ後にそろえるまでの手数が最も少ない注ぎ。`sourceBottleIndex` を渡すと、そのボトルから注ぐものに限る。 */
function findShortestMove(
  bottles: WaterSortState,
  sourceBottleIndex: number | null,
): WaterSortMove | null {
  let best: { move: WaterSortMove; remaining: number } | null = null;
  for (const move of listWaterSortLegalMoves(bottles)) {
    if (
      (sourceBottleIndex !== null &&
        move.sourceBottleIndex !== sourceBottleIndex) ||
      findSourceRejection(bottles, move.sourceBottleIndex) !== null
    ) {
      continue;
    }
    const next = applyWaterSortMove(bottles, move);
    const remaining = next ? countShortestMovesToClear(next) : null;
    if (remaining !== null && (best === null || remaining < best.remaining)) {
      best = { move, remaining };
    }
  }
  return best?.move ?? null;
}

function startWaterSortTutorial(): WaterSortTutorialBoardState {
  return {
    bottles: startState,
    sourceBottleIndex: null,
    moveCount: 0,
    lastMove: null,
  };
}

function getWaterSortTutorialGoal(): WaterSortTutorialBoardState {
  return {
    bottles: goalState,
    sourceBottleIndex: null,
    moveCount: 0,
    lastMove: null,
  };
}

function respond(
  state: WaterSortTutorialBoardState,
  next: Pick<WaterSortTutorialBoardState, "sourceBottleIndex" | "lastMove"> &
    Partial<Pick<WaterSortTutorialBoardState, "bottles">>,
): WaterSortTutorialBoardState {
  return { ...state, ...next, moveCount: state.moveCount + 1 };
}

function pour(
  state: WaterSortTutorialBoardState,
  move: WaterSortMove,
  stepping: boolean,
): { state: WaterSortTutorialBoardState; outcome: TutorialMoveOutcome } {
  const bottles = applyWaterSortMove(state.bottles, move);
  if (!bottles) {
    return { state, outcome: "ignored" };
  }
  const next = respond(state, {
    bottles,
    sourceBottleIndex: null,
    lastMove: { type: "poured", move, stateBefore: state.bottles },
  });
  if (isWaterSortCleared(bottles)) {
    return { state: next, outcome: "solved" };
  }
  return { state: next, outcome: stepping ? "stepped" : "continued" };
}

/** 手を引いている間は、印のボトルを、注ぎ元、注ぎ先の順にタップしたときだけ応える。 */
function performStep(
  step: WaterSortTutorialStep,
  state: WaterSortTutorialBoardState,
  bottleIndex: number,
): { state: WaterSortTutorialBoardState; outcome: TutorialMoveOutcome } {
  const { sourceBottleIndex, destinationBottleIndex } = step.move;
  if (state.sourceBottleIndex === null && bottleIndex === sourceBottleIndex) {
    return {
      state: respond(state, {
        sourceBottleIndex,
        lastMove: { type: "selected", bottleIndex },
      }),
      outcome: "continued",
    };
  }
  if (
    state.sourceBottleIndex === sourceBottleIndex &&
    bottleIndex === destinationBottleIndex
  ) {
    return pour(state, step.move, true);
  }
  return { state, outcome: "ignored" };
}

/**
 * 手を離した後は本番と同じく応える。選べないボトルを注ぎ元にしようとしたときと、注げない先をタップしたときは、
 * 手に入れたルールに合わない手として返し、注げない先のときは注ぎ元を選んだままにする。
 */
function performFreePlay(
  state: WaterSortTutorialBoardState,
  bottleIndex: number,
): { state: WaterSortTutorialBoardState; outcome: TutorialMoveOutcome } {
  const { sourceBottleIndex } = state;
  if (sourceBottleIndex === null) {
    const rejection = findSourceRejection(state.bottles, bottleIndex);
    return rejection === null
      ? {
          state: respond(state, {
            sourceBottleIndex: bottleIndex,
            lastMove: { type: "selected", bottleIndex },
          }),
          outcome: "continued",
        }
      : {
          state: respond(state, {
            sourceBottleIndex: null,
            lastMove: { type: "rejected", bottleIndex, rejection },
          }),
          outcome: "violated",
        };
  }
  if (sourceBottleIndex === bottleIndex) {
    return {
      state: respond(state, {
        sourceBottleIndex: null,
        lastMove: { type: "deselected", bottleIndex },
      }),
      outcome: "continued",
    };
  }
  const move = { sourceBottleIndex, destinationBottleIndex: bottleIndex };
  const rejection = findPourRejection(state.bottles, move);
  if (rejection !== null) {
    return {
      state: respond(state, {
        sourceBottleIndex,
        lastMove: { type: "rejected", bottleIndex, rejection },
      }),
      outcome: "violated",
    };
  }
  return pour(state, move, false);
}

function performWaterSortTutorialAction(
  { step }: WaterSortTutorialSituation,
  state: WaterSortTutorialBoardState,
  { bottleIndex }: WaterSortTutorialAction,
): { state: WaterSortTutorialBoardState; outcome: TutorialMoveOutcome } {
  if (!state.bottles[bottleIndex]) {
    return { state, outcome: "ignored" };
  }
  return step !== null
    ? performStep(step, state, bottleIndex)
    : performFreePlay(state, bottleIndex);
}

const rejectionMessages = {
  empty: "空のボトルからは注げません",
  complete: "そろったボトルは、もう動かせません",
  "no-destination": "この色を注げる先がありません",
  full: "満杯のボトルには注げません",
  "different-color": "違う色の上には注げません",
} as const satisfies Record<WaterSortTutorialRejection, string>;

function describeRejection(
  rejection: WaterSortTutorialRejection,
): TutorialMessage {
  return { headline: rejectionMessages[rejection], detail: null };
}

/** 選べないボトルや注げない先をタップしたとき。手を離した後にだけ起き、それまでにすべてのルールを示している。 */
function describeWaterSortTutorialViolation(
  _situation: WaterSortTutorialSituation,
  { lastMove }: WaterSortTutorialBoardState,
): TutorialMessage {
  return lastMove?.type === "rejected"
    ? describeRejection(lastMove.rejection)
    : { headline: "そのボトルには注げません", detail: null };
}

/**
 * 手を引いている間に、印の無いボトルをタップしたときの一言。
 * 注げる先のルールを示した後に、注ぎ元を選んだまま注げない先をタップしたなら、手を離した後と同じわけを言う。
 * それ以外は `null` で、手順の一言のまま、印を付け直して印のボトルへ向かわせる。
 */
export function describeWaterSortTutorialOffStepTap(
  { step, earnedRuleIds }: WaterSortTutorialSituation,
  state: WaterSortTutorialBoardState,
  bottleIndex: number,
): TutorialMessage | null {
  const { sourceBottleIndex } = state;
  if (
    step === null ||
    !earnedRuleIds.includes("where") ||
    sourceBottleIndex === null ||
    sourceBottleIndex === bottleIndex ||
    !state.bottles[bottleIndex]
  ) {
    return null;
  }
  const rejection = findPourRejection(state.bottles, {
    sourceBottleIndex,
    destinationBottleIndex: bottleIndex,
  });
  return rejection === null ? null : describeRejection(rejection);
}

/** 手順で印を付けるボトル。注ぎ元を選ぶまでは注ぎ元、選んだ後は注ぎ先。手を離した後は `null`。 */
export function getWaterSortTutorialStepBottleIndex(
  { step }: WaterSortTutorialSituation,
  state: WaterSortTutorialBoardState,
): number | null {
  if (step === null) {
    return null;
  }
  return state.sourceBottleIndex === step.move.sourceBottleIndex
    ? step.move.destinationBottleIndex
    : step.move.sourceBottleIndex;
}

/**
 * 手を離した後、手が止まったときに示すボトル。最も早くそろう注ぎの注ぎ元を示し、注ぎ元を選んでいれば、そこから最も早くそろう注ぎ先を示す。
 * そろっていれば `null`。
 */
export function findWaterSortTutorialHintBottleIndex(
  state: WaterSortTutorialBoardState,
): number | null {
  const move = findShortestMove(state.bottles, state.sourceBottleIndex);
  if (!move) {
    return null;
  }
  return state.sourceBottleIndex === null
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
    purpose: "ボトルの水を注ぎ分けて\n色をそろえるパズルです",
    goalCaption: "どの色も1本にそろえばゴールです",
    startCaption: "最初は色が混ざっています",
  },
  rules: [
    { id: "where", label: "空か同じ色の上に注ぐ" },
    { id: "together", label: "同じ色はまとめて移る" },
  ],
  steps,
  freePlay: {
    headline: "残りの色もそろえると完成です",
    detail: null,
  },
  completion: {
    selection: {
      headline: "完成です",
      detail: "レベル1は色もボトルも増えます",
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
  startState,
  goalState,
  listRulesForMove,
  countShortestMovesToClear,
  findSourceRejection,
};
