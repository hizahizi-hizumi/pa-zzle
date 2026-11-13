import type { TsumeShogiProblem } from "@/games/tsume-shogi/problem/problem";
import { isTsumeShogiMateWithin } from "@/games/tsume-shogi/puzzle/mate-search";
import {
  applyTsumeShogiMove,
  isSameTsumeShogiMove,
  listTsumeShogiAttackerChecks,
  parseTsumeShogiMoveUsi,
  type TsumeShogiMove,
} from "@/games/tsume-shogi/puzzle/moves";
import {
  createTsumeShogiPosition,
  getTsumeShogiPieceAt,
  isSameTsumeShogiSquare,
  type TsumeShogiHandPieceType,
  type TsumeShogiSquare,
} from "@/games/tsume-shogi/puzzle/position";
import {
  canUndoTsumeShogiSession,
  chooseTsumeShogiSessionPromotion,
  createTsumeShogiSession,
  getTsumeShogiSessionPhase,
  getTsumeShogiSessionRemainingPlies,
  isTsumeShogiSessionOnWrongLine,
  playTsumeShogiSessionDefenderReply,
  type TsumeShogiSession,
  tapTsumeShogiSessionHand,
  tapTsumeShogiSessionSquare,
  undoTsumeShogiSession,
} from "@/games/tsume-shogi/session/session";
import type {
  Tutorial,
  TutorialMessage,
  TutorialMoveOutcome,
  TutorialSituation,
  TutorialStep,
} from "@/games/tutorial";

/**
 * - `drop`: 持駒は、空いた升に打てる。
 * - `check`: 攻方は毎手、王手をかける。王手にならない手は指せない。
 * - `escape`: 王手をかけても、玉に逃げ道があると詰まない。逃げ道をふさぐ王手で詰ませる。
 */
export type TsumeShogiTutorialRuleId = "drop" | "check" | "escape";

/**
 * - `square` / `hand`: 盤の升・攻方の持駒を押す。本番と同じく、駒を選んでから行き先の升を押すと指す。
 * - `undo`: 待った。
 * - `defender-reply`: 攻方が指してから間を置いて、決めてある玉方の応手を盤面に指す。
 */
export type TsumeShogiTutorialAction =
  | { type: "square"; square: TsumeShogiSquare }
  | { type: "hand"; pieceType: TsumeShogiHandPieceType }
  | { type: "promotion"; promote: boolean }
  | { type: "undo" }
  | { type: "defender-reply" };

export type TsumeShogiTutorialTarget =
  | { type: "move"; move: TsumeShogiMove }
  | { type: "undo" };

/**
 * - `reason`: その手を決めるもの（決め手）。`king` は王手をかける玉、`status` は盤の下の、この手数では詰まないという知らせ。
 * - `keySquares`: 決め手として玉と一緒に見せる升。逃げ道を伝える手順で、飛が守っていて、飛を動かすと玉が逃げる升。
 */
export type TsumeShogiTutorialStep = TutorialStep<TsumeShogiTutorialRuleId> & {
  target: TsumeShogiTutorialTarget;
  reason: "king" | "status";
  keySquares: readonly TsumeShogiSquare[];
};

/**
 * 盤面の反応（選んだ駒、着手させなかった手の揺れ、玉方の応手と反証、
 * この手数では詰まないという知らせ、待った）を本番と同じ遷移で返すため、`session/` の状態をそのまま使う。
 * 経過時間は測らない。
 */
export type TsumeShogiTutorialBoardState = TsumeShogiSession;

export type TsumeShogiTutorialSituation = TutorialSituation<
  TsumeShogiTutorialRuleId,
  TsumeShogiTutorialStep
>;

export type TsumeShogiTutorialMark =
  | { type: "square"; square: TsumeShogiSquare }
  | { type: "hand"; pieceType: TsumeShogiHandPieceType }
  | { type: "undo" };

/**
 * 盤の右の端で、飛と持駒の金1枚で玉を追う5手詰。攻方の手は、どれも玉の左隣に金を置く王手になる。
 * 金を打って王手し（▲2三金打）、玉が下へ逃げるたびに金を1升ずつ下げて追い（▲2四金・▲2五金）、
 * 盤の端と飛に逃げ道をふさがれた玉を詰ませる。玉方の応手はどれも1つに決まる。
 *
 * ```text
 * 始まり            ゴール（詰み）
 *   2  1              2  1
 *   .  玉v 三          .  .  三
 *   .  .   四          .  .  四
 *   .  .   五          金 玉v 五
 *   飛 .   六          飛 .  六
 * 持駒: 金          持駒: なし
 * ```
 */
