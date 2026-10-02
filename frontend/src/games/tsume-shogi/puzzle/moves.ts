import {
  Color,
  type ImmutablePosition,
  type Move,
  MoveType,
  movableDirections,
  PieceType,
  parseUSIMove,
  resolveMoveType,
  Square,
} from "tsshogi";

import {
  fromEnginePieceType,
  fromEngineSquare,
  getTsumeShogiSideToMove,
  type TsumeShogiHandPieceType,
  type TsumeShogiPieceType,
  type TsumeShogiPosition,
  type TsumeShogiSide,
  type TsumeShogiSquare,
  toEnginePieceType,
  toEngineSquare,
  tsumeShogiHandPieceTypes,
  unwrapEnginePosition,
  wrapEnginePosition,
} from "@/games/tsume-shogi/puzzle/position";

/**
 * 詰将棋の着手と合法手。
 * 合法性（二歩・打歩詰・行き所のない駒・自玉への王手放置）は `tsshogi` の判定に任せる。
 */

export type TsumeShogiMove =
  | {
      kind: "board";
      from: TsumeShogiSquare;
      to: TsumeShogiSquare;
      promote: boolean;
    }
  | {
      kind: "drop";
      pieceType: TsumeShogiHandPieceType;
      to: TsumeShogiSquare;
    };

const promotablePieceTypes: ReadonlySet<TsumeShogiPieceType> = new Set([
  "rook",
  "bishop",
  "silver",
  "knight",
  "lance",
  "pawn",
]);

function isInPromotionZone(side: TsumeShogiSide, rank: number): boolean {
  return side === "attacker" ? rank <= 3 : rank >= 7;
}

/**
 * 盤上の駒の移動で成ることを選べるか。成れる駒（`pieceType` は動かす前の駒）が、相手の陣（相手側の3段）へ入る・
 * その中で動く・そこから出る移動なら成れる。打つ手は成れない。
 */
export function canTsumeShogiMovePromote(
  side: TsumeShogiSide,
  pieceType: TsumeShogiPieceType,
  move: TsumeShogiMove,
): boolean {
  return (
    move.kind === "board" &&
    promotablePieceTypes.has(pieceType) &&
    (isInPromotionZone(side, move.from.rank) ||
      isInPromotionZone(side, move.to.rank))
  );
}

/** USI 形式（例: `7g7f`、`8h2b+`、`G*5b`）。 */
export function formatTsumeShogiMoveUsi(move: TsumeShogiMove): string {
  const to = toEngineSquare(move.to).usi;
  if (move.kind === "drop") {
    return `${dropUsiLetters[move.pieceType]}*${to}`;
  }
  return `${toEngineSquare(move.from).usi}${to}${move.promote ? "+" : ""}`;
}

/** USI 形式の着手を読む。読めなければ `RangeError` を投げる。局面での合法性は見ない。 */
export function parseTsumeShogiMoveUsi(usi: string): TsumeShogiMove {
  const parsed = parseUSIMove(usi);
  const move =
    parsed === null
      ? null
      : parsed.from instanceof Square
        ? ({
            kind: "board",
            from: fromEngineSquare(parsed.from),
            to: fromEngineSquare(parsed.to),
            promote: parsed.promote,
          } as const)
        : toDropMove(fromEnginePieceType(parsed.from), parsed.to);
  if (move === null || formatTsumeShogiMoveUsi(move) !== usi) {
    throw new RangeError(`USI 形式の着手として読めません: ${usi}`);
  }
  return move;
}

export function isSameTsumeShogiMove(
  a: TsumeShogiMove,
  b: TsumeShogiMove,
): boolean {
  return formatTsumeShogiMoveUsi(a) === formatTsumeShogiMoveUsi(b);
}

/** 手番側の合法手。盤上の駒の移動（成・不成を別の手とする）のあと、持駒の打ちを並べる。 */
export function listTsumeShogiLegalMoves(
  position: TsumeShogiPosition,
): TsumeShogiMove[] {
  return Array.from(
    generateLegalEngineMoves(unwrapEnginePosition(position)),
    fromEngineMove,
  );
}

export function isTsumeShogiLegalMove(
  position: TsumeShogiPosition,
  move: TsumeShogiMove,
): boolean {
  const engine = unwrapEnginePosition(position);
  const engineMove = toEngineMove(engine, move);
  return engineMove !== null && engine.isValidMove(engineMove);
}

