import {
  applyTsumeShogiMove,
  isTsumeShogiDefenderInCheck,
  isTsumeShogiLegalMove,
  type TsumeShogiMove,
} from "@/games/tsume-shogi/puzzle/moves";
import {
  createTsumeShogiPosition,
  formatTsumeShogiPosition,
  getTsumeShogiHand,
  listTsumeShogiBoardPieces,
  type TsumeShogiHandPieceType,
  type TsumeShogiPiece,
  type TsumeShogiPieceType,
  type TsumeShogiPosition,
  type TsumeShogiSquare,
  tsumeShogiHandPieceTypes,
} from "@/games/tsume-shogi/puzzle/position";

/**
 * 逆算の1段: 攻方の手番の局面 P から、攻方の王手 a と玉方の応手 d を1組さかのぼった局面 P' の候補を作る。
 * 盤面と攻方の持駒を書き換えて候補を作り、P' から a・d を順に指すと P に戻ることを合法手の判定で確かめる。
 * 駒の動きの形は書き換えの候補を絞るためだけに使い、合法かどうかは `puzzle/` の判定に任せる。
 */

export type TsumeShogiRetroStep = {
  /** さかのぼった局面（攻方の手番）。 */
  position: TsumeShogiPosition;
  attackerMove: TsumeShogiMove;
  defenderMove: TsumeShogiMove;
};

type Cells = (TsumeShogiPiece | null)[];

type EditablePosition = {
  cells: Cells;
  attackerHand: Record<TsumeShogiHandPieceType, number>;
};

/** 玉方の駒が取る攻方の駒の候補。成駒は龍・馬・とだけにし、候補の数を抑える。 */
const capturableAttackerTypes: readonly TsumeShogiPieceType[] = [
  "rook",
  "bishop",
  "gold",
  "silver",
  "knight",
  "lance",
  "pawn",
  "dragon",
  "horse",
  "promPawn",
];

/** 攻方の駒が取る玉方の駒の候補。 */
const capturableDefenderTypes: readonly TsumeShogiPieceType[] = [
  "rook",
  "bishop",
  "gold",
  "silver",
  "knight",
  "lance",
  "pawn",
];

const unpromotedTypes: Partial<
  Record<TsumeShogiPieceType, TsumeShogiPieceType>
> = {
  dragon: "rook",
  horse: "bishop",
  promSilver: "silver",
  promKnight: "knight",
  promLance: "lance",
  promPawn: "pawn",
};

const sfenLetters: Record<TsumeShogiPieceType, string> = {
  rook: "R",
  bishop: "B",
  gold: "G",
  silver: "S",
  knight: "N",
  lance: "L",
  pawn: "P",
  king: "K",
  dragon: "+R",
  horse: "+B",
  promSilver: "+S",
  promKnight: "+N",
  promLance: "+L",
  promPawn: "+P",
};

function toIndex({ file, rank }: TsumeShogiSquare): number {
  return (rank - 1) * 9 + (9 - file);
}

function toSquare(index: number): TsumeShogiSquare {
  return { file: 9 - (index % 9), rank: Math.floor(index / 9) + 1 };
}

/** 持駒にしたときの駒の種類。 */
export function toTsumeShogiHandPieceType(
  type: TsumeShogiPieceType,
): TsumeShogiHandPieceType | null {
  const base = unpromotedTypes[type] ?? type;
  return tsumeShogiHandPieceTypes.find((handType) => handType === base) ?? null;
}

function readEditable(position: TsumeShogiPosition): EditablePosition {
  const cells: Cells = new Array(81).fill(null);
  for (const { square, piece } of listTsumeShogiBoardPieces(position)) {
    cells[toIndex(square)] = piece;
  }
  return {
    cells,
    attackerHand: { ...getTsumeShogiHand(position, "attacker") },
  };
}

/** 盤面を SFEN の盤面部分にする。 */
export function formatTsumeShogiBoardSfen(
  cells: readonly (TsumeShogiPiece | null)[],
): string {
  const rows: string[] = [];
  for (let rank = 0; rank < 9; rank += 1) {
    let row = "";
    let empty = 0;
    for (let column = 0; column < 9; column += 1) {
      const piece = cells[rank * 9 + column];
      if (piece === null || piece === undefined) {
        empty += 1;
        continue;
      }
      if (empty > 0) {
        row += String(empty);
        empty = 0;
      }
      const letter = sfenLetters[piece.type];
      row += piece.side === "attacker" ? letter : letter.toLowerCase();
    }
    rows.push(empty > 0 ? `${row}${empty}` : row);
  }
  return rows.join("/");
}

function tryCreatePosition(
  editable: EditablePosition,
): TsumeShogiPosition | null {
  try {
    return createTsumeShogiPosition(
      formatTsumeShogiBoardSfen(editable.cells),
      editable.attackerHand,
    );
  } catch {
    return null;
  }
}

const rangingTypes: ReadonlySet<TsumeShogiPieceType> = new Set([
  "rook",
  "bishop",
  "lance",
  "dragon",
  "horse",
]);

/**
 * `type` の駒が `to` へ1手で動く前にいた可能性のあるマス。向き（前後）は見ず、距離の形だけで絞る。
 * 飛・角・香・龍・馬は同じ筋・段・斜めのどこでも、桂は跳ぶ位置、ほかの駒は隣のマス。
 */
