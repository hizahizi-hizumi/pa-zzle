import {
  Color,
  type ImmutablePosition,
  type Move,
  MoveType,
  movableDirections,
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
