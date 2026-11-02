import {
  Color,
  directions,
  type Move,
  MoveType,
  movableDirections,
  Piece,
  PieceType,
  type Position,
  resolveMoveType,
  reverseDirection,
  Square,
  vectorToDirectionAndDistance,
} from "tsshogi";

import type { TsumeShogiMove } from "@/games/tsume-shogi/puzzle/moves";
import {
  fromEnginePieceType,
  fromEngineSquare,
  type TsumeShogiHandPieceType,
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
 * 詰み探索のための、着手と戻しで書き換える局面。
 * `moves.ts` の列挙は全合法手を `tsshogi` の判定に通すため1局面約1msかかる。ここでは王手と王手の受けだけを
 * 利きの形から候補に絞ってから `tsshogi` の合法性判定に通し、同じ合法手を速く列挙する。
 */

const searchMoveKey = Symbol("tsume-shogi-search-move");

/** 探索用の着手。`TsumeShogiSearchPosition` の局面でだけ意味を持つ。 */
export type TsumeShogiSearchMove = {
  readonly [searchMoveKey]: Move;
};

const attackerHandPieceTypes = tsumeShogiHandPieceTypes.map(toEnginePieceType);

function wrapSearchMove(move: Move): TsumeShogiSearchMove {
  return { [searchMoveKey]: move };
}

export function toTsumeShogiMove(move: TsumeShogiSearchMove): TsumeShogiMove {
  const engineMove = move[searchMoveKey];
  if (engineMove.from instanceof Square) {
    return {
      kind: "board",
      from: fromEngineSquare(engineMove.from),
      to: fromEngineSquare(engineMove.to),
      promote: engineMove.promote,
    };
  }
  return {
    kind: "drop",
    pieceType: fromEnginePieceType(engineMove.from) as TsumeShogiHandPieceType,
    to: fromEngineSquare(engineMove.to),
  };
}

/** USI 形式。探索の結果を決まった順に並べるときの比較にも使う。 */
export function formatTsumeShogiSearchMoveUsi(
  move: TsumeShogiSearchMove,
): string {
  return move[searchMoveKey].usi;
}

/**
 * 玉方の合駒（駒箱からの打ち、または玉以外の駒を王手の利きの間へ動かす手）。
 * 王手を受ける手のうち、玉が動かず王手した駒も取らない手は、利きの間を塞ぐ手に限られる。
 */
export function isTsumeShogiInterposition(move: TsumeShogiSearchMove): boolean {
  const engineMove = move[searchMoveKey];
  return (
    !(engineMove.from instanceof Square) ||
    (engineMove.pieceType !== PieceType.KING &&
      engineMove.capturedPieceType === null)
  );
}

export class TsumeShogiSearchPosition {
  readonly #engine: Position;

  constructor(position: TsumeShogiPosition) {
    this.#engine = unwrapEnginePosition(position).clone();
  }

  get sideToMove(): TsumeShogiSide {
    return this.#engine.color === Color.BLACK ? "attacker" : "defender";
  }

  /** 同じ局面なら同じ文字列。玉方の持駒（駒箱）は盤面と攻方の持駒から決まるので含めない。 */
  get key(): string {
    const engine = this.#engine;
    return `${engine.board.sfen} ${engine.color} ${engine.blackHand.sfenBlack}`;
  }

  get attackerHandPieceCount(): number {
    const hand = this.#engine.blackHand;
    let count = 0;
    for (const type of attackerHandPieceTypes) {
      count += hand.count(type);
    }
    return count;
  }

  isDefenderInCheck(): boolean {
    return this.#engine.board.isChecked(Color.WHITE);
  }

  /** 盤上の `square` に駒があるか。 */
  isOccupied(square: TsumeShogiSquare): boolean {
    return this.#engine.board.at(toEngineSquare(square)) !== null;
  }

  /** 玉方の玉の位置。 */
  get defenderKingSquare(): TsumeShogiSquare {
    return fromEngineSquare(this.#engine.board.findKing(Color.WHITE)!);
  }

  /** 玉方の玉に王手をかけている攻方の駒のマス。両王手なら2つ。 */
  listCheckingSquares(): TsumeShogiSquare[] {
    const board = this.#engine.board;
    return listCheckers(this.#engine, board.findKing(Color.WHITE)!).map(
      fromEngineSquare,
    );
  }

  /** 今の局面を、変更されない詰将棋の局面として取り出す。 */
  toPosition(): TsumeShogiPosition {
    return wrapEnginePosition(this.#engine.clone());
  }

  /** 合法手を指す。合法でなければ `RangeError` を投げる。 */
  play(move: TsumeShogiSearchMove): void {
    if (!this.#engine.doMove(move[searchMoveKey])) {
      throw new RangeError(
        `合法手ではありません: ${formatTsumeShogiSearchMoveUsi(move)}`,
      );
    }
  }

  /** 直前に `play` した手を戻す。 */
  undo(move: TsumeShogiSearchMove): void {
    this.#engine.undoMove(move[searchMoveKey]);
  }

  /** 今の局面で合法な `move` を探索用の着手にする。合法でなければ `null`。 */
  findMove(move: TsumeShogiMove): TsumeShogiSearchMove | null {
    const engine = this.#engine;
    const to = toEngineSquare(move.to);
    if (!to.valid) {
      return null;
    }
    let engineMove: Move | null;
    if (move.kind === "drop") {
      engineMove = engine.createMove(toEnginePieceType(move.pieceType), to);
    } else {
      const from = toEngineSquare(move.from);
      engineMove = from.valid ? engine.createMove(from, to) : null;
      if (engineMove !== null && move.promote) {
        engineMove = engineMove.withPromote();
      }
    }
    return engineMove !== null && engine.isValidMove(engineMove)
      ? wrapSearchMove(engineMove)
      : null;
  }

  /**
   * 攻方の手番で、玉方の玉に王手をかける合法手。盤上の駒の移動（成・不成を別の手とする）のあと、持駒の打ちを並べる。
   * 攻方の手番でなければ `RangeError` を投げる。
   */
  listAttackerChecks(): TsumeShogiSearchMove[] {
    const engine = this.#engine;
    if (engine.color !== Color.BLACK) {
      throw new RangeError("攻方の手番ではありません");
    }
    const board = engine.board;
    const king = board.findKing(Color.WHITE)!;
    const checks: TsumeShogiSearchMove[] = [];

    for (const from of board.listSquaresByColor(Color.BLACK)) {
      const piece = board.at(from)!;
      const mayDiscover = isOnQueenLine(from, king);
      for (const move of listPseudoBoardMoves(engine, from, piece)) {
        if (!mayDiscover && !this.#attacksFrom(move, king)) {
          continue;
        }
        if (!engine.isValidMove(move)) {
          continue;
        }
        if (mayDiscover && !this.#givesCheckAfter(move)) {
          continue;
        }
        checks.push(wrapSearchMove(move));
      }
    }

    const hand = engine.blackHand;
    for (const type of attackerHandPieceTypes) {
      if (hand.count(type) === 0) {
        continue;
      }
      for (const to of listDropSquaresAttacking(engine, type, king)) {
        const move = engine.createMove(type, to)!;
        if (engine.isValidMove(move)) {
          checks.push(wrapSearchMove(move));
        }
      }
    }
    return checks;
  }

  /**
   * 玉方の手番で、王手を受ける合法手。玉の移動、王手した駒を取る手、合駒（盤上の駒の移動、駒箱からの打ち）の順。
   * 玉方の手番でなければ `RangeError` を投げる。
   */
  *generateDefenderResponses(): Generator<
    TsumeShogiSearchMove,
    void,
    undefined
  > {
    const engine = this.#engine;
    if (engine.color !== Color.WHITE) {
      throw new RangeError("玉方の手番ではありません");
    }
    const board = engine.board;
    const king = board.findKing(Color.WHITE)!;
    const kingPiece = board.at(king)!;
    for (const direction of movableDirections(kingPiece)) {
      const to = king.neighbor(direction);
      if (!to.valid || board.at(to)?.color === Color.WHITE) {
        continue;
      }
      const move = engine.createMove(king, to)!;
      if (engine.isValidMove(move)) {
        yield wrapSearchMove(move);
      }
    }

    const checkers = listCheckers(engine, king);
    if (checkers.length !== 1) {
      return;
    }
    const checker = checkers[0]!;
    const defenders = board
      .listSquaresByColor(Color.WHITE)
      .filter(function isNotKing(square) {
        return !square.equals(king);
      });
    yield* generateMovesTo(engine, defenders, checker);

    const between = listSquaresBetween(checker, king);
    for (const square of between) {
      yield* generateMovesTo(engine, defenders, square);
    }
    const hand = engine.whiteHand;
    for (const type of attackerHandPieceTypes) {
      if (hand.count(type) === 0) {
        continue;
      }
      for (const square of between) {
        const move = engine.createMove(type, square)!;
        if (engine.isValidMove(move)) {
          yield wrapSearchMove(move);
        }
      }
    }
  }

  listDefenderResponses(): TsumeShogiSearchMove[] {
    return Array.from(this.generateDefenderResponses());
  }

  /** 王手した駒が `to` へ動いた後、その駒自身が玉に利くか。動く前の位置は玉と同じ筋・段・斜めに無い前提。 */
  #attacksFrom(move: Move, king: Square): boolean {
    const piece = new Piece(
      Color.BLACK,
      move.promote ? promotedTypeOf(move.pieceType) : move.pieceType,
    );
    return attacksSquare(this.#engine, piece, move.to, king);
  }

  #givesCheckAfter(move: Move): boolean {
    const engine = this.#engine;
    engine.doMove(move, { ignoreValidation: true });
    const checked = engine.board.isChecked(Color.WHITE);
    engine.undoMove(move);
    return checked;
  }
}

function promotedTypeOf(type: PieceType): PieceType {
  return new Piece(Color.BLACK, type).promoted().type;
}

function isOnQueenLine(a: Square, b: Square): boolean {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return dx === 0 || dy === 0 || dx === dy;
}

/** `from` にある `piece` が、今の盤面で `target` に利くか。 */
function attacksSquare(
  engine: Position,
  piece: Piece,
  from: Square,
  target: Square,
): boolean {
  const { direction, distance, ok } = vectorToDirectionAndDistance(
    target.x - from.x,
    target.y - from.y,
  );
  if (!ok || distance === 0) {
    return false;
  }
  const moveType = resolveMoveType(piece, direction);
  if (moveType === MoveType.SHORT) {
    return distance === 1;
  }
  if (moveType !== MoveType.LONG) {
    return false;
  }
  let square = from.neighbor(direction);
  for (let step = 1; step < distance; step += 1) {
    if (engine.board.at(square) !== null) {
      return false;
    }
    square = square.neighbor(direction);
  }
  return true;
}

/** 盤上の駒の、利きの先への移動（成・不成を別の手とする）。合法性はまだ見ない。 */
function* listPseudoBoardMoves(
  engine: Position,
  from: Square,
  piece: Piece,
): Generator<Move, void, undefined> {
  const board = engine.board;
  for (const direction of movableDirections(piece)) {
    const reachesFar = resolveMoveType(piece, direction) === MoveType.LONG;
    for (
      let to = from.neighbor(direction);
      to.valid;
      to = to.neighbor(direction)
    ) {
      const target = board.at(to);
      if (target?.color === piece.color) {
        break;
      }
      const move = engine.createMove(from, to)!;
      yield move;
      if (piece.isPromotable()) {
        yield move.withPromote();
      }
      if (target !== null || !reachesFar) {
        break;
      }
    }
  }
}

/** 攻方が `type` の駒を打てば `king` に利く空きマス。 */
function listDropSquaresAttacking(
  engine: Position,
  type: PieceType,
  king: Square,
): Square[] {
  const piece = new Piece(Color.BLACK, type);
  const board = engine.board;
  const squares: Square[] = [];
  for (const direction of movableDirections(piece)) {
    const reachesFar = resolveMoveType(piece, direction) === MoveType.LONG;
    const back = reverseDirection(direction);
    for (
      let square = king.neighbor(back);
      square.valid;
      square = square.neighbor(back)
    ) {
      if (board.at(square) !== null) {
        break;
      }
      squares.push(square);
      if (!reachesFar) {
        break;
      }
    }
  }
  return squares;
}

/** 玉方の玉に利いている攻方の駒のマス。 */
function listCheckers(engine: Position, king: Square): Square[] {
  const board = engine.board;
  const checkers: Square[] = [];
  for (const direction of directions) {
    let step = 0;
    for (
      let square = king.neighbor(direction);
      square.valid;
      square = square.neighbor(direction)
    ) {
      step += 1;
      const piece = board.at(square);
      if (piece === null) {
        continue;
      }
      if (piece.color === Color.BLACK) {
        const moveType = resolveMoveType(piece, reverseDirection(direction));
        if (
          moveType === MoveType.LONG ||
          (moveType === MoveType.SHORT && step === 1)
        ) {
          checkers.push(square);
        }
      }
      break;
    }
  }
  return checkers;
}

/** `from` と `to` の間のマス。同じ筋・段・斜めに無いか、隣なら空。 */
function listSquaresBetween(from: Square, to: Square): Square[] {
  const { direction, distance, ok } = vectorToDirectionAndDistance(
    to.x - from.x,
    to.y - from.y,
  );
  if (!ok || distance <= 1 || direction.endsWith("knight")) {
    return [];
  }
  const squares: Square[] = [];
  let square = from.neighbor(direction);
  for (let step = 1; step < distance; step += 1) {
    squares.push(square);
    square = square.neighbor(direction);
  }
  return squares;
}

/** `pieces` の駒が `to` へ動く合法手（成・不成を別の手とする）。 */
function* generateMovesTo(
  engine: Position,
  pieces: readonly Square[],
  to: Square,
): Generator<TsumeShogiSearchMove, void, undefined> {
  for (const from of pieces) {
    const move = engine.createMove(from, to)!;
    if (engine.isValidMove(move)) {
      yield wrapSearchMove(move);
    }
    if (engine.board.at(from)!.isPromotable()) {
      const promotion = move.withPromote();
      if (engine.isValidMove(promotion)) {
        yield wrapSearchMove(promotion);
      }
    }
  }
}
