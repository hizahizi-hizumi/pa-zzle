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
  findTsumeShogiDefenderKing,
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

export type TsumeShogiTutorialRuleId = "check" | "capture" | "hand";

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

/**
 * 手順で指させる手、または押させる操作。
 * - `move`: 攻方の手。駒（持駒）と行き先の升の両方に印を付ける。
 * - `choice`: 攻方の手。駒（持駒）にだけ印を付け、行き先は自分で選ばせる。`move` は手順を進める手で、成・不成は問わない。
 *   ほかの王手を指すと本番と同じく玉方が逃れ、待ったで戻すまで手順を進めない。
 *   `choosingMessage` は、駒を選んで行き先を探す間の一言。行き先に印が出ない代わりに、王手の升を自分で選ぶことを伝える。
 * - `undo`: 待った。
 */
export type TsumeShogiTutorialTarget =
  | { type: "move"; move: TsumeShogiMove }
  | { type: "choice"; move: TsumeShogiMove; choosingMessage: TutorialMessage }
  | { type: "undo" };

/**
 * - `target`: 印を付け、手順の間だけ受け付ける手。手の後に玉方が応じたら次の手順へ進む。待ったは押したら進む。
 * - `keySquares`: その手を決める物（決め手）として、押す所と一緒に覆いから抜く升。操作だけを教える手順と待ったの手順では空にし、覆わない。
 * - `strayMessage`: 印の無い所が押されたときの一言。手順の一言のままでは押した手が黙って無視されたように見える手順で、
 *   今は何を指す手順かを言い直す。`null` なら手順の一言のまま印を濃くし直す。
 */
