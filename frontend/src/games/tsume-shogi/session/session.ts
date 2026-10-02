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
  explainTsumeShogiIllegalMove,
  formatTsumeShogiMoveUsi,
  isSameTsumeShogiMove,
  isTsumeShogiCheckmate,
  isTsumeShogiDefenderInCheck,
  listTsumeShogiAttackerChecks,
  type TsumeShogiIllegalMoveReason,
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

export type TsumeShogiSessionStatus = "playing" | "cleared";

/**
 * 攻方の1手がどの筋か。
 * - `main`: 作意どおりの王手。玉方は作意の応手を指す。
 * - `alternative`: 作意ではないが、残りの手数以内に詰む王手。strict validator が採用した問題（攻方の正解が一意）では
 *   起きないが、安全側に詰みへ向かう手として受け、玉方は最も長く逃れる応手を指す。
 * - `wrong`: 残りの手数以内に詰まない王手（誤王手）と、その筋を続けた王手。玉方は詰まなくなる応手（反証）を指す。
 */
export type TsumeShogiTurnLine = "main" | "alternative" | "wrong";

/**
 * 攻方の1手と玉方の応手。
 * - `defenderMove`: 玉方の応手。攻方の手で詰んだときは `null`。
 * - `positionAfterDefense`: 玉方の応手の後の局面。詰んだときは `positionAfterAttack` と同じ。
 * - `canContinue`: 応手の後に、攻方がこの筋を続けられるか。誤王手の筋で、残りの手数が尽きたか王手が無ければ `false`。
 */
export type TsumeShogiSessionTurn = {
  line: TsumeShogiTurnLine;
  attackerMove: TsumeShogiMove;
  positionAfterAttack: TsumeShogiPosition;
  defenderMove: TsumeShogiMove | null;
  positionAfterDefense: TsumeShogiPosition;
  canContinue: boolean;
};

/**
 * 選んでいる攻方の駒。
 * - `board`: 盤上の駒。移動先の升を押すと指す。
 * - `hand`: 持駒の種類。空いた升を押すと打つ。
 */
export type TsumeShogiSelection =
  | { type: "board"; square: TsumeShogiSquare }
  | { type: "hand"; pieceType: TsumeShogiHandPieceType };

/** 成と不成のどちらもルール上指せる移動で、どちらにするかを選んでいる途中。 */
export type TsumeShogiPromotionChoice = {
  from: TsumeShogiSquare;
  to: TsumeShogiSquare;
};

/**
 * 着手させなかった入力。`reason` は、王手にならない手（`not-check`）か、ルールで指せない理由。
 */
export type TsumeShogiRejection = {
  reason: "not-check" | TsumeShogiIllegalMoveReason;
  to: TsumeShogiSquare;
};

/**
 * 画面の手番。
 * - `attacker`: 攻方の着手を待っている。
 * - `defender`: 攻方が指し、玉方の応手を盤面に指す前。
 * - `refuted`: 誤王手の筋で、残りの手数が尽きたか王手が無く、これ以上続けられない。待ったで判断地点へ戻る。
 * - `cleared`: 詰んだ。
 */
export type TsumeShogiSessionPhase =
  | "attacker"
  | "defender"
  | "refuted"
  | "cleared";

