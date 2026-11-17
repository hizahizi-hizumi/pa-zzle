import {
  describeTsumeShogiOperation,
  type TsumeShogiOperationType,
} from "@/games/tsume-shogi/play/tsume-shogi-operation";
import {
  listTsumeShogiBoardPieceIds,
  listTsumeShogiShownMoves,
  type TsumeShogiPlayedMove,
} from "@/games/tsume-shogi/play/use-tsume-shogi-play";
import { isTsumeShogiMateWithin } from "@/games/tsume-shogi/puzzle/mate-search";
import {
  applyTsumeShogiMove,
  findTsumeShogiIllegalDropReason,
  isSameTsumeShogiMove,
  isTsumeShogiCheckmate,
  isTsumeShogiDefenderInCheck,
  isTsumeShogiLegalMove,
  listTsumeShogiLegalMoves,
  type TsumeShogiIllegalDropReason,
  type TsumeShogiMove,
} from "@/games/tsume-shogi/puzzle/moves";
import {
  getTsumeShogiHand,
  isSameTsumeShogiSquare,
  listTsumeShogiBoardPieces,
  type TsumeShogiBoardPiece,
  type TsumeShogiHand,
  type TsumeShogiHandPieceType,
  type TsumeShogiPosition,
  type TsumeShogiSquare,
} from "@/games/tsume-shogi/puzzle/position";
import {
  cancelTsumeShogiSessionPromotion,
  chooseTsumeShogiSessionPromotion,
  clearTsumeShogiSessionSelection,
  createTsumeShogiSession,
  getTsumeShogiSessionPhase,
  getTsumeShogiSessionRemainingPlies,
  playTsumeShogiSessionDefenderReply,
  type TsumeShogiSelection,
  type TsumeShogiSession,
  type TsumeShogiSessionPhase,
  tapTsumeShogiSessionHand,
  tapTsumeShogiSessionSquare,
} from "@/games/tsume-shogi/session/session";
import type {
  TsumeShogiFigureCrop,
  TsumeShogiHowToPlayExample,
} from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog/figure-boards";

/**
 * 例の盤面。本番の session をそのまま使い、選ぶ・指す・成るかを選ぶ・着手させない・玉方の応手を本番と同じ遷移で返す。
 * 経過時間は測らない（操作の時刻はどれも 0 にする）。
 * `attempt` は最後に試した手の結果。駒を選び直すと消える。例の下の言葉を、試した手の結果として言うときに使う。
 */
export type TsumeShogiExampleBoard = {
  session: TsumeShogiSession;
  attempt: TsumeShogiExampleAttempt | null;
};

/**
 * - `played`: 指した手。
 * - `rejected`: 着手させなかった手。`move` は試した手（盤上の駒の手は成らない方）。
 */
export type TsumeShogiExampleAttempt = {
  result: "played" | "rejected";
  move: TsumeShogiMove;
};

/** `cancel` は本番の Esc と同じく、成るかの選択肢を出していればそれを閉じ、出していなければ選んだ駒を選ぶ前に戻す。 */
export type TsumeShogiExampleAction =
  | { type: "square"; square: TsumeShogiSquare }
  | { type: "hand"; pieceType: TsumeShogiHandPieceType }
  | { type: "promotion"; promote: boolean }
  | { type: "cancel" };

const operatedAt = 0;

/** 攻方の手を、本番と同じく駒を選んでから行き先を押して指す。成るかを選べる手は `move.promote` の方を選ぶ。 */
export function playTsumeShogiExampleMove(
  session: TsumeShogiSession,
  move: TsumeShogiMove,
): TsumeShogiSession {
  const selected =
    move.kind === "drop"
      ? tapTsumeShogiSessionHand(session, move.pieceType)
      : tapTsumeShogiSessionSquare(session, move.from, operatedAt);
  const played = tapTsumeShogiSessionSquare(selected, move.to, operatedAt);
  return played.promotionChoice
    ? chooseTsumeShogiSessionPromotion(
        played,
        move.kind === "board" && move.promote,
        operatedAt,
      )
    : played;
}

/** 作意の頭から `turns` 組の手を、玉方の応手まで指した session。 */
export function createTsumeShogiExampleSession(
  example: Pick<TsumeShogiHowToPlayExample, "problem" | "preludeTurns">,
): TsumeShogiSession {
  const { problem, preludeTurns } = example;
  let session = createTsumeShogiSession(problem, operatedAt);
  for (let turn = 0; turn < preludeTurns; turn += 1) {
    const move = problem.mainLine[turn * 2];
    if (move === undefined) break;
    session = playTsumeShogiSessionDefenderReply(
      playTsumeShogiExampleMove(session, move),
    );
  }
  return session;
}

