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

export type WaterSortTutorialRuleId = "where" | "together" | "fit" | "full";

export type WaterSortTutorialAction = { bottleIndex: number };

export type WaterSortTutorialStep = TutorialStep<WaterSortTutorialRuleId> & {
  kind: "pour" | "refusal";
  /** `refusal` の注ぎ先は、注ぎたくなるが注げない先で、選べないわけとして覆いから抜く。 */
  move: WaterSortMove;
};

export type WaterSortTutorialRejection =
  | "empty"
  | "complete"
  | "no-destination"
  | "full"
  | "different-color";

export type WaterSortTutorialMove =
  | { type: "selected" | "deselected"; bottleIndex: number }
  | { type: "poured"; move: WaterSortMove; stateBefore: WaterSortState }
  | {
      type: "rejected";
      bottleIndex: number;
      rejection: WaterSortTutorialRejection;
    };

/** 注いで1色そろったボトル。次に注ぐまで残し、注ぐ動きの間に次のボトルを選んでも、そろったことに応えられるようにする。 */
export type WaterSortTutorialCompletion = {
  bottleIndex: number;
  /** そろえた注ぎの番号。同じボトルでも、注ぎ直してそろえたら応え直す。 */
  id: number;
  /** 盤面で初めてそろった。そろったボトルから注げないことを、ルールに合わない手を打つまで言う。 */
  first: boolean;
};

