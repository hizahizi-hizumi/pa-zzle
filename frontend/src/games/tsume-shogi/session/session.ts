import { type GameSession, getClearedSessionElapsedMs } from "@/games/session";
import {
  assertTsumeShogiProblem,
  type TsumeShogiProblem,
} from "@/games/tsume-shogi/problem/problem";
import {
  findTsumeShogiLongestResistance,
  findTsumeShogiRefutation,
} from "@/games/tsume-shogi/puzzle/mate-search";
import {
  applyTsumeShogiMove,
  formatTsumeShogiMoveUsi,
  isSameTsumeShogiMove,
  isTsumeShogiCheckmate,
  isTsumeShogiDefenderInCheck,
  isTsumeShogiLegalMove,
  listTsumeShogiAttackerChecks,
  type TsumeShogiMove,
} from "@/games/tsume-shogi/puzzle/moves";
import {
  getTsumeShogiHand,
  getTsumeShogiPieceAt,
  isSameTsumeShogiSquare,
  type TsumeShogiHandPieceType,
  type TsumeShogiPosition,
  type TsumeShogiSquare,
} from "@/games/tsume-shogi/puzzle/position";

/**
 * - `alternative`: 作意ではないが、残りの手数以内に詰む王手。strict validator が採用した問題（攻方の正解が一意）では
 *   起きないが、安全側に詰みへ向かう手として受け、玉方は最も長く逃れる応手を指す。
 * - `wrong`: 残りの手数以内に詰まない王手（誤王手）と、その筋を続けた王手。玉方は詰まなくなる応手（反証）を指す。
 */
export type TsumeShogiTurnLine = "main" | "alternative" | "wrong";

export type TsumeShogiSessionTurn = {
  line: TsumeShogiTurnLine;
  attackerMove: TsumeShogiMove;
  positionAfterAttack: TsumeShogiPosition;
  /** 攻方の手で詰んだときは `null`。 */
  defenderMove: TsumeShogiMove | null;
  /** 詰んだときは `positionAfterAttack` と同じ。 */
  positionAfterDefense: TsumeShogiPosition;
  /** 応手の後に、攻方がこの筋を続けられるか。誤王手の筋で、残りの手数が尽きたか王手が無ければ `false`。 */
  canContinue: boolean;
};

export type TsumeShogiSelection =
  | { type: "board"; square: TsumeShogiSquare }
  | { type: "hand"; pieceType: TsumeShogiHandPieceType };

export type TsumeShogiPromotionChoice = {
  from: TsumeShogiSquare;
  to: TsumeShogiSquare;
};

export type TsumeShogiRejection = {
  reason: "illegal" | "not-check";
  to: TsumeShogiSquare;
};

export type TsumeShogiSessionPhase =
  | "attacker"
  | "defender"
  | "refuted"
  | "cleared";

/**
 * `puzzleState` は盤面に見せている局面。玉方の応手を待っている間は、攻方の手を指した局面。
 * 指した手の組（`turns`）と玉方の応手を待っているかから決まり、どちらかを変えるときに一緒に変える。
 */
export type TsumeShogiSession = GameSession<
  TsumeShogiProblem,
  TsumeShogiPosition
> & {
  turns: readonly TsumeShogiSessionTurn[];
  /** 最後の攻方の手への玉方の応手を、まだ盤面に指していない。 */
  defenderReplyPending: boolean;
  selection: TsumeShogiSelection | null;
  promotionChoice: TsumeShogiPromotionChoice | null;
  /** 直前の入力を着手させなかったときの理由。次の入力で消える。 */
  rejection: TsumeShogiRejection | null;
  /** 盤面・持駒を押して状態が変わった回数。 */
  inputCount: number;
  wrongCheckCount: number;
  /** 誤王手に数えた手。判断地点までの手順と誤王手を USI で並べたもの（`formatWrongCheckKey`）。 */
  countedWrongChecks: readonly string[];
  /** 玉方の反証の応手を盤面で見た回数。誤王手の筋を続けて見た反証も数える。 */
  refutationViewCount: number;
  /** 待ったで誤王手の筋から判断地点へ戻った回数。待った（`undoCount`）の内数。 */
  returnCount: number;
  undoCount: number;
  /** 盤面を初期局面へ戻した回数。 */
  restartCount: number;
  /** 着手させなかった入力（王手にならない手・ルールで指せない手）の回数。 */
  illegalInputCount: number;
};

