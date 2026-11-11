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
 * - `check`: 攻方は毎回、王手をかける。王手にならない手は指せない。
 * - `drop`: 持駒は、空いた升に打てる。
 */
export type TsumeShogiTutorialRuleId = "check" | "drop";

/**
 * 利用者の1回の操作と、盤面に玉方の応手を指すこと。
 * - `square` / `hand`: 盤の升・攻方の持駒を押す。本番と同じく、駒を選んでから行き先の升を押すと指す。
 * - `promotion`: 成・不成を選ぶ。
 * - `undo`: 待った。
 * - `defender-reply`: 攻方が指してから間を置いて、決めてある玉方の応手を盤面に指す。
 */
export type TsumeShogiTutorialAction =
  | { type: "square"; square: TsumeShogiSquare }
  | { type: "hand"; pieceType: TsumeShogiHandPieceType }
  | { type: "promotion"; promote: boolean }
  | { type: "undo" }
  | { type: "defender-reply" };

/**
 * `move` の駒（持駒）、行き先の升の順に指で指して押させ、指した手に玉方が応じたら次の手順へ進む。
 * - `destinationMessage`: 駒を選んだ後の一言。選んでから行き先を押すまでが別の操作だと教える手順だけが持ち、無ければ `message` のままにする。
 */
export type TsumeShogiTutorialStep = TutorialStep<TsumeShogiTutorialRuleId> & {
  move: TsumeShogiMove;
  destinationMessage: TutorialMessage | null;
};

/**
 * 本番のプレイと同じ1回のプレイの状態。盤面の反応（選んだ駒、着手させなかった手の揺れ、玉方の応手と反証、
 * この手数では詰まないという知らせ、待った）を本番と同じ遷移で返すため、`session/` の状態をそのまま使う。
 * 経過時間は測らない。
 */
export type TsumeShogiTutorialBoardState = TsumeShogiSession;

export type TsumeShogiTutorialSituation = TutorialSituation<
  TsumeShogiTutorialRuleId,
  TsumeShogiTutorialStep
>;

/**
 * 指で指す所。
 * - `square`: 盤の升。指す駒の升か、選んだ駒の行き先。
 * - `hand`: 攻方の持駒。
 * - `undo`: 待った。
 */
export type TsumeShogiTutorialCue =
  | { type: "square"; square: TsumeShogiSquare }
  | { type: "hand"; pieceType: TsumeShogiHandPieceType }
  | { type: "undo" };

/**
 * 盤の右上で、金と、1筋と五段を守る飛で玉を囲う7手詰。玉方の応手はどれも玉の移動で、駒を取らず、合駒も出ない。
 * 手順の2手（▲1二金・▲4三金打）は、どちらもその局面でただ1つの詰みへ向かう王手で、玉の横から王手する。
 * 指で指す行き先の下の升は空いていて、指が王手をかける玉を隠さない。
 * 手を離した後の▲2五金打は、玉の上から押さえる王手（▲2三金打など）では玉が逃げるので、
 * 下から打って玉を2三へ戻す手を盤面を読んで見つけさせる。最後は8通りの王手のうち3通りだけが詰む。
 *
 * ```text
 * 始まり                  詰み
 *   4  3  2  1              4  3  2  1
 *   .  .  .  金  一          .  .  .  .  一
 *   金 .  玉v .  二          金 .  .  .  二
 *   .  .  .  .  三          金 .  玉v 金  三
 *   .  .  .  .  四          .  .  .  .  四
 *   .  .  .  飛  五          .  .  金 飛  五
 * 持駒: 金2               持駒: なし
 * ```
 */
const problem: TsumeShogiProblem = {
  initialPosition: createTsumeShogiPosition("8G/5G1k1/9/9/8R/9/9/9/9", {
    gold: 2,
  }),
  plies: 7,
  mainLine: ["1a1b", "2b3c", "G*4c", "3c2d", "G*2e", "2d2c", "1b1c"].map(
    parseTsumeShogiMoveUsi,
  ),
};

const attackerMainLine = problem.mainLine.filter((_, index) => index % 2 === 0);

