import {
  Color,
  countNotExistingPieces,
  type ImmutablePosition,
  type Piece,
  PieceType,
  Position,
  Square,
} from "tsshogi";

/**
 * 詰将棋の局面とその読み取り。
 * 将棋のルールは `tsshogi` に任せ、このモジュールと `moves.ts` の外へ `tsshogi` の型を出さない。
 */

/** 攻方（先手。利用者が操作する側）と玉方（後手。玉を持つ側）。 */
export type TsumeShogiSide = "attacker" | "defender";

export type TsumeShogiHandPieceType =
  | "rook"
  | "bishop"
  | "gold"
  | "silver"
  | "knight"
  | "lance"
  | "pawn";

export type TsumeShogiPieceType =
  | TsumeShogiHandPieceType
  | "king"
  | "dragon"
  | "horse"
  | "promSilver"
  | "promKnight"
  | "promLance"
  | "promPawn";

export type TsumeShogiPiece = {
  side: TsumeShogiSide;
  type: TsumeShogiPieceType;
};

/** 筋（`file`）と段（`rank`）。どちらも 1〜9 で、攻方から見て右上が 1筋1段。 */
export type TsumeShogiSquare = {
  file: number;
  rank: number;
};

export type TsumeShogiHand = Readonly<Record<TsumeShogiHandPieceType, number>>;

export type TsumeShogiBoardPiece = {
  square: TsumeShogiSquare;
  piece: TsumeShogiPiece;
};

const enginePositionKey = Symbol("tsume-shogi-engine-position");

/**
 * 詰将棋の局面。攻方は玉を持たず、玉方は玉を1枚持つ。
 * 玉方の持駒は駒箱（盤上と攻方の持駒以外の全駒）で、玉以外の全39枚が盤上・攻方の持駒・玉方の持駒のどこかにある。
 * 値は作った後に変わらない。
 */
export type TsumeShogiPosition = {
  readonly [enginePositionKey]: ImmutablePosition;
};

/** 持駒を並べる順。 */
export const tsumeShogiHandPieceTypes: readonly TsumeShogiHandPieceType[] = [
  "rook",
  "bishop",
  "gold",
  "silver",
  "knight",
  "lance",
  "pawn",
];

const sideToColor: Record<TsumeShogiSide, Color> = {
  attacker: Color.BLACK,
  defender: Color.WHITE,
};

const pieceTypeToEngine: Record<TsumeShogiPieceType, PieceType> = {
  rook: PieceType.ROOK,
  bishop: PieceType.BISHOP,
  gold: PieceType.GOLD,
  silver: PieceType.SILVER,
  knight: PieceType.KNIGHT,
  lance: PieceType.LANCE,
  pawn: PieceType.PAWN,
  king: PieceType.KING,
  dragon: PieceType.DRAGON,
  horse: PieceType.HORSE,
  promSilver: PieceType.PROM_SILVER,
  promKnight: PieceType.PROM_KNIGHT,
  promLance: PieceType.PROM_LANCE,
  promPawn: PieceType.PROM_PAWN,
};

const pieceTypeFromEngine: Record<PieceType, TsumeShogiPieceType> = {
  [PieceType.ROOK]: "rook",
  [PieceType.BISHOP]: "bishop",
  [PieceType.GOLD]: "gold",
  [PieceType.SILVER]: "silver",
  [PieceType.KNIGHT]: "knight",
  [PieceType.LANCE]: "lance",
  [PieceType.PAWN]: "pawn",
  [PieceType.KING]: "king",
  [PieceType.DRAGON]: "dragon",
  [PieceType.HORSE]: "horse",
  [PieceType.PROM_SILVER]: "promSilver",
  [PieceType.PROM_KNIGHT]: "promKnight",
  [PieceType.PROM_LANCE]: "promLance",
  [PieceType.PROM_PAWN]: "promPawn",
};

/** 先手から見て、成らずに置けない段。後手は上下を反転する。 */
const deadRanksForBlack: Partial<Record<PieceType, readonly number[]>> = {
  [PieceType.PAWN]: [1],
  [PieceType.LANCE]: [1],
  [PieceType.KNIGHT]: [1, 2],
};

/**
 * 盤面（SFEN の盤面部分）と攻方の持駒から、攻方の手番の局面を作る。玉方の持駒には駒箱を入れる。
 * 局面が詰将棋として成り立たなければ `RangeError` を投げる。
 */
export function createTsumeShogiPosition(
  board: string,
  attackerHand: Partial<TsumeShogiHand>,
): TsumeShogiPosition {
  const engine = Position.newBySFEN(`${board} b - 1`);
  if (engine === null) {
    throw new RangeError(`盤面の SFEN として読めません: ${board}`);
  }
  for (const type of tsumeShogiHandPieceTypes) {
    const count = attackerHand[type] ?? 0;
    if (!Number.isInteger(count) || count < 0) {
      throw new RangeError(`攻方の持駒の枚数が不正です: ${type}=${count}`);
    }
    engine.blackHand.set(pieceTypeToEngine[type], count);
  }
  const pieceBox = countNotExistingPieces(engine);
  for (const type of tsumeShogiHandPieceTypes) {
    const engineType = pieceTypeToEngine[type];
    if (pieceBox[engineType] < 0) {
      throw new RangeError(`駒の枚数が多すぎます: ${type}`);
    }
    engine.whiteHand.set(engineType, pieceBox[engineType]);
  }
  validateTsumeShogiEngine(engine);
  return wrapEnginePosition(engine);
}

/**
 * SFEN を詰将棋の局面として読む。
 * 局面が詰将棋として成り立たなければ `RangeError` を投げる。
 */
