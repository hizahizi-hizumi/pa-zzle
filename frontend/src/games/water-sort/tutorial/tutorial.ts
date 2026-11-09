import type {
  Tutorial,
  TutorialMessage,
  TutorialMoveOutcome,
  TutorialSituation,
  TutorialStep,
} from "@/games/tutorial";
import {
  applyWaterSortMove,
  findWaterSortSourceRejection,
  getWaterSortPourAmount,
  listWaterSortLegalMoves,
  type WaterSortSourceRejection,
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
 * - `where`: 注げるのは、空のボトルか、上の色が同じボトル。
 * - `together`: 上に続く同じ色は、まとめて移る。
 * - `capacity`: ボトルには4つまで入る。移るのは注ぎ先に入るぶんだけで、満杯のボトルには注げない。
 */
export type WaterSortTutorialRuleId = "where" | "together" | "capacity";

/** 盤面と同じく、ボトルをタップする。 */
export type WaterSortTutorialAction = { bottleIndex: number };

/** `move` の注ぎ元、注ぎ先の順に印を付けて押させ、注ぐと次の手順へ進む。 */
export type WaterSortTutorialStep = TutorialStep<WaterSortTutorialRuleId> & {
  move: WaterSortMove;
};

/**
 * 本番と同じく、選べないボトルや注げない注ぎ先を押したわけ。注ぎ元に選べないわけ（`WaterSortSourceRejection`）と、注げないわけ。
 * - `full`: 満杯のボトルへ注ごうとした。
 * - `different-color`: 上の色が違うボトルへ注ごうとした。
 */
export type WaterSortTutorialRejection =
  | WaterSortSourceRejection
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
  | { type: "poured"; move: WaterSortMove; stateBefore: WaterSortState }
  | {
      type: "rejected";
      bottleIndex: number;
      rejection: WaterSortTutorialRejection;
    };

/**
 * 注いで1色そろったボトル。次に注ぐまで残し、注ぐ動きの間に次のボトルを選んでも、そろったことに応えられるようにする。
 * - `id`: そろえた注ぎの番号。同じボトルでも、注ぎ直してそろえたら応え直す。
 * - `first`: 盤面で初めてそろった。そろったボトルから注げないことを、ルールに合わない手を打つまで言う。
 */
export type WaterSortTutorialCompletion = {
  bottleIndex: number;
  id: number;
  first: boolean;
};

/**
 * - `sourceBottleIndex`: 注ぎ元に選んでいるボトル。
 * - `pourCount`: 注いだ回数。
 * - `completion`: 直前の注ぎで1色そろったボトル。そろわなかったら `null`。
 */
export type WaterSortTutorialBoardState = {
  bottles: WaterSortState;
  sourceBottleIndex: number | null;
  lastMove: WaterSortTutorialMove | null;
  pourCount: number;
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
 * 3色と空のボトル2本。4つの手順で、緑を4本目へ、赤を5本目へ移し、青3つを2本目へ戻そうとして2つだけ移す。
 * 手を離すと、空のボトルが無く、青が1本目と2本目に分かれた盤面が残る。青を1本目と2本目の間で注ぎ合っても進まず、
 * 緑をそろえて空いたボトルへ青を集めると、最短の5手でそろう。どう注いでも詰まず、1色もそろっていない。
 *
 * ```text
 * 最初（左が底）  手を離す盤面    ゴール
 * 1 赤青青青      1 赤青          1
 * 2 赤青赤緑      2 赤青青青      2
 * 3 緑緑緑赤      3 緑緑緑        3 青青青青
 * 4               4 緑            4 緑緑緑緑
 * 5               5 赤赤          5 赤赤赤赤
 * ```
 */
const startState: WaterSortState = [
  [RED, BLUE, BLUE, BLUE],
  [RED, BLUE, RED, GREEN],
  [GREEN, GREEN, GREEN, RED],
  [],
  [],
];

/** 手を離した盤面から最短の5手でそろえた盤面の1つ。導入で、始めの盤面より先に見せる。 */
const goalState: WaterSortState = [
  [],
  [],
  [BLUE, BLUE, BLUE, BLUE],
  [GREEN, GREEN, GREEN, GREEN],
  [RED, RED, RED, RED],
];

/**
 * 2本目の上の緑は1つなので、まとめて移るルールを示す前に、空のボトルへ注がせる。3本目の上の赤も1つで、同じ色の上へ1つだけ移る。
 * 赤2つが上に続いた2本目から、空の5本目へまとめて移す。
 * 1本目の上に続く青3つを、2つしか入らない2本目へ注がせ、入るぶんだけ移って満杯になることを示す。
 * 4つまで入ることを示す前は、印の注ぎ元から、満杯のために注げない先が無い。
 */
const steps: readonly WaterSortTutorialStep[] = [
  {
    message: {
      headline: "まず注ぐほうのボトル、\n次に注ぐ先を押します",
      detail: null,
    },
    introducedRuleId: null,
    move: { sourceBottleIndex: 1, destinationBottleIndex: 3 },
  },
  {
    message: {
      headline: "注げるのは\n空のボトルか同じ色の上だけです",
      detail: null,
    },
    introducedRuleId: "where",
    move: { sourceBottleIndex: 2, destinationBottleIndex: 1 },
  },
  {
    message: {
      headline: "上に重なった同じ色は\nまとめて移ります",
      detail: null,
    },
    introducedRuleId: "together",
    move: { sourceBottleIndex: 1, destinationBottleIndex: 4 },
  },
  {
    message: {
      headline: "ボトルには\n4つまでしか入りません",
      detail: null,
    },
    introducedRuleId: "capacity",
    move: { sourceBottleIndex: 0, destinationBottleIndex: 1 },
  },
];

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

/** 注げない注ぎ先の、注げないわけを決めるルール。 */
const ruleByPourRejection = {
  full: "capacity",
  "different-color": "where",
} as const satisfies Record<
  NonNullable<ReturnType<typeof findPourRejection>>,
  WaterSortTutorialRuleId
>;

/** 注ぎ元の上に続く同じ色の数。 */
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
 * - 注げない: 満杯なら `capacity`、上の色が違えば `where`。
 * - 注げる: 空でない注ぎ先なら `where`、2つ以上移るなら `together`、続く同じ色の一部だけ移るなら `capacity`。
 *   空のボトルへ1つ移すだけなら、ボトルを選んで注ぐ操作のほかに要らない。
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
      ...(amount < countTopRun(source) ? (["capacity"] as const) : []),
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
      findWaterSortSourceRejection(bottles, move.sourceBottleIndex) !== null
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

/** 選べないボトルや注げない注ぎ先を押した手。ルールに合わない手のわけを言うので、初めてそろったことはもう言わない。 */
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
    completion: state.completion && { ...state.completion, first: false },
  };
}