/**
 * 盤上の金を動かして王手する操作を教えてから、持駒の金を打って王手する。
 * 王手にならない手が指せないことは、手を離した後にそうなったときに、盤面の反応に一言を添えて伝える。
 */
const steps: readonly TsumeShogiTutorialStep[] = [
  {
    message: { headline: "この金を押します", detail: null },
    destinationMessage: {
      headline: "印の升を押して\n王手をかけます",
      detail: null,
    },
    introducedRuleId: "check",
    move: attackerMainLine[0]!,
  },
  {
    message: { headline: "持駒は空いた升に打てます", detail: null },
    destinationMessage: null,
    introducedRuleId: "drop",
    move: attackerMainLine[1]!,
  },
];

/** 入口から完成までの段の数。攻方の手の数で、手順の手と、手を離した後に自分で指す手を合わせたもの。 */
export const TSUME_SHOGI_TUTORIAL_PROGRESS_STEP_COUNT = attackerMainLine.length;

function startTsumeShogiTutorial(): TsumeShogiTutorialBoardState {
  return createTsumeShogiSession(problem, 0);
}

/** 作意を最後まで指した、詰み上がりの盤面。 */
function getTsumeShogiTutorialGoal(): TsumeShogiTutorialBoardState {
  return attackerMainLine.reduce(
    (session, move) =>
      playTsumeShogiSessionDefenderReply(playMove(session, move)),
    startTsumeShogiTutorial(),
  );
}

/** 駒（持駒）を選び、行き先の升を押して、攻方の手を指す。 */
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