/** 着手した後の局面。合法手でなければ `RangeError` を投げる。 */
export function applyTsumeShogiMove(
  position: TsumeShogiPosition,
  move: TsumeShogiMove,
): TsumeShogiPosition {
  const next = unwrapEnginePosition(position).clone();
  const engineMove = toEngineMove(next, move);
  if (engineMove === null || !next.doMove(engineMove)) {
    throw new RangeError(
      `合法手ではありません: ${formatTsumeShogiMoveUsi(move)}`,
    );
  }
  return wrapEnginePosition(next);
}

/** 攻方の手番で、玉方の玉に王手をかける合法手。攻方の手番でなければ `RangeError` を投げる。 */
export function listTsumeShogiAttackerChecks(
  position: TsumeShogiPosition,
): TsumeShogiMove[] {
  assertSideToMove(position, "attacker");
  const engine = unwrapEnginePosition(position);
  const scratch = engine.clone();
  const checks: TsumeShogiMove[] = [];
  for (const move of generateLegalEngineMoves(engine)) {
    scratch.doMove(move, { ignoreValidation: true });
    const givesCheck = scratch.board.isChecked(Color.WHITE);
    scratch.undoMove(move);
    if (givesCheck) {
      checks.push(fromEngineMove(move));
    }
  }
  return checks;
}

/**
 * 玉方の手番での合法手（王手を受ける応手）。玉の逃げ・王手した駒を取る手・合駒（駒箱からの打ちを含む）。
 * 玉方の手番でなければ `RangeError` を投げる。
 */
export function listTsumeShogiDefenderResponses(
  position: TsumeShogiPosition,
): TsumeShogiMove[] {
  assertSideToMove(position, "defender");
  return listTsumeShogiLegalMoves(position);
}

export function isTsumeShogiDefenderInCheck(
  position: TsumeShogiPosition,
): boolean {
  return unwrapEnginePosition(position).board.isChecked(Color.WHITE);
}

/** 玉方の手番で、玉方の玉に王手がかかり、合法手が無い。 */
export function isTsumeShogiCheckmate(position: TsumeShogiPosition): boolean {
  if (
    getTsumeShogiSideToMove(position) !== "defender" ||
    !isTsumeShogiDefenderInCheck(position)
  ) {
    return false;
  }
  return (
    generateLegalEngineMoves(unwrapEnginePosition(position)).next().done ===
    true
  );
}

const dropUsiLetters: Record<TsumeShogiHandPieceType, string> = {
  rook: "R",
  bishop: "B",
  gold: "G",
  silver: "S",
  knight: "N",
  lance: "L",
  pawn: "P",
};

function toDropMove(
  pieceType: TsumeShogiPieceType,
  to: Square,
): TsumeShogiMove | null {
  const handPieceType = tsumeShogiHandPieceTypes.find(
    function isSameType(type) {
      return type === pieceType;
    },
  );
  return handPieceType === undefined
    ? null
    : { kind: "drop", pieceType: handPieceType, to: fromEngineSquare(to) };
}

function assertSideToMove(
  position: TsumeShogiPosition,
  side: TsumeShogiSide,
): void {
  if (getTsumeShogiSideToMove(position) !== side) {
    throw new RangeError(`${side} の手番ではありません`);
  }
}

function toEngineMove(
  engine: ImmutablePosition,
  move: TsumeShogiMove,
): Move | null {
  const to = toEngineSquare(move.to);
  if (!to.valid) {
    return null;
  }
  if (move.kind === "drop") {
    return engine.createMove(toEnginePieceType(move.pieceType), to);
  }
  const from = toEngineSquare(move.from);
  const engineMove = from.valid ? engine.createMove(from, to) : null;
  return engineMove !== null && move.promote
    ? engineMove.withPromote()
    : engineMove;
}

function fromEngineMove(move: Move): TsumeShogiMove {
  if (move.from instanceof Square) {
    return {
      kind: "board",
      from: fromEngineSquare(move.from),
      to: fromEngineSquare(move.to),
      promote: move.promote,
    };
  }
  const drop = toDropMove(fromEnginePieceType(move.from), move.to);
  if (drop === null) {
    throw new RangeError(`持駒にならない駒の打ちです: ${move.usi}`);
  }
  return drop;
}