/** 評価に使うプレイ事実。採点はしない。 */
export type TsumeShogiSessionResult = {
  elapsedMs: number;
  wrongCheckCount: number;
  refutationViewCount: number;
  returnCount: number;
  undoCount: number;
  restartCount: number;
  illegalInputCount: number;
  inputCount: number;
};

export function createTsumeShogiSession(
  problem: TsumeShogiProblem,
  startedAt: number,
): TsumeShogiSession {
  assertTsumeShogiProblem(problem);

  return {
    status: "playing",
    problem,
    puzzleState: problem.initialPosition,
    turns: [],
    defenderReplyPending: false,
    selection: null,
    promotionChoice: null,
    rejection: null,
    startedAt,
    clearedAt: null,
    inputCount: 0,
    wrongCheckCount: 0,
    countedWrongChecks: [],
    refutationViewCount: 0,
    returnCount: 0,
    undoCount: 0,
    restartCount: 0,
    illegalInputCount: 0,
  };
}

function getShownPosition(
  problem: TsumeShogiProblem,
  turns: readonly TsumeShogiSessionTurn[],
  defenderReplyPending: boolean,
): TsumeShogiPosition {
  const lastTurn = turns.at(-1);
  if (!lastTurn) return problem.initialPosition;

  return defenderReplyPending
    ? lastTurn.positionAfterAttack
    : lastTurn.positionAfterDefense;
}

function withTurns(
  session: TsumeShogiSession,
  turns: readonly TsumeShogiSessionTurn[],
  defenderReplyPending: boolean,
): TsumeShogiSession {
  return {
    ...session,
    turns,
    defenderReplyPending,
    puzzleState: getShownPosition(session.problem, turns, defenderReplyPending),
  };
}

export function getTsumeShogiSessionPhase(
  session: TsumeShogiSession,
): TsumeShogiSessionPhase {
  if (session.status === "cleared") return "cleared";
  if (session.defenderReplyPending) return "defender";

  const lastTurn = session.turns.at(-1);
  return lastTurn && !lastTurn.canContinue ? "refuted" : "attacker";
}

export function isTsumeShogiSessionOnWrongLine(
  session: TsumeShogiSession,
): boolean {
  return session.turns.some((turn) => turn.line === "wrong");
}

/**
 * 詰むまでに残っている手数（問題の手数から盤面に指した手を引いたもの）。誤王手の筋で最後の手に王手を続けると、
 * 玉方の応手の分だけ問題の手数を超えるので、0 で止める。
 */
export function getTsumeShogiSessionRemainingPlies(
  session: TsumeShogiSession,
): number {
  return Math.max(
    0,
    session.problem.plies - countTsumeShogiSessionPlayedPlies(session),
  );
}

/**
 * 盤面に指した手の数。玉方の応手を待っている手と、詰めた手には玉方の手が無い。
 * 誤王手の筋で最後の手に王手を続けると、玉方の応手の分だけ問題の手数を超える。
 */
export function countTsumeShogiSessionPlayedPlies(
  session: TsumeShogiSession,
): number {
  const lastTurn = session.turns.at(-1);
  const lastTurnHasNoReply =
    lastTurn !== undefined &&
    (session.defenderReplyPending || lastTurn.defenderMove === null);
  return session.turns.length * 2 - (lastTurnHasNoReply ? 1 : 0);
}

function acceptsAttackerInput(session: TsumeShogiSession): boolean {
  return getTsumeShogiSessionPhase(session) === "attacker";
}

function isSameSelection(
  left: TsumeShogiSelection | null,
  right: TsumeShogiSelection | null,
): boolean {
  if (left === null || right === null) return left === right;
  if (left.type === "board" && right.type === "board") {
    return isSameTsumeShogiSquare(left.square, right.square);
  }
  if (left.type === "hand" && right.type === "hand") {
    return left.pieceType === right.pieceType;
  }
  return false;
}