const problem: TsumeShogiProblem = {
  initialPosition: createTsumeShogiPosition("9/9/8k/9/9/7R1/9/9/9", {
    gold: 1,
  }),
  plies: 5,
  mainLine: ["G*2c", "1c1d", "2c2d", "1d1e", "2d2e"].map(
    parseTsumeShogiMoveUsi,
  ),
};

const [firstMove, , secondMove, , matingMove] = problem.mainLine as [
  TsumeShogiMove,
  TsumeShogiMove,
  TsumeShogiMove,
  TsumeShogiMove,
  TsumeShogiMove,
];

/** 詰ませる手の前で、飛を金と同じ升へ上げて王手する。飛が離れた升へ玉が逃げ、この手数では詰まなくなる。 */
const escapingCheck = parseTsumeShogiMoveUsi("2f2e");

/** 飛が守っていて、逃げ道のある王手で飛を動かすと、玉が逃げる升。 */
const escapeSquare: TsumeShogiSquare = { file: 1, rank: 6 };

const steps: readonly TsumeShogiTutorialStep[] = [
  {
    message: {
      headline: "持駒は、空いた升に打てます",
      detail: "印の付いた金を押してから、印の升を押してください",
    },
    introducedRuleId: "drop",
    target: { type: "move", move: firstMove },
    reason: "king",
    keySquares: [],
  },
  {
    message: {
      headline: "金を打った手は、王手でした\n自分の番では、必ず王手をかけます",
      detail: "次の手で玉を取れるようにする手を、王手と言います",
    },
    introducedRuleId: "check",
    target: { type: "move", move: secondMove },
    reason: "king",
    keySquares: [],
  },
  {
    message: {
      headline: "逃げ道があると、玉は逃げます",
      detail:
        "空いた升と、守られていない駒の升が逃げ道です\n飛車を動かして、逃げ道を開けてみてください",
    },
    introducedRuleId: "escape",
    target: { type: "move", move: escapingCheck },
    reason: "king",
    keySquares: [escapeSquare],
  },
  {
    message: {
      headline: "「5手では詰みません」と出たら\n待ったを押して戻しましょう",
      detail: null,
    },
    introducedRuleId: null,
    target: { type: "undo" },
    reason: "status",
    keySquares: [],
  },
];

function startTsumeShogiTutorial(): TsumeShogiTutorialBoardState {
  return createTsumeShogiSession(problem, 0);
}

function getTsumeShogiTutorialGoal(): TsumeShogiTutorialBoardState {
  return [firstMove, secondMove, matingMove].reduce(
    (session, move) =>
      playTsumeShogiSessionDefenderReply(playMove(session, move)),
    startTsumeShogiTutorial(),
  );
}

function playMove(
  session: TsumeShogiSession,
  move: TsumeShogiMove,
): TsumeShogiSession {
  const selected =
    move.kind === "drop"
      ? tapTsumeShogiSessionHand(session, move.pieceType)
      : tapTsumeShogiSessionSquare(session, move.from, 0);
  const played = tapTsumeShogiSessionSquare(selected, move.to, 0);
  return played.promotionChoice
    ? chooseTsumeShogiSessionPromotion(
        played,
        move.kind === "board" && move.promote,
        0,
      )
    : played;
}

function applyInput(
  state: TsumeShogiTutorialBoardState,
  action: Exclude<
    TsumeShogiTutorialAction,
    { type: "undo" } | { type: "defender-reply" }
  >,
): TsumeShogiTutorialBoardState {
  switch (action.type) {
    case "square":
      return tapTsumeShogiSessionSquare(state, action.square, 0);
    case "hand":
      return tapTsumeShogiSessionHand(state, action.pieceType);
    case "promotion":
      return chooseTsumeShogiSessionPromotion(state, action.promote, 0);
  }
}

function isNewlyRejected(
  before: TsumeShogiTutorialBoardState,
  after: TsumeShogiTutorialBoardState,
): boolean {
  return after.rejection !== null && after.rejection !== before.rejection;
}

