import { formatTsumeShogiBoardSfen } from "@/games/tsume-shogi/problem/generation/retro-moves";
import type { TsumeShogiProblem } from "@/games/tsume-shogi/problem/problem";
import {
  applyTsumeShogiMove,
  type TsumeShogiMove,
} from "@/games/tsume-shogi/puzzle/moves";
import {
  findTsumeShogiDefenderKing,
  getTsumeShogiHand,
  getTsumeShogiPieceAt,
  listTsumeShogiBoardPieces,
  type TsumeShogiPiece,
  type TsumeShogiPosition,
  type TsumeShogiSquare,
  tsumeShogiHandPieceTypes,
} from "@/games/tsume-shogi/puzzle/position";

/**
 * 問題集の重複を見分けるための指紋。どれも左右反転（筋 f と 10-f の入れ替え）で同じ値になる。
 * - `position`: 初期局面（盤面と攻方の持駒）。同じ局面の重複を除く。
 * - `solution`: 作意の各手を、初期局面の玉の位置からの相対位置と駒の種類で表した列。平行移動しただけの同じ詰み筋を見分ける。
 * - `motif`: 作意の各手の手筋の種類（打つ・成る・取る・捨駒・玉の逃げ方）の列。同じ形の詰み筋の偏りを見る。
 * - `attack`: 作意の攻方の各手を、駒の種類（成る手は成ることも）と、移動先の、その手の直前の玉の位置からの相対位置で
 *   表した列。打つか動かすか、どこから動かしたか、玉方の応手は含めない。遊ぶ人から見て「玉にどう迫って詰めるか」が同じ
 *   問題を見分ける。
 */
export type TsumeShogiProblemFingerprint = {
  position: string;
  solution: string;
  motif: string;
  attack: string;
};

/** 左右反転して見るか。 */
type Orientation = "original" | "mirrored";

const orientations: readonly Orientation[] = ["original", "mirrored"];

function orientFile(file: number, orientation: Orientation): number {
  return orientation === "original" ? file : 10 - file;
}

function formatPositionKey(
  position: TsumeShogiPosition,
  orientation: Orientation,
): string {
  const cells: (TsumeShogiPiece | null)[] = new Array(81).fill(null);
  for (const { square, piece } of listTsumeShogiBoardPieces(position)) {
    const file = orientFile(square.file, orientation);
    cells[(square.rank - 1) * 9 + (9 - file)] = piece;
  }
  const hand = getTsumeShogiHand(position, "attacker");
  const handKey = tsumeShogiHandPieceTypes
    .map((type) => `${type}${hand[type]}`)
    .join(",");
  return `${formatTsumeShogiBoardSfen(cells)} ${handKey}`;
}

function formatRelative(
  square: TsumeShogiSquare,
  origin: TsumeShogiSquare,
  orientation: Orientation,
): string {
  const fileOffset =
    orientFile(square.file, orientation) - orientFile(origin.file, orientation);
  return `${fileOffset},${square.rank - origin.rank}`;
}

function formatSolutionKey(
  problem: TsumeShogiProblem,
  orientation: Orientation,
): string {
  const origin = findTsumeShogiDefenderKing(problem.initialPosition);
  let position = problem.initialPosition;
  const parts: string[] = [];
  for (const move of problem.mainLine) {
    if (move.kind === "drop") {
      parts.push(
        `${move.pieceType}*${formatRelative(move.to, origin, orientation)}`,
      );
    } else {
      const piece = getTsumeShogiPieceAt(position, move.from)!;
      parts.push(
        `${piece.type}${formatRelative(move.from, origin, orientation)}>${formatRelative(move.to, origin, orientation)}${move.promote ? "+" : ""}`,
      );
    }
    position = applyTsumeShogiMove(position, move);
  }
  return parts.join(" ");
}

function formatAttackKey(
  problem: TsumeShogiProblem,
  orientation: Orientation,
): string {
  let position = problem.initialPosition;
  const parts: string[] = [];
  for (const [index, move] of problem.mainLine.entries()) {
    if (index % 2 === 0) {
      const king = findTsumeShogiDefenderKing(position);
      const pieceType =
        move.kind === "drop"
          ? move.pieceType
          : `${getTsumeShogiPieceAt(position, move.from)!.type}${move.promote ? "+" : ""}`;
      parts.push(`${pieceType}@${formatRelative(move.to, king, orientation)}`);
    }
    position = applyTsumeShogiMove(position, move);
  }
  return parts.join(" ");
}

/** 向きごとの値のうち小さい方。左右反転した問題が同じ値になる。 */
function canonicalize(format: (orientation: Orientation) => string): string {
  const [original, mirrored] = orientations.map(format) as [string, string];
  return original < mirrored ? original : mirrored;
}

/** 攻方の手の手筋。打・成・取・捨（次の玉方の手で取られる）を並べる。 */
function describeAttackerMotif(
  position: TsumeShogiPosition,
  move: TsumeShogiMove,
  nextMove: TsumeShogiMove | undefined,
): string {
  const tags = [move.kind === "drop" ? "打" : "動"];
  if (move.kind === "board" && move.promote) {
    tags.push("成");
  }
  if (getTsumeShogiPieceAt(position, move.to) !== null) {
    tags.push("取");
  }
  if (
    nextMove !== undefined &&
    nextMove.to.file === move.to.file &&
    nextMove.to.rank === move.to.rank
  ) {
    tags.push("捨");
  }
  return tags.join("");
}

/** 玉方の手の手筋。玉が逃げるか、駒を取るか。 */
function describeDefenderMotif(
  position: TsumeShogiPosition,
  move: TsumeShogiMove,
): string {
  const capture = getTsumeShogiPieceAt(position, move.to) !== null;
  const king =
    move.kind === "board" &&
    getTsumeShogiPieceAt(position, move.from)?.type === "king";
  return `${king ? "玉" : "駒"}${capture ? "取" : ""}`;
}

function formatMotifKey(problem: TsumeShogiProblem): string {
  let position = problem.initialPosition;
  const parts: string[] = [];
  for (const [index, move] of problem.mainLine.entries()) {
    parts.push(
      index % 2 === 0
        ? describeAttackerMotif(position, move, problem.mainLine[index + 1])
        : describeDefenderMotif(position, move),
    );
    position = applyTsumeShogiMove(position, move);
  }
  return parts.join(" ");
}

export function createTsumeShogiProblemFingerprint(
  problem: TsumeShogiProblem,
): TsumeShogiProblemFingerprint {
  return {
    position: canonicalize(function formatPosition(orientation) {
      return formatPositionKey(problem.initialPosition, orientation);
    }),
    solution: canonicalize(function formatSolution(orientation) {
      return formatSolutionKey(problem, orientation);
    }),
    motif: formatMotifKey(problem),
    attack: canonicalize(function formatAttack(orientation) {
      return formatAttackKey(problem, orientation);
    }),
  };
}