function changeSelection(
  session: TsumeShogiSession,
  selection: TsumeShogiSelection | null,
): TsumeShogiSession {
  if (
    isSameSelection(session.selection, selection) &&
    session.promotionChoice === null &&
    session.rejection === null
  ) {
    return session;
  }

  return {
    ...session,
    selection,
    promotionChoice: null,
    rejection: null,
    inputCount: session.inputCount + 1,
  };
}

function tryAttackerCheck(
  position: TsumeShogiPosition,
  move: TsumeShogiMove,
): TsumeShogiPosition | TsumeShogiRejection["reason"] {
  if (!isTsumeShogiLegalMove(position, move)) return "illegal";

  const next = applyTsumeShogiMove(position, move);
  return isTsumeShogiDefenderInCheck(next) ? next : "not-check";
}

function reject(
  session: TsumeShogiSession,
  reason: TsumeShogiRejection["reason"],
  to: TsumeShogiSquare,
): TsumeShogiSession {
  return {
    ...session,
    promotionChoice: null,
    rejection: { reason, to },
    inputCount: session.inputCount + 1,
    illegalInputCount: session.illegalInputCount + 1,
  };
}

/**
 * 王手を指す。詰めばクリアにする。詰まなければ玉方の応手を決め、盤面に指すのは `playTsumeShogiSessionDefenderReply` に任せる。
 * - 作意の筋で作意どおりの手なら、玉方は作意の応手を指す。
 * - 残りの手数以内に詰まない手なら誤王手とし、玉方は反証の応手を指す。作意・詰み筋の上から外れた手だけを誤王手に数える。
 * - それ以外（作意ではないが詰む手）は詰み筋として受け、玉方は最も長く逃れる応手を指す。
 */
function playAttackerCheck(
  session: TsumeShogiSession,
  move: TsumeShogiMove,
  positionAfterAttack: TsumeShogiPosition,
  operatedAt: number,
): TsumeShogiSession {
  const base = {
    ...session,
    selection: null,
    promotionChoice: null,
    rejection: null,
    inputCount: session.inputCount + 1,
  };

  if (isTsumeShogiCheckmate(positionAfterAttack)) {
    return {
      ...withTurns(
        base,
        [
          ...session.turns,
          {
            line: isMainLineMove(session, move) ? "main" : "alternative",
            attackerMove: move,
            positionAfterAttack,
            defenderMove: null,
            positionAfterDefense: positionAfterAttack,
            canContinue: false,
          },
        ],
        false,
      ),
      status: "cleared",
      clearedAt: operatedAt,
    };
  }

  const remainingAfterAttack = getTsumeShogiSessionRemainingPlies(session) - 1;
  const { line, defenderMove } = decideDefenderReply(
    session,
    move,
    positionAfterAttack,
    remainingAfterAttack,
  );
  const positionAfterDefense = applyTsumeShogiMove(
    positionAfterAttack,
    defenderMove,
  );
  const wrongCheckKey =
    line === "wrong" && !isTsumeShogiSessionOnWrongLine(session)
      ? formatWrongCheckKey(session.turns, move)
      : null;
  const isNewWrongCheck =
    wrongCheckKey !== null &&
    !session.countedWrongChecks.includes(wrongCheckKey);

  return {
    ...withTurns(
      base,
      [
        ...session.turns,
        {
          line,
          attackerMove: move,
          positionAfterAttack,
          defenderMove,
          positionAfterDefense,
          canContinue:
            line !== "wrong" ||
            (remainingAfterAttack - 1 >= 1 &&
              listTsumeShogiAttackerChecks(positionAfterDefense).length > 0),
        },
      ],
      true,
    ),
    ...(isNewWrongCheck && {
      wrongCheckCount: session.wrongCheckCount + 1,
      countedWrongChecks: [...session.countedWrongChecks, wrongCheckKey],
    }),
  };
}