function isSourceSelected(
  state: TsumeShogiTutorialBoardState,
  move: TsumeShogiMove,
): boolean {
  const { selection } = state;
  if (selection === null) {
    return false;
  }
  return move.kind === "drop"
    ? selection.type === "hand" && selection.pieceType === move.pieceType
    : selection.type === "board" &&
        isSameTsumeShogiSquare(selection.square, move.from);
}

/**
 * 手に印を付ける所。駒（持駒）を選ぶまでは駒に、選んだら行き先の升に付ける。
 * 玉方の応手を待つ間と、詰んだ後は付けない。
 */
export function getTsumeShogiTutorialMark(
  target: TsumeShogiTutorialTarget,
  state: TsumeShogiTutorialBoardState,
): TsumeShogiTutorialMark | null {
  if (target.type === "undo") {
    return canUndoTsumeShogiSession(state) ? { type: "undo" } : null;
  }
  if (getTsumeShogiSessionPhase(state) !== "attacker") {
    return null;
  }
  const { move } = target;
  if (isSourceSelected(state, move)) {
    return { type: "square", square: move.to };
  }
  return move.kind === "drop"
    ? { type: "hand", pieceType: move.pieceType }
    : { type: "square", square: move.from };
}

function isTowardStepMove(
  state: TsumeShogiTutorialBoardState,
  move: TsumeShogiMove,
  action: TsumeShogiTutorialAction,
): boolean {
  const mark = getTsumeShogiTutorialMark({ type: "move", move }, state);
  switch (action.type) {
    case "square":
      return (
        mark?.type === "square" &&
        isSameTsumeShogiSquare(mark.square, action.square)
      );
    case "hand":
      return mark?.type === "hand" && mark.pieceType === action.pieceType;
    case "promotion":
    case "undo":
    case "defender-reply":
      return false;
  }
}

/**
 * 手を引いている間は、印の駒を選び、印の升へ指す操作と、待ったの手順の待ったを受け付ける。
 * 印の手の後に玉方が応じたら次の手順へ進む。王手を伝えた後は、王手にならない手を本番と同じく着手させず、違反として返す。
 * それ以外の操作は盤面を変えない。
 */
function performGuided(
  step: TsumeShogiTutorialStep,
  earnedRuleIds: readonly TsumeShogiTutorialRuleId[],
  state: TsumeShogiTutorialBoardState,
  action: TsumeShogiTutorialAction,
): { state: TsumeShogiTutorialBoardState; outcome: TutorialMoveOutcome } {
  const { target } = step;
  if (action.type === "defender-reply") {
    return state.defenderReplyPending
      ? { state: playTsumeShogiSessionDefenderReply(state), outcome: "stepped" }
      : { state, outcome: "ignored" };
  }
  if (action.type === "undo") {
    return target.type === "undo" && canUndoTsumeShogiSession(state)
      ? { state: undoTsumeShogiSession(state), outcome: "stepped" }
      : { state, outcome: "ignored" };
  }
  if (target.type === "undo") {
    return { state, outcome: "ignored" };
  }
  const next = applyInput(state, action);
  if (isTowardStepMove(state, target.move, action)) {
    return { state: next, outcome: "continued" };
  }
  if (
    earnedRuleIds.includes("check") &&
    isNewlyRejected(state, next) &&
    next.rejection?.reason === "not-check" &&
    isSourceSelected(state, target.move)
  ) {
    return { state: next, outcome: "violated" };
  }
  return { state, outcome: "ignored" };
}

/**
 * 手を離した後は、本番と同じく盤面が応える。
 */
function performFree(
  state: TsumeShogiTutorialBoardState,
  action: TsumeShogiTutorialAction,
): { state: TsumeShogiTutorialBoardState; outcome: TutorialMoveOutcome } {
  switch (action.type) {
    case "defender-reply": {
      if (!state.defenderReplyPending) {
        return { state, outcome: "ignored" };
      }
      const next = playTsumeShogiSessionDefenderReply(state);
      return {
        state: next,
        outcome: next.turns.at(-1)?.line === "wrong" ? "violated" : "continued",
      };
    }
    case "undo":
      return canUndoTsumeShogiSession(state)
        ? { state: undoTsumeShogiSession(state), outcome: "continued" }
        : { state, outcome: "ignored" };
    case "square":
    case "hand":
    case "promotion": {
      const next = applyInput(state, action);
      if (next === state) {
        return { state, outcome: "ignored" };
      }
      if (isNewlyRejected(state, next)) {
        return { state: next, outcome: "violated" };
      }
      return {
        state: next,
        outcome: next.status === "cleared" ? "solved" : "continued",
      };
    }
  }
}

