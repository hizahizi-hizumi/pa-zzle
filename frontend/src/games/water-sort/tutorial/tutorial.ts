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
  type WaterSortMove,
  type WaterSortState,
} from "@/games/water-sort/puzzle/state";
import { listWaterSortDistinctTransitions } from "@/games/water-sort/puzzle/transitions";

/**
 * - `where`: 注げるのは、空のボトルか、上の色が同じで空きのあるボトル。
 * - `together`: 上に続く同じ色は、まとめて移る。
 */
export type WaterSortTutorialRuleId = "where" | "together";

/** 盤面と同じく、ボトルをタップする。 */
export type WaterSortTutorialAction = { bottleIndex: number };

/**
 * `move` の注ぎ元、注ぎ先の順に印を付けてタップさせ、注ぐと次の手順へ進む。
 * - `destinationMessage`: 注ぎ元を選んだ後の一言。選んでから注ぐまでが別の操作だと教える手順だけが持ち、無ければ `message` のままにする。
 */
export type WaterSortTutorialStep = TutorialStep<WaterSortTutorialRuleId> & {
  move: WaterSortMove;
  destinationMessage: TutorialMessage | null;
};

/**
 * 本番と同じく、選べないボトルや注げない注ぎ先をタップしたわけ。
 * - `empty`: 空のボトルを注ぎ元に選ぼうとした。
 * - `complete`: 1色で満杯になったボトルを注ぎ元に選ぼうとした。
 * - `no-destination`: 注げるボトルが無いボトルを注ぎ元に選ぼうとした。
 * - `no-room`: 同じ色が上にあるボトルはあるが、どれも満杯で、ほかに注げるボトルも無いボトルを注ぎ元に選ぼうとした。
 * - `full`: 満杯のボトルへ注ごうとした。
 * - `different-color`: 上の色が違うボトルへ注ごうとした。
 */
export type WaterSortTutorialRejection =
  | "empty"
  | "complete"
  | "no-destination"
  | "no-room"
  | "full"
  | "different-color";

/**
 * 直前の手。盤面の動きに使う。
 * - `selected` / `deselected`: 注ぎ元を選んだ・選び直した。
 * - `poured`: 注いだ。`stateBefore` は注ぐ前の盤面。
 * - `rejected`: 選べないボトルや注げない注ぎ先をタップし、盤面が揺れて応える。
 */
export type WaterSortTutorialMove =
  | { type: "selected" | "deselected"; bottleIndex: number }
  | {
      type: "poured";
      move: WaterSortMove;
      stateBefore: WaterSortState;
      /** 上に続く同じ色の一部が、注ぎ先に入りきらず注ぎ元に残った。 */
      leftover: boolean;
    }
  | {
      type: "rejected";
      bottleIndex: number;
      rejection: WaterSortTutorialRejection;
    };

/** `sourceBottleIndex` は、注ぎ元に選んでいるボトル。 */
export type WaterSortTutorialBoardState = {
  bottles: WaterSortState;
  sourceBottleIndex: number | null;
  lastMove: WaterSortTutorialMove | null;
};

export type WaterSortTutorialSituation = TutorialSituation<
  WaterSortTutorialRuleId,
  WaterSortTutorialStep
>;

/** 色の番号。盤面と同じ並びで、赤・青・緑に見える。 */
const RED = 0;
const BLUE = 1;
const GREEN = 2;

/**
 * 3色と空のボトル2本。緑を4本目へ集める3手で、操作とルールを1つずつ使う。
 * 手順を終えると、どう注いでも詰まない盤面が残り、最短5手でそろう。
 * 3本目の緑は青の下に埋まっているので、青を空のボトルへよけるところを自分で見つけさせる。
 *
 * ```text
 * 最初（左が底）  手順の後        ゴール
 * 1 赤赤赤青      1 赤赤赤青      1 赤赤赤赤
 * 2 赤緑緑青      2 赤            2
 * 3 青緑青緑      3 青緑青青      3
 * 4               4 緑緑緑        4 緑緑緑緑
 * 5               5               5 青青青青
 * ```
 */