export function parseTsumeShogiPosition(sfen: string): TsumeShogiPosition {
  const engine = Position.newBySFEN(sfen);
  if (engine === null) {
    throw new RangeError(`SFEN として読めません: ${sfen}`);
  }
  validateTsumeShogiEngine(engine);
  return wrapEnginePosition(engine);
}

/** 手数を 1 にそろえた SFEN。同じ局面は同じ文字列になる。 */
export function formatTsumeShogiPosition(position: TsumeShogiPosition): string {
  return unwrapEnginePosition(position).getSFEN(1);
}

export function getTsumeShogiSideToMove(
  position: TsumeShogiPosition,
): TsumeShogiSide {
  return unwrapEnginePosition(position).color === Color.BLACK
    ? "attacker"
    : "defender";
}

export function getTsumeShogiPieceAt(
  position: TsumeShogiPosition,
  square: TsumeShogiSquare,
): TsumeShogiPiece | null {
  const piece = unwrapEnginePosition(position).board.at(toEngineSquare(square));
  return piece === null ? null : fromEnginePiece(piece);
}

/** 盤上の駒。並びは 9筋1段から 1筋9段へ、段ごとに左から右。 */
export function listTsumeShogiBoardPieces(
  position: TsumeShogiPosition,
): TsumeShogiBoardPiece[] {
  const board = unwrapEnginePosition(position).board;
  return board.listNonEmptySquares().map(function toBoardPiece(square) {
    return {
      square: fromEngineSquare(square),
      piece: fromEnginePiece(board.at(square)!),
    };
  });
}

/** 持駒。玉方の持駒は駒箱。 */
export function getTsumeShogiHand(
  position: TsumeShogiPosition,
  side: TsumeShogiSide,
): TsumeShogiHand {
  const hand = unwrapEnginePosition(position).hand(sideToColor[side]);
  return {
    rook: hand.count(PieceType.ROOK),
    bishop: hand.count(PieceType.BISHOP),
    gold: hand.count(PieceType.GOLD),
    silver: hand.count(PieceType.SILVER),
    knight: hand.count(PieceType.KNIGHT),
    lance: hand.count(PieceType.LANCE),
    pawn: hand.count(PieceType.PAWN),
  };
}

export function findTsumeShogiDefenderKing(
  position: TsumeShogiPosition,
): TsumeShogiSquare {
  return fromEngineSquare(
    unwrapEnginePosition(position).board.findKing(Color.WHITE)!,
  );
}

export function isSameTsumeShogiSquare(
  a: TsumeShogiSquare,
  b: TsumeShogiSquare,
): boolean {
  return a.file === b.file && a.rank === b.rank;
}

/**
 * 局面を `tsshogi` の局面として読む。`puzzle/` のルール実装だけが使う。
 * 返した局面は変更しない。変更するときは `clone()` してから使う。
 */
export function unwrapEnginePosition(
  position: TsumeShogiPosition,
): ImmutablePosition {
  return position[enginePositionKey];
}

/**
 * `tsshogi` の局面を詰将棋の局面として包む。`puzzle/` のルール実装だけが使う。
 * 詰将棋として成り立つ局面から合法手で進めた局面だけを包み、包んだ後に `engine` を変更しない。
 */
export function wrapEnginePosition(engine: Position): TsumeShogiPosition {
  return { [enginePositionKey]: engine };
}

export function toEnginePieceType(type: TsumeShogiPieceType): PieceType {
  return pieceTypeToEngine[type];
}

export function fromEnginePieceType(type: PieceType): TsumeShogiPieceType {
  return pieceTypeFromEngine[type];
}

export function toEngineSquare(square: TsumeShogiSquare): Square {
  return new Square(square.file, square.rank);
}

export function fromEngineSquare(square: Square): TsumeShogiSquare {
  return { file: square.file, rank: square.rank };
}

function fromEnginePiece(piece: Piece): TsumeShogiPiece {
  return {
    side: piece.color === Color.BLACK ? "attacker" : "defender",
    type: pieceTypeFromEngine[piece.type],
  };
}

function validateTsumeShogiEngine(engine: ImmutablePosition): void {
  const board = engine.board;
  const squares = board.listNonEmptySquares();
  const kings = squares.filter(function isKing(square) {
    return board.at(square)!.type === PieceType.KING;
  });
  if (kings.length !== 1 || board.at(kings[0]!)!.color !== Color.WHITE) {
    throw new RangeError("玉方の玉だけが1枚ある局面にしてください");
  }

  const missing = countNotExistingPieces(engine);
  for (const type of tsumeShogiHandPieceTypes) {
    if (missing[pieceTypeToEngine[type]] !== 0) {
      throw new RangeError(
        `玉以外の駒は盤上・攻方の持駒・玉方の持駒（駒箱）に全部そろえてください: ${type}`,
      );
    }
  }

  const pawnFiles = new Set<string>();
  for (const square of squares) {
    const piece = board.at(square)!;
    const blackRank =
      piece.color === Color.BLACK ? square.rank : 10 - square.rank;
    if (deadRanksForBlack[piece.type]?.includes(blackRank)) {
      throw new RangeError(`行き所のない駒があります: ${square.usi}`);
    }
    if (piece.type === PieceType.PAWN) {
      const key = `${piece.color}:${square.file}`;
      if (pawnFiles.has(key)) {
        throw new RangeError(`二歩になっています: ${square.file}筋`);
      }
      pawnFiles.add(key);
    }
  }

  if (engine.color === Color.BLACK && board.isChecked(Color.WHITE)) {
    throw new RangeError("攻方の手番で玉方の玉に王手がかかっています");
  }
}