/** 手を選ぶ操作を、本番と同じ遷移で盤面に返す。 */
function applyInput(
  state: TsumeShogiTutorialBoardState,
  action: Extract<
    TsumeShogiTutorialAction,
    { type: "square" | "hand" | "promotion" }
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

/** 手の駒（持駒）を選んでいるか。 */
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
 * 手を指すために次に押す所。駒（持駒）を選ぶまでは駒を、選んだら行き先の升を指す。
 * 玉方の応手を待つ間と、詰んだ後は `null`。
 */
function getMoveCue(
  move: TsumeShogiMove,
  state: TsumeShogiTutorialBoardState,
): TsumeShogiTutorialCue | null {
  if (getTsumeShogiSessionPhase(state) !== "attacker") {
    return null;
  }
  if (isSourceSelected(state, move)) {
    return { type: "square", square: move.to };
  }
  return move.kind === "drop"
    ? { type: "hand", pieceType: move.pieceType }
    : { type: "square", square: move.from };
}

/** 手順で指で指す所。 */
export function getTsumeShogiTutorialStepCue(
  step: TsumeShogiTutorialStep,
  state: TsumeShogiTutorialBoardState,
): TsumeShogiTutorialCue | null {
  return getMoveCue(step.move, state);
}

/**
 * 手順の一言。駒を選んだ後は、その手順が行き先の一言を持っていれば替える。
 * 指した後、玉方が応じて次の手順へ進むまでも行き先の一言のままにし、駒を選ぶ前の一言へ戻さない。
 */
export function describeTsumeShogiTutorialStep(
  step: TsumeShogiTutorialStep,
  state: TsumeShogiTutorialBoardState,
): TutorialMessage {
  return isSourceSelected(state, step.move) || state.defenderReplyPending
    ? (step.destinationMessage ?? step.message)
    : step.message;
}

/**
 * 待ったを受け付けるか。手を離した後に指した手だけを戻せる。手順の手は、指した盤面から手を離すので戻さない。
 */
export function canUndoTsumeShogiTutorial(
  state: TsumeShogiTutorialBoardState,
): boolean {
  if (!canUndoTsumeShogiSession(state)) {
    return false;
  }
  return (
    isTsumeShogiSessionOnWrongLine(state) || state.turns.length > steps.length
  );
}

/** 玉方が誤王手に逃れた後か。待ったで戻すまで、詰まない筋にいる。 */
function isEscaped(state: TsumeShogiTutorialBoardState): boolean {
  return isTsumeShogiSessionOnWrongLine(state) && !state.defenderReplyPending;
}

/** 手順の手のための入力か。駒（持駒）を選ぶ操作と、選んだ後に行き先の升を押す操作。 */
function isTowardStepMove(
  state: TsumeShogiTutorialBoardState,
  move: TsumeShogiMove,
  action: TsumeShogiTutorialAction,
): boolean {
  const cue = getMoveCue(move, state);
  switch (action.type) {
    case "square":
      return (
        cue?.type === "square" &&
        isSameTsumeShogiSquare(cue.square, action.square)
      );
    case "hand":
      return cue?.type === "hand" && cue.pieceType === action.pieceType;
    case "promotion":
    case "undo":
    case "defender-reply":
      return false;
  }
}

/**
 * 手を引いている間は、指で指した駒を選び、指した升へ指す操作だけを受け付ける。
 * 指した手に玉方が応じたら次の手順へ進む。それ以外の操作は盤面を変えない。
 */
function performGuided(
  step: TsumeShogiTutorialStep,
  state: TsumeShogiTutorialBoardState,
  action: TsumeShogiTutorialAction,
): { state: TsumeShogiTutorialBoardState; outcome: TutorialMoveOutcome } {
  if (action.type === "defender-reply") {
    return state.defenderReplyPending
      ? { state: playTsumeShogiSessionDefenderReply(state), outcome: "stepped" }
      : { state, outcome: "ignored" };
  }
  if (
    action.type === "undo" ||
    action.type === "promotion" ||
    !isTowardStepMove(state, step.move, action)
  ) {
    return { state, outcome: "ignored" };
  }
  return { state: applyInput(state, action), outcome: "continued" };
}

/**
 * 手を離した後は、本番と同じく盤面が応える。着手させなかった手は、ルールに合わない手として返す。
 * 玉方が誤王手に逃れたことは、手の結果ではなく盤面の状態として一言を替える（`describeTsumeShogiTutorialFreePlay`）。
 */
function performFree(
  state: TsumeShogiTutorialBoardState,
  action: TsumeShogiTutorialAction,
): { state: TsumeShogiTutorialBoardState; outcome: TutorialMoveOutcome } {
  switch (action.type) {
    case "defender-reply":
      return state.defenderReplyPending
        ? {
            state: playTsumeShogiSessionDefenderReply(state),
            outcome: "continued",
          }
        : { state, outcome: "ignored" };
    case "undo":
      return canUndoTsumeShogiTutorial(state)
        ? { state: undoTsumeShogiSession(state), outcome: "continued" }
        : { state, outcome: "ignored" };
    case "square":
    case "hand":
    case "promotion": {
      const next = applyInput(state, action);
      if (next === state) {
        return { state, outcome: "ignored" };
      }
      if (next.rejection !== null && next.rejection !== state.rejection) {
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
  { step }: TsumeShogiTutorialSituation,
  state: TsumeShogiTutorialBoardState,
  action: TsumeShogiTutorialAction,
): { state: TsumeShogiTutorialBoardState; outcome: TutorialMoveOutcome } {
  return step ? performGuided(step, state, action) : performFree(state, action);
}

/** 着手させなかった手のわけ。 */
function describeTsumeShogiTutorialViolation(
  _situation: TsumeShogiTutorialSituation,
  { rejection, selection }: TsumeShogiTutorialBoardState,
): TutorialMessage {
  if (rejection?.reason === "not-check") {
    return { headline: "王手にならない手は指せません", detail: null };
  }
  return selection?.type === "hand"
    ? { headline: "そこには打てません", detail: null }
    : { headline: "その駒はそこには動けません", detail: null };
}

const escapedMessage: TutorialMessage = {
  headline: "玉に逃げられました\n待ったを押して戻しましょう",
  detail: null,
};

const capturedMessage: TutorialMessage = {
  headline: "玉に駒を取られました\n待ったを押して戻しましょう",
  detail: null,
};

/** 玉方の最後の応手が、攻方の駒を取る手だったか。盤面から駒が1つ消えるので、逃げたとだけは言わない。 */
function isLastReplyCapture(state: TsumeShogiTutorialBoardState): boolean {
  const lastTurn = state.turns.at(-1);
  const reply = lastTurn?.defenderMove;
  return (
    lastTurn !== undefined &&
    reply !== null &&
    reply !== undefined &&
    getTsumeShogiPieceAt(lastTurn.positionAfterAttack, reply.to) !== null
  );
}

/** 詰みへ向かって指した攻方の手の数。誤王手とその筋の手は数えない。 */
function countMatingTurns(state: TsumeShogiTutorialBoardState): number {
  return state.turns.filter((turn) => turn.line !== "wrong").length;
}

/** 詰ませるまでに残っている攻方の手の数。 */
function countRemainingAttackerMoves(
  state: TsumeShogiTutorialBoardState,
): number {
  return TSUME_SHOGI_TUTORIAL_PROGRESS_STEP_COUNT - countMatingTurns(state);
}

/**
 * 手を離した後の一言。詰ませるまでに残っている王手の数で応える。
 * 玉方が誤王手に逃れたら、逃げたか駒を取ったかを言い、待ったで戻すことを言う。
 */
export function describeTsumeShogiTutorialFreePlay(
  state: TsumeShogiTutorialBoardState,
): TutorialMessage {
  if (!isEscaped(state)) {
    return describeRemainingChecks(countRemainingAttackerMoves(state));
  }
  return isLastReplyCapture(state) ? capturedMessage : escapedMessage;
}

function describeRemainingChecks(count: number): TutorialMessage {
  return {
    headline: `あと${count}回王手をかけて\n詰ませてみましょう`,
    detail: null,
  };
}

/**
 * 手を離した後に指で指す所。玉方が誤王手に逃れたら、すぐに待ったを指す。
 * `idle` のとき（手が止まったとき）は、残りの手数以内に詰む王手を、作意を先に探して指す。
 * 応手を待つ間と、詰んだ後は `null`。
 */
export function findTsumeShogiTutorialHint(
  state: TsumeShogiTutorialBoardState,
  idle: boolean,
): TsumeShogiTutorialCue | null {
  const phase = getTsumeShogiSessionPhase(state);
  if (phase === "refuted" || (phase === "attacker" && isEscaped(state))) {
    return { type: "undo" };
  }
  if (phase !== "attacker" || !idle) {
    return null;
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
  return mating ? getMoveCue(mating, state) : null;
}

/**
 * 入口から完成までの進み具合（0〜1）。詰みへ向かう攻方の手を1つ指すたびに同じだけ進む。
 * 誤王手とその筋の手は数えないので、待ったで戻しても後戻りしない。
 */
export function getTsumeShogiTutorialProgressRatio(
  state: TsumeShogiTutorialBoardState,
): number {
  return countMatingTurns(state) / TSUME_SHOGI_TUTORIAL_PROGRESS_STEP_COUNT;
}

export const tsumeShogiTutorial: Tutorial<
  TsumeShogiTutorialRuleId,
  TsumeShogiTutorialStep,
  TsumeShogiTutorialBoardState,
  TsumeShogiTutorialAction
> = {
  intro: {
    purpose: "相手の玉を詰ませるパズルです",
    goalCaption: "逆さの駒は相手の駒です\n玉が逃げられなくなったら詰みです",
  },
  rules: [
    { id: "check", label: "自分の番では毎回王手をかけます" },
    { id: "drop", label: "持駒は空いた升に打てます" },
  ],
  steps,
  freePlay: describeRemainingChecks(attackerMainLine.length - steps.length),
  completion: {
    home: {
      headline: "詰みです",
      detail: "どのレベルも同じルールです",
    },
    play: {
      headline: "詰みです",
      detail: "プレイ中の問題も同じルールです",
    },
  },
  start: startTsumeShogiTutorial,
  goal: getTsumeShogiTutorialGoal,
  perform: performTsumeShogiTutorialAction,
  describeViolation: describeTsumeShogiTutorialViolation,
};

export const _private = {
  problem,
  attackerMainLine,
  playMove,
};