const startState: WaterSortState = [
  [RED, RED, RED, BLUE],
  [RED, GREEN, GREEN, BLUE],
  [BLUE, GREEN, BLUE, GREEN],
  [],
  [],
];

/** 手順の後、最短の5手でそろえた盤面。導入で、始めの盤面より先に見せる。 */
const goalState: WaterSortState = [
  [RED, RED, RED, RED],
  [],
  [],
  [GREEN, GREEN, GREEN, GREEN],
  [BLUE, BLUE, BLUE, BLUE],
];

/**
 * 3本目の上の緑と2本目の上の青は1つずつなので、まとめて移るルールを示す前に、空のボトル・同じ色の上の順に注がせる。
 * 青をよけた2本目の上には緑が2つ続くので、4本目の緑の上へまとめて移す。
 * 入りきらない分が残ることと、満杯のボトルに注げないことは、そろえる向きに進まない手でしか見せられないので手順にせず、
 * 手を離した後にそうなったときに、盤面の反応に一言を添えて伝える。
 */
const steps: readonly WaterSortTutorialStep[] = [
  {
    message: { headline: "このボトルをタップします", detail: null },
    destinationMessage: {
      headline: "空のボトルをタップして注ぎます",
      detail: null,
    },
    introducedRuleId: null,
    move: { sourceBottleIndex: 2, destinationBottleIndex: 3 },
  },
  {
    message: { headline: "同じ色の上にも注げます", detail: null },
    destinationMessage: null,
    introducedRuleId: "where",
    move: { sourceBottleIndex: 1, destinationBottleIndex: 2 },
  },
  {
    message: {
      headline: "同じ色が続いていたら\nまとめて注げます",
      detail: null,
    },
    destinationMessage: null,
    introducedRuleId: "together",
    move: { sourceBottleIndex: 1, destinationBottleIndex: 3 },
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
  if (hasDestination) {
    return null;
  }
  const hasSameColorTop = bottles.some(
    (other, otherIndex) =>
      otherIndex !== bottleIndex && other.at(-1) === bottle.at(-1),
  );
  return hasSameColorTop ? "no-room" : "no-destination";
}

/** 注ぎ元の上に続く同じ色の数。 */
function countTopRun(bottle: readonly number[]): number {
  const top = bottle.at(-1);
  const firstOther = bottle.findLastIndex((color) => color !== top);
  return bottle.length - 1 - firstOther;
}

/** 注げないわけ。満杯で上の色も違うときは、先に示す、色が違うことをわけにする。注げるなら `null`。 */
function findPourRejection(
  bottles: WaterSortState,
  move: WaterSortMove,
): "full" | "different-color" | null {
  if (getWaterSortPourAmount(bottles, move) > 0) {
    return null;
  }
  const source = bottles[move.sourceBottleIndex] ?? [];
  const destination = bottles[move.destinationBottleIndex] ?? [];
  return destination.length > 0 && destination.at(-1) !== source.at(-1)
    ? "different-color"
    : "full";
}

/**
 * 注ぎ元と注ぎ先を選んだときに、注げるかと、何が移るかを決めるルール。
 * - 注げない: `where`。
 * - 注げる: 空でない注ぎ先なら `where`、2つ以上移るなら `together`。
 *   空のボトルへ1つ移すだけなら、ボトルを選んで注ぐ操作のほかに要らない。
 */
function listRulesForMove(
  bottles: WaterSortState,
  move: WaterSortMove,
): { pourable: boolean; ruleIds: WaterSortTutorialRuleId[] } {
  if (findPourRejection(bottles, move) !== null) {
    return { pourable: false, ruleIds: ["where"] };
  }
  const destination = bottles[move.destinationBottleIndex] ?? [];
  return {
    pourable: true,
    ruleIds: [
      ...(destination.length > 0 ? (["where"] as const) : []),
      ...(getWaterSortPourAmount(bottles, move) > 1
        ? (["together"] as const)
        : []),
    ],
  };
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
    lastMove: null,
  };
}