export type WaterSortTutorialBoardState = {
  bottles: WaterSortState;
  sourceBottleIndex: number | null;
  lastMove: WaterSortTutorialMove | null;
  pourCount: number;
  /** 直前の注ぎで1色そろったボトル。そろわなかったら `null`。 */
  completion: WaterSortTutorialCompletion | null;
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
 * 3色と空のボトル2本。青を4本目へ集め、緑を5本目へそろえながら、ルールを1つずつ使う。
 * 手順を終えると緑がそろい、どう注いでも詰まない盤面が残り、同じ色を重ねていけば3手でそろう。
 *
 * ```text
 * 最初（左が底）  手順の後        ゴール
 * 1 赤赤赤青      1 赤赤赤        1 赤赤赤赤
 * 2 青赤緑緑      2 青赤          2
 * 3 青緑緑青      3 青            3
 * 4               4 青青          4 青青青青
 * 5               5 緑緑緑緑      5 緑緑緑緑
 * ```
 */
const startState: WaterSortState = [
  [RED, RED, RED, BLUE],
  [BLUE, RED, GREEN, GREEN],
  [BLUE, GREEN, GREEN, BLUE],
  [],
  [],
];

/** 手順の後、同じ色を重ねていく最短の3手でそろえた盤面。 */
const goalState: WaterSortState = [
  [RED, RED, RED, RED],
  [],
  [],
  [BLUE, BLUE, BLUE, BLUE],
  [GREEN, GREEN, GREEN, GREEN],
];

/**
 * 1本目と3本目の上の青は1つずつなので、まとめて移るルールを示す前に、空のボトル・同じ色の上の順に注がせる。
 * 2本目の上の緑は2つ続くので、空のボトルへまとめて移す。
 * その緑2つを、1つしか入らない3本目へ戻して、入るぶんだけ移り、3本目が満杯になることを示す。
 * 残った緑1つを満杯の3本目へ注ごうとさせ、注げる先が無いので選べないことを、本番と同じ揺れで確かめさせる。
 * そのうえで、3本目の緑3つを5本目へ移してそろえる。
 * 青を注がせる間と、入るぶんだけ移る手順の間は満杯のボトルが無いので、満杯のルールを示す前に、同じ色の上へ注げると思った先で止められない。
 */
const steps: readonly WaterSortTutorialStep[] = [
  {
    message: {
      headline: "注ぐボトルをタップしてから\n注ぎ先をタップします",
      detail: "印のボトルから注ぎます",
    },
    introducedRuleId: null,
    kind: "pour",
    move: { sourceBottleIndex: 0, destinationBottleIndex: 3 },
  },
  {
    message: {
      headline: "注げるのは\n空のボトルか同じ色の上だけです",
      detail: "印のボトルから注ぎます",
    },
    introducedRuleId: "where",
    kind: "pour",
    move: { sourceBottleIndex: 2, destinationBottleIndex: 3 },
  },
  {
    message: {
      headline: "上に続く同じ色は\nまとめて移ります",
      detail: "印のボトルから注ぎます",
    },
    introducedRuleId: "together",
    kind: "pour",
    move: { sourceBottleIndex: 1, destinationBottleIndex: 4 },
  },
  {
    message: {
      headline: "入るぶんだけ移ります",
      detail: "印のボトルから注ぎます",
    },
    introducedRuleId: "fit",
    kind: "pour",
    move: { sourceBottleIndex: 4, destinationBottleIndex: 2 },
  },
  {
    message: {
      headline: "満杯のボトルには\n注げません",
      detail: "印のボトルから注いでみてください",
    },
    introducedRuleId: "full",
    kind: "refusal",
    move: { sourceBottleIndex: 4, destinationBottleIndex: 2 },
  },
  {
    message: {
      headline: "注げる先が無いボトルは\n選べません",
      detail: "印のボトルから注ぎます",
    },
    introducedRuleId: null,
    kind: "pour",
    move: { sourceBottleIndex: 2, destinationBottleIndex: 4 },
  },
];

const STEP_DESTINATION_DETAIL = "印のボトルへ注ぎます";

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

function findPourRejection(
  bottles: WaterSortState,
  move: WaterSortMove,
): "full" | "different-color" | null {
  if (getWaterSortPourAmount(bottles, move) > 0) {
    return null;
  }
  const source = bottles[move.sourceBottleIndex] ?? [];
  const destination = bottles[move.destinationBottleIndex] ?? [];
  // 満杯で上の色も違うときは、先に示す、色が違うことをわけにする。
  return destination.length > 0 && destination.at(-1) !== source.at(-1)
    ? "different-color"
    : "full";
}

const ruleByPourRejection = {
  full: "full",
  "different-color": "where",
} as const satisfies Record<
  NonNullable<ReturnType<typeof findPourRejection>>,
  WaterSortTutorialRuleId
>;

function countTopRun(bottle: readonly number[]): number {
  const top = bottle.at(-1);
  let count = 0;
  for (let index = bottle.length - 1; index >= 0; index -= 1) {
    if (bottle[index] !== top) {
      break;
    }
    count += 1;
  }
  return count;
}

/**
 * 注ぎ元と注ぎ先を選んだときに、注げるかと、何が移るかを決めるルール。
 * 空のボトルへ1つ移すだけなら、ボトルを選んで注ぐ操作のほかに要らない。
 */
function listRulesForMove(
  bottles: WaterSortState,
  move: WaterSortMove,
): { pourable: boolean; ruleIds: WaterSortTutorialRuleId[] } {
  const rejection = findPourRejection(bottles, move);
  if (rejection !== null) {
    return { pourable: false, ruleIds: [ruleByPourRejection[rejection]] };
  }
  const amount = getWaterSortPourAmount(bottles, move);
  const source = bottles[move.sourceBottleIndex] ?? [];
  const destination = bottles[move.destinationBottleIndex] ?? [];
  return {
    pourable: true,
    ruleIds: [
      ...(destination.length > 0 ? (["where"] as const) : []),
      ...(amount > 1 ? (["together"] as const) : []),
      ...(amount < countTopRun(source) ? (["fit"] as const) : []),
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
    pourCount: 0,
    completion: null,
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
  const pourCount = state.pourCount + 1;
  const { destinationBottleIndex } = move;
  const next: WaterSortTutorialBoardState = {
    bottles,
    sourceBottleIndex: null,
    lastMove: { type: "poured", move, stateBefore: state.bottles },
    pourCount,
    completion: isCompleteWaterSortBottle(bottles[destinationBottleIndex] ?? [])
      ? {
          bottleIndex: destinationBottleIndex,
          id: pourCount,
          first: !state.bottles.some(isCompleteWaterSortBottle),
        }
      : null,
  };
  if (isWaterSortCleared(bottles)) {
    return { state: next, outcome: "solved" };
  }
  return { state: next, outcome: stepping ? "stepped" : "continued" };
}

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
    // ルールに合わない手のわけを言うので、初めてそろったことはもう言わない。
    completion: state.completion && { ...state.completion, first: false },
  };
}

function performRefusalStep(
  step: WaterSortTutorialStep,
  state: WaterSortTutorialBoardState,
  bottleIndex: number,
): { state: WaterSortTutorialBoardState; outcome: TutorialMoveOutcome } {
  const rejection = findSourceRejection(state.bottles, bottleIndex);
  if (
    state.sourceBottleIndex !== null ||
    bottleIndex !== step.move.sourceBottleIndex ||
    rejection === null
  ) {
    return { state, outcome: "ignored" };
  }
  return {
    state: reject(state, null, bottleIndex, rejection),
    outcome: "stepped",
  };
}

/**
 * 手を引いている間は、印のボトルを、注ぎ元、注ぎ先の順にタップしたときだけ注ぐ。
 * 注ぎ元を選んだ後に、注げないわけのルールをもう示した注ぎ先をタップしたら、手を離した後と同じく、
 * ルールに合わない手として返して注ぎ元を選んだままにする。それ以外のタップには応えない。
 */
function performStep(
  step: WaterSortTutorialStep,
  earnedRuleIds: readonly WaterSortTutorialRuleId[],
  state: WaterSortTutorialBoardState,
  bottleIndex: number,
): { state: WaterSortTutorialBoardState; outcome: TutorialMoveOutcome } {
  if (step.kind === "refusal") {
    return performRefusalStep(step, state, bottleIndex);
  }
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
  if (
    rejection === null ||
    !earnedRuleIds.includes(ruleByPourRejection[rejection])
  ) {
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
  "no-destination": "今は注ぎ先がありません",
  full: "満杯のボトルには注げません",
  "different-color": "違う色の上には注げません",
} as const satisfies Record<WaterSortTutorialRejection, string>;

function describeRejection(
  rejection: WaterSortTutorialRejection,
): TutorialMessage {
  return { headline: rejectionMessages[rejection], detail: null };
}

/**
 * 選べないボトルや注げない注ぎ先をタップしたとき。手を引いている間は、注げないわけのルールを示した後の注ぎ先でだけ起きる。
 * そろったボトルから注げないことは、盤面で初めて1色そろったときに伝えている。
 */
function describeWaterSortTutorialViolation(
  _situation: WaterSortTutorialSituation,
  { lastMove }: WaterSortTutorialBoardState,
): TutorialMessage {
  return lastMove?.type === "rejected"
    ? describeRejection(lastMove.rejection)
    : { headline: "そのボトルには注げません", detail: null };
}

/**
 * 盤面で初めて1色そろったときの一言。そろったボトルへの合図と一緒に出し、そろったボトルを注ぎ元に選べないことを、
 * 選ぼうとして止められるより先に伝える。
 */
export const waterSortTutorialFirstCompletionMessage: TutorialMessage = {
  headline: "1色そろいました",
  detail: "そろったボトルからは注げません",
};

export function isWaterSortTutorialFirstCompletion({
  completion,
}: WaterSortTutorialBoardState): boolean {
  return completion?.first ?? false;
}

/**
 * 手を引いている間に、画面全体の覆いから抜いて元の明るさで見せるボトル。
 * 手順の注ぎ元と、注げるかと何が移るかを決める注ぎ先を、印がどちらにあっても抜く。
 * `violationShown` は、ルールに合わない手のわけの一言を出しているか。出している間は、はじいたボトルも、揺れとわけの一言が指すボトルとして抜く。
 */
export function getWaterSortTutorialSpotlitBottleIndices(
  { step }: WaterSortTutorialSituation,
  { lastMove }: WaterSortTutorialBoardState,
  violationShown: boolean,
): number[] | null {
  if (step === null) {
    return null;
  }
  const { sourceBottleIndex, destinationBottleIndex } = step.move;
  return [
    sourceBottleIndex,
    destinationBottleIndex,
    ...(violationShown && lastMove?.type === "rejected"
      ? [lastMove.bottleIndex]
      : []),
  ];
}

export function describeWaterSortTutorialStep(
  step: WaterSortTutorialStep,
  { sourceBottleIndex }: WaterSortTutorialBoardState,
): TutorialMessage {
  return step.kind === "pour" &&
    sourceBottleIndex === step.move.sourceBottleIndex
    ? { ...step.message, detail: STEP_DESTINATION_DETAIL }
    : step.message;
}

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

/** 手を離した後、手が止まったときに示すボトル。 */
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
    goalCaption: "どの色も1本にそろったらゴールです",
    startCaption: "最初は色がばらばらです",
  },
  rules: [
    { id: "where", label: "空か同じ色へ" },
    { id: "together", label: "まとめて移る" },
    { id: "fit", label: "入るぶんだけ移る" },
    { id: "full", label: "満杯には注げない" },
  ],
  steps,
  freePlay: {
    headline: "残りもそろえたら完成です",
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