export function createTsumeShogiExampleBoard(
  example: TsumeShogiHowToPlayExample,
): TsumeShogiExampleBoard {
  const session = createTsumeShogiExampleSession(example);
  const { selection } = example;
  if (selection === null) {
    return { session, attempt: null };
  }
  const selected =
    selection.type === "hand"
      ? tapTsumeShogiSessionHand(session, selection.pieceType)
      : tapTsumeShogiSessionSquare(session, selection.square, operatedAt);
  return { session: selected, attempt: null };
}

/** 選んでいる駒から `to` へ試した手。盤上の駒の手は成らない方にする。 */
function toAttemptedMove(
  selection: TsumeShogiSelection,
  to: TsumeShogiSquare,
): TsumeShogiMove {
  return selection.type === "hand"
    ? { kind: "drop", pieceType: selection.pieceType, to }
    : { kind: "board", from: selection.square, to, promote: false };
}

function findAttempt(
  previous: TsumeShogiSession,
  next: TsumeShogiSession,
): TsumeShogiExampleAttempt | null {
  if (next.turns.length > previous.turns.length) {
    const move = next.turns.at(-1)?.attackerMove;
    return move ? { result: "played", move } : null;
  }
  if (
    next.rejection !== null &&
    next.rejection !== previous.rejection &&
    previous.selection !== null
  ) {
    return {
      result: "rejected",
      move: toAttemptedMove(previous.selection, next.rejection.to),
    };
  }
  return null;
}

function performTsumeShogiExampleSessionAction(
  session: TsumeShogiSession,
  action: TsumeShogiExampleAction,
): TsumeShogiSession {
  switch (action.type) {
    case "square":
      return tapTsumeShogiSessionSquare(session, action.square, operatedAt);
    case "hand":
      return tapTsumeShogiSessionHand(session, action.pieceType);
    case "promotion":
      return chooseTsumeShogiSessionPromotion(
        session,
        action.promote,
        operatedAt,
      );
    case "cancel":
      return session.promotionChoice === null
        ? clearTsumeShogiSessionSelection(session)
        : cancelTsumeShogiSessionPromotion(session);
  }
}

/**
 * 例の盤面を押す。本番の盤面と同じ session の操作で求め、効果音を鳴らす操作の知らせ（本番と同じ種類）を返す。
 * 試した手の結果は、手を指したか着手させなかったときに替え、駒を選び直したときに消す。
 */
export function performTsumeShogiExampleAction(
  board: TsumeShogiExampleBoard,
  action: TsumeShogiExampleAction,
): {
  board: TsumeShogiExampleBoard;
  operation: TsumeShogiOperationType | null;
} {
  const { session } = board;
  const next = performTsumeShogiExampleSessionAction(session, action);
  if (next === session) {
    return { board, operation: null };
  }
  const attempt = findAttempt(session, next);
  const reselected = attempt === null && next.selection !== session.selection;
  return {
    board: {
      session: next,
      attempt: attempt ?? (reselected ? null : board.attempt),
    },
    operation: describeTsumeShogiOperation(session, next),
  };
}

/** 玉方の応手を盤面に指す。応手を待っていなければ、受け取った盤面をそのまま返す。 */
export function replyTsumeShogiExampleDefender(board: TsumeShogiExampleBoard): {
  board: TsumeShogiExampleBoard;
  operation: TsumeShogiOperationType | null;
} {
  const next = playTsumeShogiSessionDefenderReply(board.session);
  if (next === board.session) {
    return { board, operation: null };
  }
  return {
    board: { ...board, session: next },
    operation: describeTsumeShogiOperation(board.session, next),
  };
}

/**
 * 例が最初の姿から変わったか。手を指した、選んでいる駒が最初と違う（最初から選んでおいた駒を外した、ほかの駒を選んだ）、
 * 成るかの選択肢を出している、試した手が着手させなかった手として残っている、のどれかなら変わったとする。
 * 最初から選んでおいた駒は札と手がかりの元なので、外すと例が最初の形と違って見えるため。
 */
export function hasTsumeShogiExampleChanged(
  board: TsumeShogiExampleBoard,
  example: TsumeShogiHowToPlayExample,
): boolean {
  const { session, attempt } = board;
  return (
    session.turns.length !== example.preludeTurns ||
    !isSameSelection(session.selection, example.selection) ||
    session.promotionChoice !== null ||
    attempt !== null
  );
}