/** 判断地点までの手順と、そこで指した誤王手を1つの文字列にする。手順が同じなら判断地点の局面も同じ。 */
function formatWrongCheckKey(
  turnsBeforeDecision: readonly TsumeShogiSessionTurn[],
  wrongCheck: TsumeShogiMove,
): string {
  return [
    ...turnsBeforeDecision.flatMap(({ attackerMove, defenderMove }) =>
      defenderMove === null ? [attackerMove] : [attackerMove, defenderMove],
    ),
    wrongCheck,
  ]
    .map(formatTsumeShogiMoveUsi)
    .join(" ");
}

function isMainLineMove(
  session: TsumeShogiSession,
  move: TsumeShogiMove,
): boolean {
  if (session.turns.some((turn) => turn.line !== "main")) return false;

  const expected = session.problem.mainLine[session.turns.length * 2];
  return expected !== undefined && isSameTsumeShogiMove(expected, move);
}

function decideDefenderReply(
  session: TsumeShogiSession,
  move: TsumeShogiMove,
  positionAfterAttack: TsumeShogiPosition,
  remainingAfterAttack: number,
): { line: TsumeShogiTurnLine; defenderMove: TsumeShogiMove } {
  const mainLineReply = session.problem.mainLine[session.turns.length * 2 + 1];
  if (isMainLineMove(session, move) && mainLineReply !== undefined) {
    return { line: "main", defenderMove: mainLineReply };
  }

  const refutation = findTsumeShogiRefutation(
    positionAfterAttack,
    remainingAfterAttack,
  );
  if (refutation) return { line: "wrong", defenderMove: refutation };

  const resistance = findTsumeShogiLongestResistance(
    positionAfterAttack,
    remainingAfterAttack,
  );
  if (!resistance) {
    throw new Error("詰まない王手に玉方の応手がありません");
  }
  return { line: "alternative", defenderMove: resistance };
}

function moveSelectedPiece(
  session: TsumeShogiSession,
  selection: TsumeShogiSelection,
  to: TsumeShogiSquare,
  operatedAt: number,
): TsumeShogiSession {
  const position = session.puzzleState;

  if (selection.type === "hand") {
    const move: TsumeShogiMove = {
      kind: "drop",
      pieceType: selection.pieceType,
      to,
    };
    const result = tryAttackerCheck(position, move);
    return typeof result === "string"
      ? reject(session, result, to)
      : playAttackerCheck(session, move, result, operatedAt);
  }

  const candidates = [false, true].map((promote) => {
    const move: TsumeShogiMove = {
      kind: "board",
      from: selection.square,
      to,
      promote,
    };
    return { move, result: tryAttackerCheck(position, move) };
  });
  const checkCandidates = candidates.flatMap(({ move, result }) =>
    typeof result === "string" ? [] : [{ move, result }],
  );
  // 成・不成のうち王手になる方だけを候補にする。両方が王手になるときだけ選ばせ、1つなら選ばせずにその手を指す
  // （王手にならない手は着手させない、という決まりに選択肢もそろえる）。
  if (checkCandidates.length === 2) {
    return {
      ...session,
      promotionChoice: { from: selection.square, to },
      rejection: null,
      inputCount: session.inputCount + 1,
    };
  }
  const [onlyCheck] = checkCandidates;
  if (onlyCheck) {
    return playAttackerCheck(
      session,
      onlyCheck.move,
      onlyCheck.result,
      operatedAt,
    );
  }
  const rejectedReason = candidates
    .map(({ result }) => result)
    .find((result) => typeof result === "string" && result !== "illegal");
  if (typeof rejectedReason === "string") {
    return reject(session, rejectedReason, to);
  }

  return reject(session, "illegal", to);
}

export function tapTsumeShogiSessionSquare(
  session: TsumeShogiSession,
  square: TsumeShogiSquare,
  operatedAt: number,
): TsumeShogiSession {
  if (!acceptsAttackerInput(session)) return session;
  if (session.promotionChoice) {
    return cancelTsumeShogiSessionPromotion(session);
  }

  const piece = getTsumeShogiPieceAt(session.puzzleState, square);
  const { selection } = session;
  if (piece?.side === "attacker") {
    const tapsSelectedSquare =
      selection?.type === "board" &&
      isSameTsumeShogiSquare(selection.square, square);
    return changeSelection(
      session,
      tapsSelectedSquare ? null : { type: "board", square },
    );
  }
  if (!selection) {
    return session.rejection ? { ...session, rejection: null } : session;
  }

  return moveSelectedPiece(session, selection, square, operatedAt);
}