export type TsumeShogiSession = {
  status: TsumeShogiSessionStatus;
  problem: TsumeShogiProblem;
  turns: readonly TsumeShogiSessionTurn[];
  /** 最後の攻方の手への玉方の応手を、まだ盤面に指していない。 */
  defenderReplyPending: boolean;
  selection: TsumeShogiSelection | null;
  promotionChoice: TsumeShogiPromotionChoice | null;
  /** 直前の入力を着手させなかったときの理由。次の入力で消える。 */
  rejection: TsumeShogiRejection | null;
  startedAt: number;
  finishedAt: number | null;
  /** 盤面・持駒を押して状態が変わった回数。 */
  inputCount: number;
  /**
   * 作意・詰み筋の上の判断地点から、残りの手数以内に詰まない合法な王手を指した回数。同じ判断地点で同じ誤王手を
   * 待った・盤面を戻すで戻して指し直しても、1回だけ数える。
   */
  wrongCheckCount: number;
  /** 誤王手に数えた手。判断地点までの手順と誤王手を USI で並べたもの（`formatWrongCheckKey`）。 */
  countedWrongChecks: readonly string[];
  /** 玉方の反証の応手を盤面で見た回数。誤王手の筋を続けて見た反証も数える。 */
  refutationViewCount: number;
  /** 待ったで誤王手の筋から判断地点へ戻った回数。待った（`undoCount`）の内数。 */
  returnCount: number;
  /** 待ったの回数。誤王手の筋から判断地点へ戻った回数も含む。 */
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
    turns: [],
    defenderReplyPending: false,
    selection: null,
    promotionChoice: null,
    rejection: null,
    startedAt,
    finishedAt: null,
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

/** 盤面に見せる局面。玉方の応手を待っている間は、攻方の手を指した局面。 */
export function getTsumeShogiSessionPosition(
  session: TsumeShogiSession,
): TsumeShogiPosition {
  const lastTurn = session.turns.at(-1);
  if (!lastTurn) return session.problem.initialPosition;

  return session.defenderReplyPending
    ? lastTurn.positionAfterAttack
    : lastTurn.positionAfterDefense;
}

export function getTsumeShogiSessionPhase(
  session: TsumeShogiSession,
): TsumeShogiSessionPhase {
  if (session.status === "cleared") return "cleared";
  if (session.defenderReplyPending) return "defender";

  const lastTurn = session.turns.at(-1);
  return lastTurn && !lastTurn.canContinue ? "refuted" : "attacker";
}

/** 誤王手の筋にいるか。待ったは判断地点まで戻す。 */
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
  return Math.max(0, session.problem.plies - countPlayedPlies(session));
}