function isSameSelection(
  left: TsumeShogiSelection | null,
  right: TsumeShogiSelection | null,
): boolean {
  if (left === null || right === null) {
    return left === right;
  }
  if (left.type === "hand" && right.type === "hand") {
    return left.pieceType === right.pieceType;
  }
  return (
    left.type === "board" &&
    right.type === "board" &&
    isSameTsumeShogiSquare(left.square, right.square)
  );
}

function isInsideCrop(
  square: TsumeShogiSquare,
  crop: TsumeShogiFigureCrop,
): boolean {
  return square.file <= crop.files && square.rank <= crop.ranks;
}

function isFromSelection(
  move: TsumeShogiMove,
  selection: TsumeShogiSelection,
): boolean {
  return selection.type === "hand"
    ? move.kind === "drop" && move.pieceType === selection.pieceType
    : move.kind === "board" &&
        isSameTsumeShogiSquare(move.from, selection.square);
}

function givesCheck(position: TsumeShogiPosition, move: TsumeShogiMove) {
  return isTsumeShogiDefenderInCheck(applyTsumeShogiMove(position, move));
}

export type TsumeShogiCandidateMark = {
  square: TsumeShogiSquare;
  allowed: boolean;
};

/**
 * 選んでいる駒の行き先ごとの札。本番の判定と同じ合法手から求め、切り出した範囲の升にだけ付ける。
 * - `check`: 動ける升（持駒なら王手になる升）ごとに、王手になるか。成・不成のどちらかで王手になれば王手とする。
 *   持駒は空いた升のどこにでも打てるので、王手にならない升まで札を付けると盤面が札で埋まる。持駒には王手になる升だけに付ける。
 * - `mate`: 王手になる升ごとに、残りの手数のうちに詰むか。
 * 攻方の番で駒を選んでいるときだけ付ける。
 */
export function listTsumeShogiCandidateMarks(
  board: TsumeShogiExampleBoard,
  judge: "check" | "mate",
  crop: TsumeShogiFigureCrop,
): TsumeShogiCandidateMark[] {
  const { session } = board;
  const { selection } = session;
  if (
    selection === null ||
    session.promotionChoice !== null ||
    getTsumeShogiSessionPhase(session) !== "attacker"
  ) {
    return [];
  }
  const position = session.puzzleState;
  const remaining = getTsumeShogiSessionRemainingPlies(session);
  const moves = listTsumeShogiLegalMoves(position).filter(
    (move) => isFromSelection(move, selection) && isInsideCrop(move.to, crop),
  );
  const marks: TsumeShogiCandidateMark[] = [];
  for (const move of moves) {
    if (marks.some(({ square }) => isSameTsumeShogiSquare(square, move.to))) {
      continue;
    }
    const variants = moves.filter((candidate) =>
      isSameTsumeShogiSquare(candidate.to, move.to),
    );
    const checks = variants.filter((variant) => givesCheck(position, variant));
    if (judge === "check") {
      if (selection.type === "hand" && checks.length === 0) continue;
      marks.push({ square: move.to, allowed: checks.length > 0 });
      continue;
    }
    if (checks.length === 0) continue;
    marks.push({
      square: move.to,
      allowed: checks.some((check) => {
        const after = applyTsumeShogiMove(position, check);
        return (
          isTsumeShogiCheckmate(after) ||
          isTsumeShogiMateWithin(after, remaining - 1)
        );
      }),
    });
  }
  return marks;
}

export type TsumeShogiExampleHint =
  | { type: "square"; square: TsumeShogiSquare }
  | { type: "hand"; pieceType: TsumeShogiHandPieceType }
  | { type: "promotion"; promote: boolean };

/**
 * 次に押す所。例が見せる攻方の手（`shownAttacks`）を順に、駒を選ぶ所・行き先の升・成るかの選択肢で示す。
 * 見せる手を指し終えたか、見せる手と違う手を指したか、玉方の応手を待つ間か、着手させなかった後は示さない。
 * 着手させなかった後は、駒を選び直すと（選んだ駒を押して選ぶのをやめても）また示す。
 */