/**
 * 手を引いている間は、印のボトルを、注ぎ元、注ぎ先の順に押したときだけ注ぐ。
 * 注ぎ元を選んだ後に、注げないわけのルールをもう示した注ぎ先を押したら、手を離した後と同じく、
 * ルールに合わない手として返して注ぎ元を選んだままにする。それ以外の押した手には応えない。
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
 * 手を離した後は本番と同じく応える。選べないボトルを注ぎ元にしようとしたときと、注げない先を押したときは、
 * 手に入れたルールに合わない手として返し、注げない先のときは注ぎ元を選んだままにする。
 */
function performFreePlay(
  state: WaterSortTutorialBoardState,
  bottleIndex: number,
): { state: WaterSortTutorialBoardState; outcome: TutorialMoveOutcome } {
  const { sourceBottleIndex } = state;
  if (sourceBottleIndex === null) {
    const rejection = findWaterSortSourceRejection(state.bottles, bottleIndex);
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
  "no-destination": "このボトルは今どこにも注げません",
  full: "いっぱいのボトルには注げません",
  "different-color": "違う色の上には注げません",
} as const satisfies Record<WaterSortTutorialRejection, string>;

function describeRejection(
  rejection: WaterSortTutorialRejection,
): TutorialMessage {
  return { headline: rejectionMessages[rejection], detail: null };
}

/**
 * 選べないボトルや注げない注ぎ先を押したとき。手を引いている間は、注げないわけのルールを示した後の注ぎ先でだけ起きる。
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

/** 盤面で初めて1色そろえた後、次に注ぐかルールに合わない手を打つまでの間か。 */
export function isWaterSortTutorialFirstCompletion({
  completion,
}: WaterSortTutorialBoardState): boolean {
  return completion?.first ?? false;
}

/**
 * 手を引いている間に、画面全体の覆いから抜いて元の明るさで見せるボトル。手を離した後は `null`。
 * 手順の注ぎ元と、注げるかと何が移るかを決める注ぎ先を、決め手として抜く。押す所は、このうち印を付けた1本。
 * ルールに合わない注ぎ先を押しても、そのボトルは抜かない。抜くと、決め手か押す所に見えるため。
 */
export function getWaterSortTutorialSpotlitBottleIndices({
  step,
}: WaterSortTutorialSituation): number[] | null {
  return step === null
    ? null
    : [step.move.sourceBottleIndex, step.move.destinationBottleIndex];
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

/** 解き終えたときの一言。どこから開いても同じで、補足には `describeWaterSortTutorialCompletion` が手数を入れる。 */
const completionMessage: TutorialMessage = {
  headline: "完成です",
  detail: null,
};

/** 手を離したときの盤面。 */
const releasedState = steps.reduce(
  (bottles, { move }) => applyWaterSortMove(bottles, move) ?? bottles,
  startState,
);

/**
 * 解き終えたときの一言。手を離してから自分で注いだ手数を、手を離した盤面からの最短手数と並べて言う。
 * 本番の評価も手数を最短手数と比べるので、少ない手でそろえるほど良いことを、解き終えた盤面で受け取らせる。
 */
export function describeWaterSortTutorialCompletion({
  pourCount,
}: WaterSortTutorialBoardState): TutorialMessage {
  const ownMoveCount = pourCount - steps.length;
  const shortestMoveCount = countShortestMovesToClear(releasedState);
  return {
    ...completionMessage,
    detail:
      ownMoveCount === shortestMoveCount
        ? `自分で注いだ${ownMoveCount}手は最短です`
        : `自分で注いだのは${ownMoveCount}手、最短は${shortestMoveCount}手です`,
  };
}

export const waterSortTutorial: Tutorial<
  WaterSortTutorialRuleId,
  WaterSortTutorialStep,
  WaterSortTutorialBoardState,
  WaterSortTutorialAction
> = {
  intro: {
    purpose: "ボトルの水を注ぎ分けて\n色をそろえるパズルです",
    goalCaption: "色ごとに1本にそろえたら完成です",
    startCaption: "今は色がまざっています",
  },
  rules: [
    { id: "where", label: "空か同じ色へ" },
    { id: "together", label: "まとめて移る" },
    { id: "capacity", label: "4つまで入る" },
  ],
  steps,
  freePlay: {
    headline: "残りもそろえたら完成です",
    detail: null,
  },
  completion: {
    home: completionMessage,
    play: completionMessage,
  },
  start: startWaterSortTutorial,
  goal: getWaterSortTutorialGoal,
  perform: performWaterSortTutorialAction,
  describeViolation: describeWaterSortTutorialViolation,
};

export const _private = {
  startState,
  goalState,
  releasedState,
  listRulesForMove,
  countShortestMovesToClear,
};