/** 盤面に指した手の数。玉方の応手を待っている手と、詰めた手には玉方の手が無い。 */
function countPlayedPlies(session: TsumeShogiSession): number {
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

/** 王手になる合法手なら指した後の局面、ならなければ着手させない理由。 */
function tryAttackerCheck(
  position: TsumeShogiPosition,
  move: TsumeShogiMove,
): TsumeShogiPosition | TsumeShogiRejection["reason"] {
  const illegalReason = explainTsumeShogiIllegalMove(position, move);
  if (illegalReason) return illegalReason;

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
      ...base,
      status: "cleared",
      finishedAt: operatedAt,
      turns: [
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
    ...base,
    turns: [
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
    defenderReplyPending: true,
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

/** 攻方の駒を選ぶ・移動先へ指す・打つ。王手にならない手とルールで指せない手は着手させない。 */
function moveSelectedPiece(
  session: TsumeShogiSession,
  selection: TsumeShogiSelection,
  to: TsumeShogiSquare,
  operatedAt: number,
): TsumeShogiSession {
  const position = getTsumeShogiSessionPosition(session);

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
  const legalCandidates = candidates.filter(
    ({ result }) => typeof result !== "string" || result === "not-check",
  );
  // 成・不成のどちらも指せる移動では、王手になるかどうかに関係なく選ばせる。王手になる方だけを選ばせると、
  // 選択肢が出るかどうかが王手の手がかりになるため。
  if (legalCandidates.length === 2) {
    return {
      ...session,
      promotionChoice: { from: selection.square, to },
      rejection: null,
      inputCount: session.inputCount + 1,
    };
  }
  const [onlyLegal] = legalCandidates;
  if (onlyLegal) {
    return typeof onlyLegal.result === "string"
      ? reject(session, onlyLegal.result, to)
      : playAttackerCheck(
          session,
          onlyLegal.move,
          onlyLegal.result,
          operatedAt,
        );
  }

  const [withoutPromotion] = candidates;
  const illegalReason =
    typeof withoutPromotion?.result === "string"
      ? withoutPromotion.result
      : "unreachable";
  return reject(session, illegalReason, to);
}

/**
 * 盤の升を押す。
 * - 攻方の駒を選んでいなければ、攻方の駒の升で選ぶ。
 * - 盤上の駒を選んでいれば、同じ升で選択を解除し、別の攻方の駒で選び直し、それ以外の升へ指す。
 * - 持駒を選んでいれば、攻方の駒の升で選び直し、それ以外の升へ打つ。
 * - 成・不成を選んでいる途中なら、選ぶのをやめる（駒の選択は残す）。
 */
export function tapTsumeShogiSessionSquare(
  session: TsumeShogiSession,
  square: TsumeShogiSquare,
  operatedAt: number,
): TsumeShogiSession {
  if (!acceptsAttackerInput(session)) return session;
  if (session.promotionChoice) {
    return cancelTsumeShogiSessionPromotion(session);
  }

  const piece = getTsumeShogiPieceAt(
    getTsumeShogiSessionPosition(session),
    square,
  );
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

/** 攻方の持駒を押す。選んでいる種類をもう一度押すと選択を解除する。持っていない種類は選べない。 */
export function tapTsumeShogiSessionHand(
  session: TsumeShogiSession,
  pieceType: TsumeShogiHandPieceType,
): TsumeShogiSession {
  if (!acceptsAttackerInput(session)) return session;

  const hand = getTsumeShogiHand(
    getTsumeShogiSessionPosition(session),
    "attacker",
  );
  if (hand[pieceType] <= 0) return session;

  const { selection } = session;
  const tapsSelected =
    selection?.type === "hand" && selection.pieceType === pieceType;
  return changeSelection(
    session,
    tapsSelected ? null : { type: "hand", pieceType },
  );
}

/** 成・不成を選んで指す。選んだ手が王手にならなければ、ほかの王手にならない手と同じく着手させない。 */
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
  const result = tryAttackerCheck(getTsumeShogiSessionPosition(session), move);
  if (typeof result === "string") return reject(session, result, choice.to);

  return playAttackerCheck(session, move, result, operatedAt);
}

/** 成・不成を選ぶのをやめる。駒の選択は残す。 */
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

/** 選択を解除する。 */
export function clearTsumeShogiSessionSelection(
  session: TsumeShogiSession,
): TsumeShogiSession {
  if (!acceptsAttackerInput(session)) return session;

  return changeSelection(session, null);
}

/** 決めてある玉方の応手を盤面に指す。誤王手の筋なら反証を見た回数を数える。 */
export function playTsumeShogiSessionDefenderReply(
  session: TsumeShogiSession,
): TsumeShogiSession {
  if (!session.defenderReplyPending) return session;

  const lastTurn = session.turns.at(-1);
  return {
    ...session,
    defenderReplyPending: false,
    refutationViewCount:
      session.refutationViewCount + (lastTurn?.line === "wrong" ? 1 : 0),
  };
}

function resetBoardState(
  session: TsumeShogiSession,
  turns: readonly TsumeShogiSessionTurn[],
): TsumeShogiSession {
  return {
    ...session,
    turns,
    defenderReplyPending: false,
    selection: null,
    promotionChoice: null,
    rejection: null,
  };
}

/**
 * 待った。誤王手の筋にいれば、最初の誤王手を指す前の判断地点まで戻る（判断地点へ戻った回数も数える）。
 * それ以外は、攻方の1手（と玉方の応手）を取り消し、その手を指す前の局面へ戻る。
 */
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

/** 同じプレイのまま、盤面を初期局面へ戻す。経過時間とそれまでの回数は引き継ぐ。 */
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

/** 同じ問題を新しいプレイとして始める（やり直す）。 */
export function replayTsumeShogiSession(
  session: TsumeShogiSession,
  startedAt: number,
): TsumeShogiSession {
  return createTsumeShogiSession(session.problem, startedAt);
}

export function getTsumeShogiSessionElapsedMs(
  session: TsumeShogiSession,
  now: number,
): number {
  return Math.max(0, (session.finishedAt ?? now) - session.startedAt);
}

export function getTsumeShogiSessionResult(
  session: TsumeShogiSession,
): TsumeShogiSessionResult | null {
  if (session.status !== "cleared" || session.finishedAt === null) {
    return null;
  }

  return {
    elapsedMs: getTsumeShogiSessionElapsedMs(session, session.finishedAt),
    wrongCheckCount: session.wrongCheckCount,
    refutationViewCount: session.refutationViewCount,
    returnCount: session.returnCount,
    undoCount: session.undoCount,
    restartCount: session.restartCount,
    illegalInputCount: session.illegalInputCount,
    inputCount: session.inputCount,
  };
}