function listPossibleSources(
  type: TsumeShogiPieceType,
  to: TsumeShogiSquare,
): TsumeShogiSquare[] {
  const sources: TsumeShogiSquare[] = [];
  for (let file = 1; file <= 9; file += 1) {
    for (let rank = 1; rank <= 9; rank += 1) {
      const dx = Math.abs(file - to.file);
      const dy = Math.abs(rank - to.rank);
      if (dx === 0 && dy === 0) {
        continue;
      }
      const reachable =
        type === "knight"
          ? dx === 1 && dy === 2
          : rangingTypes.has(type)
            ? dx === 0 || dy === 0 || dx === dy
            : dx <= 1 && dy <= 1;
      if (reachable) {
        sources.push({ file, rank });
      }
    }
  }
  return sources;
}

/** 攻方の駒が成れる動きか（動く前か後が敵陣）。 */
function isPromotionPossible(
  from: TsumeShogiSquare,
  to: TsumeShogiSquare,
): boolean {
  return from.rank <= 3 || to.rank <= 3;
}

function cloneEditable(editable: EditablePosition): EditablePosition {
  return {
    cells: [...editable.cells],
    attackerHand: { ...editable.attackerHand },
  };
}

type DefenderRetro = { editable: EditablePosition; move: TsumeShogiMove };

/**
 * 玉方の応手 d をさかのぼった局面（玉方の手番になる前、攻方の王手の後の局面 Q）の盤面の候補。
 * 玉方の駒は成らずに動いたものとし、合駒（駒箱からの打ち）は作意に現れない範囲なので作らない。
 */
function listDefenderRetros(editable: EditablePosition): DefenderRetro[] {
  const retros: DefenderRetro[] = [];
  for (const [index, piece] of editable.cells.entries()) {
    if (piece?.side !== "defender") {
      continue;
    }
    const to = toSquare(index);
    for (const from of listPossibleSources(piece.type, to)) {
      if (editable.cells[toIndex(from)] !== null) {
        continue;
      }
      for (const captured of [null, ...capturableAttackerTypes]) {
        const next = cloneEditable(editable);
        next.cells[toIndex(from)] = piece;
        next.cells[index] =
          captured === null ? null : { side: "attacker", type: captured };
        retros.push({
          editable: next,
          move: { kind: "board", from, to, promote: false },
        });
      }
    }
  }
  return retros;
}

type AttackerRetro = { editable: EditablePosition; move: TsumeShogiMove };

/** 攻方の王手 a をさかのぼった局面 P' の盤面と持駒の候補。 */
function listAttackerRetros(editable: EditablePosition): AttackerRetro[] {
  const retros: AttackerRetro[] = [];
  for (const [index, piece] of editable.cells.entries()) {
    if (piece?.side !== "attacker") {
      continue;
    }
    const to = toSquare(index);
    const handType = toTsumeShogiHandPieceType(piece.type);
    if (handType !== null && handType === piece.type) {
      const dropped = cloneEditable(editable);
      dropped.cells[index] = null;
      dropped.attackerHand[handType] += 1;
      retros.push({
        editable: dropped,
        move: { kind: "drop", pieceType: handType, to },
      });
    }
    const unpromoted = unpromotedTypes[piece.type];
    const origins: { type: TsumeShogiPieceType; promote: boolean }[] = [
      { type: piece.type, promote: false },
      ...(unpromoted === undefined
        ? []
        : [{ type: unpromoted, promote: true }]),
    ];
    for (const origin of origins) {
      for (const from of listPossibleSources(origin.type, to)) {
        if (
          editable.cells[toIndex(from)] !== null ||
          (origin.promote && !isPromotionPossible(from, to))
        ) {
          continue;
        }
        for (const captured of [null, ...capturableDefenderTypes]) {
          const capturedHandType =
            captured === null ? null : toTsumeShogiHandPieceType(captured);
          if (
            capturedHandType !== null &&
            editable.attackerHand[capturedHandType] === 0
          ) {
            continue;
          }
          const next = cloneEditable(editable);
          next.cells[toIndex(from)] = { side: "attacker", type: origin.type };
          next.cells[index] =
            captured === null ? null : { side: "defender", type: captured };
          if (capturedHandType !== null) {
            next.attackerHand[capturedHandType] -= 1;
          }
          retros.push({
            editable: next,
            move: { kind: "board", from, to, promote: origin.promote },
          });
        }
      }
    }
  }
  return retros;
}

/**
 * P から1組さかのぼった局面の候補を、`shuffle` で決めた順に1つずつ返す。
 * 返す候補は、P' から攻方の王手 a・玉方の応手 d を順に指すと P になることを確かめてある。
 * P' が詰将棋として成り立つか（手数・余詰・駒余りなど）はまだ見ない。
 */
export function* generateTsumeShogiRetroSteps(
  position: TsumeShogiPosition,
  shuffle: <T>(values: readonly T[]) => T[],
): Generator<TsumeShogiRetroStep, void, undefined> {
  const target = formatTsumeShogiPosition(position);
  for (const defenderRetro of shuffle(
    listDefenderRetros(readEditable(position)),
  )) {
    for (const attackerRetro of shuffle(
      listAttackerRetros(defenderRetro.editable),
    )) {
      const previous = tryCreatePosition(attackerRetro.editable);
      if (
        previous === null ||
        !isTsumeShogiLegalMove(previous, attackerRetro.move)
      ) {
        continue;
      }
      const afterCheck = applyTsumeShogiMove(previous, attackerRetro.move);
      if (
        !isTsumeShogiDefenderInCheck(afterCheck) ||
        !isTsumeShogiLegalMove(afterCheck, defenderRetro.move) ||
        formatTsumeShogiPosition(
          applyTsumeShogiMove(afterCheck, defenderRetro.move),
        ) !== target
      ) {
        continue;
      }
      yield {
        position: previous,
        attackerMove: attackerRetro.move,
        defenderMove: defenderRetro.move,
      };
    }
  }
}

export const _private = { formatTsumeShogiBoardSfen, listPossibleSources };