export function getTsumeShogiExampleHint(
  board: TsumeShogiExampleBoard,
  example: TsumeShogiHowToPlayExample,
): TsumeShogiExampleHint | null {
  const { session } = board;
  if (
    session.rejection !== null ||
    getTsumeShogiSessionPhase(session) !== "attacker"
  ) {
    return null;
  }
  const playedTurns = session.turns.slice(example.preludeTurns);
  const deviated = playedTurns.some((turn, index) => {
    const shown = example.shownAttacks[index];
    return (
      shown === undefined || !isSameTsumeShogiMove(turn.attackerMove, shown)
    );
  });
  const move = example.shownAttacks[playedTurns.length];
  if (deviated || move === undefined) {
    return null;
  }
  if (move.kind === "drop") {
    return session.selection?.type === "hand" &&
      session.selection.pieceType === move.pieceType
      ? { type: "square", square: move.to }
      : { type: "hand", pieceType: move.pieceType };
  }
  const { promotionChoice, selection } = session;
  if (promotionChoice !== null) {
    return isSameTsumeShogiSquare(promotionChoice.from, move.from) &&
      isSameTsumeShogiSquare(promotionChoice.to, move.to)
      ? { type: "promotion", promote: move.promote }
      : null;
  }
  return selection?.type === "board" &&
    isSameTsumeShogiSquare(selection.square, move.from)
    ? { type: "square", square: move.to }
    : { type: "square", square: move.from };
}

/**
 * 着手させなかった手のわけ。本番の session は王手にならない手（`not-check`）とルールで指せない手（`illegal`）しか分けないので、
 * ルールで指せない手は、どのルールで指せないかを `puzzle/` の判定で求める。
 * - `double-pawn`: 歩のある筋に歩を打つ（二歩）。
 * - `pawn-drop-mate`: 歩を打って詰ませる（打歩詰）。
 * - `dead-piece`: 成らずには行き所の無い段に打つ。
 * - `unreachable`: その駒が動けない升か、駒のある升に打つ手。
 */
export type TsumeShogiExampleRejectionReason =
  | "not-check"
  | "double-pawn"
  | "pawn-drop-mate"
  | "dead-piece"
  | "unreachable";

const illegalDropReasons = {
  occupied: "unreachable",
  "dead-piece": "dead-piece",
  "double-pawn": "double-pawn",
  "pawn-drop-mate": "pawn-drop-mate",
} as const satisfies Record<
  TsumeShogiIllegalDropReason,
  TsumeShogiExampleRejectionReason
>;

export function findTsumeShogiExampleRejectionReason(
  position: TsumeShogiPosition,
  move: TsumeShogiMove,
): TsumeShogiExampleRejectionReason {
  if (move.kind === "board") {
    const variants = [false, true].map(
      (promote): TsumeShogiMove => ({ ...move, promote }),
    );
    return variants.some((variant) => isTsumeShogiLegalMove(position, variant))
      ? "not-check"
      : "unreachable";
  }
  if (isTsumeShogiLegalMove(position, move)) {
    return "not-check";
  }
  const reason = findTsumeShogiIllegalDropReason(position, move);
  return reason === null ? "unreachable" : illegalDropReasons[reason];
}

/** 盤面と駒台と盤の下の行に、本番のプレイ画面と同じ決め方で渡す値。 */
export type TsumeShogiExampleView = {
  boardPieces: readonly TsumeShogiBoardPiece[];
  boardPieceIds: ReadonlyMap<string, string>;
  attackerHand: TsumeShogiHand;
  shownMoves: readonly TsumeShogiPlayedMove[];
  precedingMoveTo: TsumeShogiSquare | null;
  phase: TsumeShogiSessionPhase;
};

/** 本番のプレイフック（`useTsumeShogiPlay`）と同じ関数で、session から盤面に見せる値を求める。 */
export function getTsumeShogiExampleView(
  session: TsumeShogiSession,
): TsumeShogiExampleView {
  const { turns, defenderReplyPending, problem } = session;
  const position = session.puzzleState;
  const positionBeforeLastTurn =
    turns.at(-2)?.positionAfterDefense ?? problem.initialPosition;
  return {
    boardPieces: listTsumeShogiBoardPieces(position),
    boardPieceIds: listTsumeShogiBoardPieceIds(
      problem.initialPosition,
      turns,
      defenderReplyPending,
    ),
    attackerHand: getTsumeShogiHand(position, "attacker"),
    shownMoves: listTsumeShogiShownMoves(
      turns.at(-1),
      positionBeforeLastTurn,
      defenderReplyPending,
    ),
    precedingMoveTo: turns.at(-2)?.defenderMove?.to ?? null,
    phase: getTsumeShogiSessionPhase(session),
  };
}

/** 手がかりで示す最初の手が、今の盤面で指せるか（合法で王手になるか）。 */
export function canPlayTsumeShogiExampleMove(
  position: TsumeShogiPosition,
  move: TsumeShogiMove,
): boolean {
  return isTsumeShogiLegalMove(position, move) && givesCheck(position, move);
}