export function tapTsumeShogiSessionHand(
  session: TsumeShogiSession,
  pieceType: TsumeShogiHandPieceType,
): TsumeShogiSession {
  if (!acceptsAttackerInput(session)) return session;

  const hand = getTsumeShogiHand(session.puzzleState, "attacker");
  if (hand[pieceType] <= 0) return session;

  const { selection } = session;
  const tapsSelected =
    selection?.type === "hand" && selection.pieceType === pieceType;
  return changeSelection(
    session,
    tapsSelected ? null : { type: "hand", pieceType },
  );
}

export function chooseTsumeShogiSessionPromotion(
  session: TsumeShogiSession,
  promote: boolean,
  operatedAt: number,
): TsumeShogiSession {
  const choice = session.promotionChoice;
  if (!choice || !acceptsAttackerInput(session)) return session;

  const move: TsumeShogiMove = {
    kind: "board",
    from: choice.from,
    to: choice.to,
    promote,
  };
  const result = tryAttackerCheck(session.puzzleState, move);
  if (typeof result === "string") return reject(session, result, choice.to);

  return playAttackerCheck(session, move, result, operatedAt);
}

export function cancelTsumeShogiSessionPromotion(
  session: TsumeShogiSession,
): TsumeShogiSession {
  if (!session.promotionChoice) return session;

  return {
    ...session,
    promotionChoice: null,
    inputCount: session.inputCount + 1,
  };
}

export function clearTsumeShogiSessionSelection(
  session: TsumeShogiSession,
): TsumeShogiSession {
  if (!acceptsAttackerInput(session)) return session;

  return changeSelection(session, null);
}

export function playTsumeShogiSessionDefenderReply(
  session: TsumeShogiSession,
): TsumeShogiSession {
  if (!session.defenderReplyPending) return session;

  const lastTurn = session.turns.at(-1);
  return {
    ...withTurns(session, session.turns, false),
    refutationViewCount:
      session.refutationViewCount + (lastTurn?.line === "wrong" ? 1 : 0),
  };
}

function resetBoardState(
  session: TsumeShogiSession,
  turns: readonly TsumeShogiSessionTurn[],
): TsumeShogiSession {
  return {
    ...withTurns(session, turns, false),
    selection: null,
    promotionChoice: null,
    rejection: null,
  };
}

export function undoTsumeShogiSession(
  session: TsumeShogiSession,
): TsumeShogiSession {
  if (!canUndoTsumeShogiSession(session)) return session;

  const firstWrong = session.turns.findIndex((turn) => turn.line === "wrong");
  const returnsToDecision = firstWrong >= 0;
  return {
    ...resetBoardState(
      session,
      session.turns.slice(0, returnsToDecision ? firstWrong : -1),
    ),
    undoCount: session.undoCount + 1,
    returnCount: session.returnCount + (returnsToDecision ? 1 : 0),
  };
}

export function canUndoTsumeShogiSession(session: TsumeShogiSession): boolean {
  return session.status === "playing" && session.turns.length > 0;
}

export function restartTsumeShogiSession(
  session: TsumeShogiSession,
): TsumeShogiSession {
  if (!canRestartTsumeShogiSession(session)) return session;

  return {
    ...resetBoardState(session, []),
    restartCount: session.restartCount + 1,
  };
}

export function canRestartTsumeShogiSession(
  session: TsumeShogiSession,
): boolean {
  return session.status === "playing" && session.turns.length > 0;
}

export function getTsumeShogiSessionResult(
  session: TsumeShogiSession,
): TsumeShogiSessionResult | null {
  const elapsedMs = getClearedSessionElapsedMs(session);
  if (elapsedMs === null) {
    return null;
  }

  return {
    elapsedMs,
    wrongCheckCount: session.wrongCheckCount,
    refutationViewCount: session.refutationViewCount,
    returnCount: session.returnCount,
    undoCount: session.undoCount,
    restartCount: session.restartCount,
    illegalInputCount: session.illegalInputCount,
    inputCount: session.inputCount,
  };
}