export type TsumeShogiTutorialStep = TutorialStep<TsumeShogiTutorialRuleId> & {
  target: TsumeShogiTutorialTarget;
  keySquares: readonly TsumeShogiSquare[];
  strayMessage: TutorialMessage | null;
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
 * 盤の左上の隅で、飛を打ち、銀を捨て、金で飛を取って、取った飛を打って詰ませる7手詰。玉方の応手はどれも1つに決まる。
 *
 * ```text
 * 始まり                 5手目の前            ゴール（詰み）
 *   9  8  7  6            9  8  7  6           9  8  7  6
 *   .  玉v 銀 銀  一      .  .  玉v .  一      .  .  .  .  一
 *   飛v .  .  .   二      .  .  飛v .  二      .  .  玉v .  二
 *   .  .  金 香   三      .  飛 金 香  三      .  飛 飛 香  三
 * 持駒: 飛               持駒: なし           持駒: なし
 * ```
 */
const problem: TsumeShogiProblem = {
  initialPosition: createTsumeShogiPosition("1kSS5/r8/2GL5/9/9/9/9/9/9", {
    rook: 1,
  }),
  plies: 7,
  mainLine: ["R*8c", "8a7a", "6a7b", "9b7b", "7c7b", "7a7b", "R*7c"].map(
    parseTsumeShogiMoveUsi,
  ),
};

const [rookDrop, , silverCheck, , goldCapture, , matingDrop] =
  problem.mainLine as [
    TsumeShogiMove,
    TsumeShogiMove,
    TsumeShogiMove,
    TsumeShogiMove,
    TsumeShogiMove,
    TsumeShogiMove,
    TsumeShogiMove,
  ];

/** 金で飛を取る手の前に、金を飛の隣へ上げる王手。王手した金を飛に取られ、この手数では詰まなくなる。 */
const capturedCheck = parseTsumeShogiMoveUsi("7c8b");

/** 5手目の前で、金の王手を取る玉方の飛の升。 */
const defenderRookSquare: TsumeShogiSquare = { file: 7, rank: 2 };

/** 銀で王手をかける玉の升。玉は5手目の前もこの升にいる。 */
const kingSquareBeforeSilverCheck: TsumeShogiSquare = { file: 7, rank: 1 };

const steps: readonly TsumeShogiTutorialStep[] = [
  {
    message: {
      headline: "印の駒を押してから印の升を押して指します",
      detail: "次の手は動かす升を選びます",
    },
    introducedRuleId: null,
    target: { type: "move", move: rookDrop },
    keySquares: [],
    strayMessage: null,
  },
  {
    message: {
      headline: "自分の番はいつも王手をかけます",
      detail: "玉は7一の銀を取りました",
    },
    introducedRuleId: "check",
    target: {
      type: "choice",
      move: silverCheck,
      choosingMessage: {
        headline: "王手になる升を選びます",
        detail: "銀は前と斜め4方へ1升動けます",
      },
    },
    keySquares: [kingSquareBeforeSilverCheck],
    strayMessage: null,
  },
  {
    message: {
      headline: "次に金で王手をかけると金を取られて詰まなくなります",
      detail: "印の升へ金を動かします",
    },
    introducedRuleId: "capture",
    target: { type: "move", move: capturedCheck },
    keySquares: [defenderRookSquare],
    strayMessage: {
      headline: "先に取られる王手を\n試してみます",
      detail: "印の升へ金を動かします",
    },
  },
  {
    message: {
      headline: "詰まなくなったら待ったボタンを押して王手の前に戻します",
      detail: "この王手は本番でミスになります",
    },
    introducedRuleId: null,
    target: { type: "undo" },
    keySquares: [],
    strayMessage: null,
  },
  {
    message: {
      headline: "相手の駒を取ると\n自分の持駒になります",
      detail: "王手した駒を取られても次に詰めば良い手です",
    },
    introducedRuleId: "hand",
    target: {
      type: "choice",
      move: goldCapture,
      choosingMessage: {
        headline: "王手になる升を選びます",
        detail: "王手した駒を取られても次に詰めば良い手です",
      },
    },
    keySquares: [kingSquareBeforeSilverCheck],
    strayMessage: null,
  },
];

/** 入口から完成までの段の数。手順の数と、手を離した後に詰ませる1段。 */
export const TSUME_SHOGI_TUTORIAL_PROGRESS_STEP_COUNT = steps.length + 1;

/** 手を離す時点で盤面に指してある手の組の数。 */
const RELEASED_TURN_COUNT = 3;

function startTsumeShogiTutorial(): TsumeShogiTutorialBoardState {
  return createTsumeShogiSession(problem, 0);
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

/** 作意を最後まで指した、詰み上がりの盤面。 */
function getTsumeShogiTutorialGoal(): TsumeShogiTutorialBoardState {
  return problem.mainLine
    .filter((_, index) => index % 2 === 0)
    .reduce(
      (session, move) =>
        playTsumeShogiSessionDefenderReply(playMove(session, move)),
      startTsumeShogiTutorial(),
    );
}

function applyInput(
  state: TsumeShogiTutorialBoardState,
  action: Extract<
    TsumeShogiTutorialAction,
    { type: "square" } | { type: "hand" } | { type: "promotion" }
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

/** 同じ駒（持駒）を同じ升へ指す手か。成・不成は問わない。 */
function isSameDestinationMove(
  left: TsumeShogiMove,
  right: TsumeShogiMove,
): boolean {
  if (!isSameTsumeShogiSquare(left.to, right.to)) {
    return false;
  }
  if (left.kind === "drop" || right.kind === "drop") {
    return (
      left.kind === "drop" &&
      right.kind === "drop" &&
      left.pieceType === right.pieceType
    );
  }
  return isSameTsumeShogiSquare(left.from, right.from);
}

function getSourceMark(move: TsumeShogiMove): TsumeShogiTutorialMark {
  return move.kind === "drop"
    ? { type: "hand", pieceType: move.pieceType }
    : { type: "square", square: move.from };
}

/**
 * 手に印を付ける所。駒（持駒）を選ぶまでは駒に、選んだら行き先の升に付ける。行き先を自分で選ばせる手は、駒にだけ付ける。
 * 玉方の応手を待つ間と、詰んだ後は付けない。行き先を自分で選ばせる手で、ほかの王手を逃れられた後は待ったに付ける。
 */
export function getTsumeShogiTutorialMark(
  target: TsumeShogiTutorialTarget,
  state: TsumeShogiTutorialBoardState,
): TsumeShogiTutorialMark | null {
  if (target.type === "undo") {
    return canUndoTsumeShogiSession(state) ? { type: "undo" } : null;
  }
  const phase = getTsumeShogiSessionPhase(state);
  if (
    target.type === "choice" &&
    (phase === "refuted" ||
      (phase === "attacker" && isTsumeShogiSessionOnWrongLine(state)))
  ) {
    return { type: "undo" };
  }
  if (phase !== "attacker") {
    return null;
  }
  const { move } = target;
  if (!isSourceSelected(state, move)) {
    return getSourceMark(move);
  }
  return target.type === "move" ? { type: "square", square: move.to } : null;
}

function isTowardMarkedMove(
  state: TsumeShogiTutorialBoardState,
  target: Extract<TsumeShogiTutorialTarget, { type: "move" }>,
  action: TsumeShogiTutorialAction,
): boolean {
  const mark = getTsumeShogiTutorialMark(target, state);
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
 * 行き先を自分で選ばせる手で受け付ける操作か。印の駒を選ぶ操作と、選んだ駒を盤の升へ指す操作と、成・不成を選ぶ操作。
 * 選んだ駒をもう一度押して選択を外す操作も受け付ける。
 */
function isTowardChosenMove(
  state: TsumeShogiTutorialBoardState,
  move: TsumeShogiMove,
  action: TsumeShogiTutorialAction,
): boolean {
  if (isTsumeShogiSessionOnWrongLine(state)) {
    return false;
  }
  const selected = isSourceSelected(state, move);
  const source = getSourceMark(move);
  switch (action.type) {
    case "square":
      return (
        selected ||
        (source.type === "square" &&
          isSameTsumeShogiSquare(source.square, action.square))
      );
    case "hand":
      return source.type === "hand" && source.pieceType === action.pieceType;
    case "promotion":
      return selected;
    case "undo":
    case "defender-reply":
      return false;
  }
}

/** 玉方の応手を盤面に指す。手順を進める手への応手なら次の手順へ、ほかの王手への応手（反証）ならルールに合わない手として返す。 */
function replyAsDefender(
  target: TsumeShogiTutorialTarget,
  state: TsumeShogiTutorialBoardState,
): { state: TsumeShogiTutorialBoardState; outcome: TutorialMoveOutcome } {
  if (!state.defenderReplyPending) {
    return { state, outcome: "ignored" };
  }
  const next = playTsumeShogiSessionDefenderReply(state);
  const played = next.turns.at(-1)?.attackerMove;
  if (target.type === "undo" || played === undefined) {
    return { state: next, outcome: "continued" };
  }
  if (target.type === "move" || isSameDestinationMove(played, target.move)) {
    return { state: next, outcome: "stepped" };
  }
  return { state: next, outcome: "violated" };
}

/**
 * 手を引いている間は、印の駒を選び、印の升へ指す操作と、待ったの手順の待ったを受け付ける。
 * 行き先を自分で選ばせる手では、印の駒をどの升へ指す操作も受け付け、本番と同じく盤面が応える。
 * 王手を伝えた後は、王手にならない手を本番と同じく着手させず、違反として返す。ほかの王手を逃れられたら、待ったで戻させる。
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
    return replyAsDefender(target, state);
  }
  if (action.type === "undo") {
    if (!canUndoTsumeShogiSession(state)) {
      return { state, outcome: "ignored" };
    }
    if (target.type === "undo") {
      return { state: undoTsumeShogiSession(state), outcome: "stepped" };
    }
    return target.type === "choice" && isTsumeShogiSessionOnWrongLine(state)
      ? { state: undoTsumeShogiSession(state), outcome: "continued" }
      : { state, outcome: "ignored" };
  }
  if (target.type === "undo") {
    return { state, outcome: "ignored" };
  }
  const toward =
    target.type === "move"
      ? isTowardMarkedMove(state, target, action)
      : isTowardChosenMove(state, target.move, action);
  if (!toward) {
    return { state, outcome: "ignored" };
  }
  const next = applyInput(state, action);
  if (next === state) {
    return { state, outcome: "ignored" };
  }
  if (isNewlyRejected(state, next)) {
    return earnedRuleIds.includes("check")
      ? { state: next, outcome: "violated" }
      : { state, outcome: "ignored" };
  }
  return { state: next, outcome: "continued" };
}

/**
 * 手を離した後は、本番と同じく盤面が応える。着手させなかった手と、逃れられた王手には、そのわけの一言を添える。
 * 待ったは、逃れられた王手を戻すときだけ受け付け、手を離す前の手順へは戻さない。
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
      return canUndoTsumeShogiSession(state) &&
        state.turns.length > RELEASED_TURN_COUNT
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

/**
 * 着手させなかった手と、逃れられた王手のわけ。王手した駒を取られて逃れられたときはそのことを、
 * 玉が動いて逃れたとき（ほかの駒を取って逃れたときも）は逃げ道が残っていたことを言う。
 */
function describeTsumeShogiTutorialViolation(
  _situation: TsumeShogiTutorialSituation,
  state: TsumeShogiTutorialBoardState,
): TutorialMessage {
  const { rejection, selection } = state;
  if (rejection?.reason === "not-check") {
    return {
      headline: "王手になっていません",
      detail: "王手になる升へ動かします",
    };
  }
  if (rejection?.reason === "illegal") {
    return selection?.type === "hand"
      ? { headline: "持駒は空いた升へ打ちます", detail: null }
      : {
          headline: "その升へは届きません",
          detail: "駒の動きは遊び方で見られます",
        };
  }
  const refutedTurn = state.turns.find((turn) => turn.line === "wrong");
  const checkingPieceCaptured =
    refutedTurn?.defenderMove !== undefined &&
    refutedTurn.defenderMove !== null &&
    isSameTsumeShogiSquare(
      refutedTurn.defenderMove.to,
      refutedTurn.attackerMove.to,
    );
  return {
    headline: checkingPieceCaptured
      ? "王手した駒を取られて\n詰まなくなりました"
      : "玉に逃げ道が\n残っていました",
    detail: "待ったボタンを押して王手の前に戻します",
  };
}

/**
 * 手を離した後に「ヒント」で示す手。逃れられた王手の後は待った、そうでなければ残りの手数のうちに詰む王手。
 * 応手を待つ間と、詰んだ後は `null`。
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

/** 手がかりの王手の決め手。王手をかける玉。 */
export function getTsumeShogiTutorialHintKeySquares(
  state: TsumeShogiTutorialBoardState,
): readonly TsumeShogiSquare[] {
  return [findTsumeShogiDefenderKing(state.puzzleState)];
}

/** 入口から完成までの進み具合（0〜1）。終えた手順の数の割合。 */
export function getTsumeShogiTutorialProgressRatio(stepIndex: number): number {
  return stepIndex / TSUME_SHOGI_TUTORIAL_PROGRESS_STEP_COUNT;
}

export const tsumeShogiTutorial: Tutorial<
  TsumeShogiTutorialRuleId,
  TsumeShogiTutorialStep,
  TsumeShogiTutorialBoardState,
  TsumeShogiTutorialAction
> = {
  intro: {
    purpose: "相手の玉を詰ませるパズルです",
    goalCaption: "逆向きの駒が相手の駒です\n玉の逃げ道をなくすと詰みです",
  },
  rules: [
    { id: "check", label: "自分の番はいつも王手をかけます" },
    { id: "capture", label: "取られて詰まなくなる王手もあります" },
    { id: "hand", label: "相手の駒を取ると自分の持駒になります" },
  ],
  steps,
  freePlay: {
    headline: "続けて詰ませてみましょう",
    detail: "飛車は縦横にどこまでも進めます",
  },
  completion: {
    home: {
      headline: "詰みです",
      detail: "本番は3手か5手で詰む問題です",
    },
    play: {
      headline: "詰みです",
      detail: "プレイ中の問題と同じルールです",
    },
  },
  start: startTsumeShogiTutorial,
  goal: getTsumeShogiTutorialGoal,
  perform: performTsumeShogiTutorialAction,
  describeViolation: describeTsumeShogiTutorialViolation,
};

export const _private = {
  problem,
  capturedCheck,
  defenderRookSquare,
  matingDrop,
  playMove,
  RELEASED_TURN_COUNT,
};