function performTsumeShogiTutorialAction(
  { step, earnedRuleIds }: TsumeShogiTutorialSituation,
  state: TsumeShogiTutorialBoardState,
  action: TsumeShogiTutorialAction,
): { state: TsumeShogiTutorialBoardState; outcome: TutorialMoveOutcome } {
  return step
    ? performGuided(step, earnedRuleIds, state, action)
    : performFree(state, action);
}

function describeTsumeShogiTutorialViolation(
  _situation: TsumeShogiTutorialSituation,
  state: TsumeShogiTutorialBoardState,
): TutorialMessage {
  const { rejection, selection } = state;
  if (rejection?.reason === "not-check") {
    return { headline: "王手にならない手は指せません", detail: null };
  }
  if (rejection?.reason === "illegal") {
    return selection?.type === "hand"
      ? { headline: "持駒は、空いた升にしか打てません", detail: null }
      : { headline: "その駒は、そこへは動けません", detail: null };
  }
  const lastTurn = state.turns.at(-1);
  const reply = lastTurn?.defenderMove;
  const captured =
    reply !== undefined &&
    reply !== null &&
    getTsumeShogiPieceAt(lastTurn!.positionAfterAttack, reply.to) !== null;
  return {
    headline: captured
      ? "守られていない駒を\n玉に取られました"
      : "逃げ道が残っていました",
    detail: "待ったを押すと、その王手の前に戻せます",
  };
}

/**
 * 手を離した後、手が止まったときに示す次の手。玉方に逃げられてこの手数では詰まないときは待った、
 * そうでなければ残りの手数以内に詰む王手。応手を待つ間と、詰んだ後は `null`。
 */
export function findTsumeShogiTutorialHint(
  state: TsumeShogiTutorialBoardState,
): TsumeShogiTutorialTarget | null {
  const phase = getTsumeShogiSessionPhase(state);
  if (phase === "refuted") {
    return { type: "undo" };
  }
  if (phase !== "attacker") {
    return null;
  }
  if (isTsumeShogiSessionOnWrongLine(state)) {
    return { type: "undo" };
  }
  const position = state.puzzleState;
  const remainingPlies = getTsumeShogiSessionRemainingPlies(state);
  const expected = problem.mainLine[problem.plies - remainingPlies];
  const checks = listTsumeShogiAttackerChecks(position);
  const mating =
    checks.find(
      (check) =>
        expected !== undefined && isSameTsumeShogiMove(check, expected),
    ) ??
    checks.find((check) =>
      isTsumeShogiMateWithin(
        applyTsumeShogiMove(position, check),
        remainingPlies - 1,
      ),
    );
  return mating ? { type: "move", move: mating } : null;
}

export const tsumeShogiTutorial: Tutorial<
  TsumeShogiTutorialRuleId,
  TsumeShogiTutorialStep,
  TsumeShogiTutorialBoardState,
  TsumeShogiTutorialAction
> = {
  intro: {
    purpose: "相手の玉を詰ませるパズルです",
    goalCaption:
      "逆向きの駒が相手の駒です\n相手の玉が逃げられない形がゴールです",
    startCaption: "相手の手も入れて\n5手で詰ませます",
  },
  rules: [
    { id: "drop", label: "持駒を打つ" },
    { id: "check", label: "必ず王手" },
    { id: "escape", label: "逃げ道をふさぐ" },
  ],
  steps,
  freePlay: {
    headline: "逃げ道をふさぐ王手で\n詰ませてください",
    detail: null,
  },
  completion: {
    home: {
      headline: "詰みです",
      detail: "どのレベルも、3手か5手で詰む問題です",
    },
    play: {
      headline: "詰みです",
      detail: "プレイ中の問題も、同じルールです",
    },
  },
  start: startTsumeShogiTutorial,
  goal: getTsumeShogiTutorialGoal,
  perform: performTsumeShogiTutorialAction,
  describeViolation: describeTsumeShogiTutorialViolation,
};

export const _private = {
  problem,
  escapeSquare,
  escapingCheck,
  matingMove,
  playMove,
};