function getWaterSortTutorialGoal(): WaterSortTutorialBoardState {
  return { ...startWaterSortTutorial(), bottles: goalState };
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
  const next: WaterSortTutorialBoardState = {
    bottles,
    sourceBottleIndex: null,
    lastMove: {
      type: "poured",
      move,
      stateBefore: state.bottles,
      leftover:
        getWaterSortPourAmount(state.bottles, move) <
        countTopRun(state.bottles[move.sourceBottleIndex] ?? []),
    },
  };
  if (isWaterSortCleared(bottles)) {
    return { state: next, outcome: "solved" };
  }
  return { state: next, outcome: stepping ? "stepped" : "continued" };
}

/** 選べないボトルや注げない注ぎ先のタップ。 */
function reject(
  state: WaterSortTutorialBoardState,
  sourceBottleIndex: number | null,
  bottleIndex: number,
  rejection: WaterSortTutorialRejection,
): WaterSortTutorialBoardState {
  return {
    ...state,
    sourceBottleIndex,
    lastMove: { type: "rejected", bottleIndex, rejection },
  };
}

/**
 * 手を引いている間は、印のボトルを、注ぎ元、注ぎ先の順にタップしたときだけ注ぐ。
 * 注げる先のルールを示した後は、注ぎ元を選んでから注げない注ぎ先をタップしたら、手を離した後と同じく、
 * ルールに合わない手として返して注ぎ元を選んだままにする。それ以外のタップには応えない。
 */
function performStep(
  step: WaterSortTutorialStep,
  earnedRuleIds: readonly WaterSortTutorialRuleId[],
  state: WaterSortTutorialBoardState,
  bottleIndex: number,
): { state: WaterSortTutorialBoardState; outcome: TutorialMoveOutcome } {
  const { sourceBottleIndex, destinationBottleIndex } = step.move;
  if (state.sourceBottleIndex === null && bottleIndex === sourceBottleIndex) {
    return {
      state: {
        ...state,
        sourceBottleIndex,
        lastMove: { type: "selected", bottleIndex },
      },
      outcome: "continued",
    };
  }
  if (state.sourceBottleIndex !== sourceBottleIndex) {
    return { state, outcome: "ignored" };
  }
  if (bottleIndex === destinationBottleIndex) {
    return pour(state, step.move, true);
  }
  const rejection =
    bottleIndex === sourceBottleIndex
      ? null
      : findPourRejection(state.bottles, {
          sourceBottleIndex,
          destinationBottleIndex: bottleIndex,
        });
  if (rejection === null || !earnedRuleIds.includes("where")) {
    return { state, outcome: "ignored" };
  }
  return {
    state: reject(state, sourceBottleIndex, bottleIndex, rejection),
    outcome: "violated",
  };
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
          state: {
            ...state,
            sourceBottleIndex: bottleIndex,
            lastMove: { type: "selected", bottleIndex },
          },
          outcome: "continued",
        }
      : {
          state: reject(state, null, bottleIndex, rejection),
          outcome: "violated",
        };
  }
  if (sourceBottleIndex === bottleIndex) {
    return {
      state: {
        ...state,
        sourceBottleIndex: null,
        lastMove: { type: "deselected", bottleIndex },
      },
      outcome: "continued",
    };
  }
  const move = { sourceBottleIndex, destinationBottleIndex: bottleIndex };
  const rejection = findPourRejection(state.bottles, move);
  if (rejection !== null) {
    return {
      state: reject(state, sourceBottleIndex, bottleIndex, rejection),
      outcome: "violated",
    };
  }
  return pour(state, move, false);
}

function performWaterSortTutorialAction(
  { step, earnedRuleIds }: WaterSortTutorialSituation,
  state: WaterSortTutorialBoardState,
  { bottleIndex }: WaterSortTutorialAction,
): { state: WaterSortTutorialBoardState; outcome: TutorialMoveOutcome } {
  if (!state.bottles[bottleIndex]) {
    return { state, outcome: "ignored" };
  }
  return step !== null
    ? performStep(step, earnedRuleIds, state, bottleIndex)
    : performFreePlay(state, bottleIndex);
}

