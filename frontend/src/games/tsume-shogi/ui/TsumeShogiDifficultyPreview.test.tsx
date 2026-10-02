import { cleanup, render } from "@testing-library/react";

import {
  type TsumeShogiDifficulty,
  tsumeShogiDifficulties,
} from "@/games/tsume-shogi/difficulty";
import { isTsumeShogiMateWithin } from "@/games/tsume-shogi/puzzle/mate-search";
import { listTsumeShogiAttackerChecks } from "@/games/tsume-shogi/puzzle/moves";
import {
  createTsumeShogiPosition,
  type TsumeShogiBoardPiece,
  type TsumeShogiHand,
  type TsumeShogiPieceType,
} from "@/games/tsume-shogi/puzzle/position";
import {
  _private,
  TsumeShogiDifficultyPreview,
} from "@/games/tsume-shogi/ui/TsumeShogiDifficultyPreview";

const { previewLayouts, readPreviewBoardPieces } = _private;

const difficultyIds = tsumeShogiDifficulties.map(({ id }) => id);

const adjacentLevels = [
  ["1", "2"],
  ["2", "3"],
  ["3", "4"],
  ["4", "5"],
] as const satisfies readonly (readonly [
  TsumeShogiDifficulty,
  TsumeShogiDifficulty,
])[];

const sfenLetters: Partial<Record<TsumeShogiPieceType, string>> = {
  king: "k",
  rook: "r",
  bishop: "b",
  gold: "g",
  silver: "s",
  knight: "n",
  lance: "l",
  pawn: "p",
  dragon: "+r",
};

afterEach(cleanup);

function toSfenBoard(boardPieces: readonly TsumeShogiBoardPiece[]): string {
  const rows: string[] = [];
  for (let rank = 1; rank <= 9; rank++) {
    let row = "";
    let emptyCount = 0;
    for (let file = 9; file >= 1; file--) {
      const boardPiece = boardPieces.find(
        ({ square }) => square.file === file && square.rank === rank,
      );
      if (!boardPiece) {
        emptyCount++;
        continue;
      }
      if (emptyCount > 0) row += emptyCount;
      emptyCount = 0;
      const letter = sfenLetters[boardPiece.piece.type] ?? "";
      row +=
        boardPiece.piece.side === "attacker" ? letter.toUpperCase() : letter;
    }
    if (emptyCount > 0) row += emptyCount;
    rows.push(row);
  }
  return rows.join("/");
}

function readPreviewPosition(difficulty: TsumeShogiDifficulty) {
  const boardPieces = readPreviewBoardPieces(difficulty);
  const hand: Partial<Record<keyof TsumeShogiHand, number>> = {};
  for (const type of previewLayouts[difficulty].hand) {
    hand[type] = (hand[type] ?? 0) + 1;
  }
  const position = createTsumeShogiPosition(toSfenBoard(boardPieces), hand);
  return { boardPieces, hand, position };
}

function listSidePieces(
  difficulty: TsumeShogiDifficulty,
  side: TsumeShogiBoardPiece["piece"]["side"],
): TsumeShogiBoardPiece[] {
  return readPreviewBoardPieces(difficulty).filter(
    ({ piece }) => piece.side === side,
  );
}

describe("previewLayouts", () => {
  test.each(difficultyIds)(
    "レベル %s の図は詰将棋の局面として成り立ち、初手に王手があること",
    (difficulty) => {
      const { position } = readPreviewPosition(difficulty);

      expect(listTsumeShogiAttackerChecks(position).length).toBeGreaterThan(0);
    },
  );

  test.each(difficultyIds)(
    "レベル %s の図は5手以内に詰まず、正解の手順を持たないこと",
    (difficulty) => {
      const { position } = readPreviewPosition(difficulty);

      expect(isTsumeShogiMateWithin(position, 5)).toBe(false);
    },
  );

  test.each(difficultyIds)(
    "レベル %s の図の攻方の駒と持駒は、どのレベルでも同じであること",
    (difficulty) => {
      expect(listSidePieces(difficulty, "attacker")).toEqual(
        listSidePieces("1", "attacker"),
      );
      expect(readPreviewPosition(difficulty).hand).toEqual(
        readPreviewPosition("1").hand,
      );
    },
  );

  test.each(adjacentLevels)(
    "レベル %s の玉方の駒を、レベル %s の図がすべて同じ位置に含み、守り駒を足すこと",
    (lower, upper) => {
      const lowerDefenders = listSidePieces(lower, "defender");
      const upperDefenders = listSidePieces(upper, "defender");

      expect(upperDefenders).toEqual(expect.arrayContaining(lowerDefenders));
      expect(upperDefenders.length).toBeGreaterThan(lowerDefenders.length);
    },
  );
});

describe("TsumeShogiDifficultyPreview", () => {
  test.each(difficultyIds)(
    "レベル %s では盤上の駒と攻方の持駒をすべて描くこと",
    (difficulty) => {
      const { container } = render(
        <TsumeShogiDifficultyPreview difficulty={difficulty} />,
      );

      expect(container.querySelectorAll("svg")).toHaveLength(
        readPreviewBoardPieces(difficulty).length +
          previewLayouts[difficulty].hand.length,
      );
    },
  );
});