/**
 * 手番側の駒の利きの先を候補に、`tsshogi` の合法性判定を通った手だけを返す。
 * `tsshogi` は合法手の列挙を持たないため、候補を利きで絞ってから1手ずつ判定する。
 */
function* generateLegalEngineMoves(
  engine: ImmutablePosition,
): Generator<Move, void, undefined> {
  const board = engine.board;
  const color = engine.color;
  for (const from of board.listNonEmptySquares()) {
    const piece = board.at(from)!;
    if (piece.color !== color) {
      continue;
    }
    for (const direction of movableDirections(piece)) {
      const reachesFar = resolveMoveType(piece, direction) === MoveType.LONG;
      for (
        let to = from.neighbor(direction);
        to.valid;
        to = to.neighbor(direction)
      ) {
        const target = board.at(to);
        if (target?.color === color) {
          break;
        }
        const move = engine.createMove(from, to)!;
        if (engine.isValidMove(move)) {
          yield move;
        }
        if (piece.isPromotable()) {
          const promotion = move.withPromote();
          if (engine.isValidMove(promotion)) {
            yield promotion;
          }
        }
        if (target !== null || !reachesFar) {
          break;
        }
      }
    }
  }

  const hand = engine.hand(color);
  for (const handPieceType of tsumeShogiHandPieceTypes) {
    const pieceType = toEnginePieceType(handPieceType);
    if (hand.count(pieceType) === 0) {
      continue;
    }
    for (const to of Square.all) {
      if (board.at(to) !== null) {
        continue;
      }
      const move = engine.createMove(pieceType, to)!;
      if (engine.isValidMove(move)) {
        yield move;
      }
    }
  }
}

/**
 * 攻方が指せない手の理由。
 * - `double-pawn`: 二歩（同じ筋に成っていない攻方の歩がある筋へ歩を打つ）。
 * - `pawn-drop-mate`: 打歩詰（歩を打って玉方を詰ませる）。
 * - `dead-piece`: 行き所のない駒（その先へ動けない段へ、成らずに打つ・動く）。
 * - `unreachable`: その駒がその升へ動けない・打てない（駒の動き、駒のある升、間の駒、持っていない駒など）。
 */
export type TsumeShogiIllegalMoveReason =
  | "double-pawn"
  | "pawn-drop-mate"
  | "dead-piece"
  | "unreachable";

/** 攻方の手番で、合法ではない手がなぜ指せないか。合法手なら `null`。 */
export function explainTsumeShogiIllegalMove(
  position: TsumeShogiPosition,
  move: TsumeShogiMove,
): TsumeShogiIllegalMoveReason | null {
  if (isTsumeShogiLegalMove(position, move)) {
    return null;
  }
  const engine = unwrapEnginePosition(position);
  const to = toEngineSquare(move.to);
  if (!to.valid) {
    return "unreachable";
  }
  if (move.kind === "board") {
    const from = toEngineSquare(move.from);
    const piece = from.valid ? engine.board.at(from) : null;
    const engineMove = piece === null ? null : engine.createMove(from, to);
    const reachableWithPromotion =
      engineMove !== null && engine.isValidMove(engineMove.withPromote());
    return !move.promote &&
      reachableWithPromotion &&
      isDeadRank(piece!.type, move.to.rank)
      ? "dead-piece"
      : "unreachable";
  }

  const pieceType = toEnginePieceType(move.pieceType);
  if (engine.blackHand.count(pieceType) <= 0 || engine.board.at(to) !== null) {
    return "unreachable";
  }
  if (isDeadRank(pieceType, move.to.rank)) {
    return "dead-piece";
  }
  if (move.pieceType === "pawn") {
    const hasPawnOnFile = Square.all.some(function isOwnPawnOnFile(square) {
      const piece = engine.board.at(square);
      return (
        square.file === move.to.file &&
        piece?.color === Color.BLACK &&
        piece.type === PieceType.PAWN
      );
    });
    return hasPawnOnFile ? "double-pawn" : "pawn-drop-mate";
  }
  return "unreachable";
}

/** 攻方（先手）が、その駒を成らずに置けない段か。 */
function isDeadRank(type: PieceType, rank: number): boolean {
  if (type === PieceType.PAWN || type === PieceType.LANCE) {
    return rank === 1;
  }
  return type === PieceType.KNIGHT && rank <= 2;
}