const rejectionMessages = {
  empty: "空のボトルからは注げません",
  complete: "そろったボトルからは注げません",
  "no-destination": "このボトルは\nいまどこにも注げません",
  "no-room": "同じ色の上がいっぱいで\nいまは注げません",
  full: "いっぱいのボトルには注げません",
  "different-color": "違う色の上には注げません",
} as const satisfies Record<WaterSortTutorialRejection, string>;

function describeRejection(
  rejection: WaterSortTutorialRejection,
): TutorialMessage {
  return { headline: rejectionMessages[rejection], detail: null };
}

/** 選べないボトルや注げない注ぎ先をタップしたとき。手を引いている間は、注げる先のルールを示した後の注ぎ先でだけ起きる。 */
function describeWaterSortTutorialViolation(
  _situation: WaterSortTutorialSituation,
  { lastMove }: WaterSortTutorialBoardState,
): TutorialMessage {
  return lastMove?.type === "rejected"
    ? describeRejection(lastMove.rejection)
    : { headline: "そのボトルには注げません", detail: null };
}

/** 1色そろったボトルの位置。 */
export function listWaterSortTutorialCompletedBottleIndices({
  bottles,
}: WaterSortTutorialBoardState): number[] {
  return bottles.flatMap((bottle, bottleIndex) =>
    isCompleteWaterSortBottle(bottle) ? [bottleIndex] : [],
  );
}

function countCompletedBottles(bottles: WaterSortState): number {
  return bottles.filter(isCompleteWaterSortBottle).length;
}

/** 色の数。ゴールでは、色ごとに1本ずつそろう。 */
const COLOR_COUNT = countCompletedBottles(goalState);

/** 入口から完成までの段の数。手順の数と色の数を足したもの。 */
export const WATER_SORT_TUTORIAL_PROGRESS_STEP_COUNT =
  steps.length + COLOR_COUNT;

/**
 * 入口から完成までの進み具合（0〜1）。手順を1つ終えるたびと、1色そろうたびに同じだけ進む。
 * そろったボトルからは注げないので、後戻りしない。
 */
export function getWaterSortTutorialProgressRatio(
  stepIndex: number,
  { bottles }: WaterSortTutorialBoardState,
): number {
  return (
    (stepIndex + countCompletedBottles(bottles)) /
    WATER_SORT_TUTORIAL_PROGRESS_STEP_COUNT
  );
}

/**
 * 手を離した後の一言。1色そろうたびに、そろった数と残りの数で応える。
 * まとめて注げると伝えた同じ色が入りきらずに残った直後は、入りきらない分が残ることを言う。入りきらない注ぎで色がそろうことは無い。
 */
export function describeWaterSortTutorialFreePlay({
  bottles,
  lastMove,
}: WaterSortTutorialBoardState): TutorialMessage {
  if (lastMove?.type === "poured" && lastMove.leftover) {
    return { headline: "入りきらない分は\n元のボトルに残ります", detail: null };
  }
  const completedCount = countCompletedBottles(bottles);
  return completedCount === 0
    ? waterSortTutorial.freePlay
    : {
        headline: `${completedCount}色そろいました\nあと${COLOR_COUNT - completedCount}色です`,
        detail: null,
      };
}

/** 手順の一言。注ぎ元を選んだ後は、その手順が注ぎ先の一言を持っていれば替える。 */
export function describeWaterSortTutorialStep(
  step: WaterSortTutorialStep,
  { sourceBottleIndex }: WaterSortTutorialBoardState,
): TutorialMessage {
  return sourceBottleIndex === step.move.sourceBottleIndex
    ? (step.destinationMessage ?? step.message)
    : step.message;
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
    purpose: "同じ色を1本ずつに\nそろえるパズルです",
    goalCaption: "全部そろえば完成です",
  },
  rules: [
    { id: "where", label: "空のボトルか同じ色の上に注げます" },
    {
      id: "together",
      label: "同じ色は入るぶんだけまとめて注げます",
    },
  ],
  steps,
  freePlay: {
    headline: "残りもそろえてみましょう",
    detail: null,
  },
  completion: {
    home: {
      headline: "完成です",
      detail: "どのレベルも同じルールです",
    },
    play: {
      headline: "完成です",
      detail: "プレイ中の盤面も同じルールです",
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
