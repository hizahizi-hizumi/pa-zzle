import { cleanup, render } from "@testing-library/react";

import {
  type TsumeShogiDifficulty,
  tsumeShogiDifficulties,
  tsumeShogiLevelCombinations,
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
  horse: "+b",
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

function toSquareKey({ square }: TsumeShogiBoardPiece): string {
  return `${square.file}-${square.rank}`;
}

describe("previewLayouts", () => {
  test.each(difficultyIds)(
    "レベル %s の図は、そのレベルの生成条件の範囲に入る数の王手を初手に持つこと",
    (difficulty) => {
      const { position } = readPreviewPosition(difficulty);
      const { generationRootChecks } = tsumeShogiLevelCombinations[difficulty];

      const rootChecks = listTsumeShogiAttackerChecks(position).length;

      expect(rootChecks).toBeGreaterThanOrEqual(generationRootChecks.minimum);
      expect(rootChecks).toBeLessThanOrEqual(generationRootChecks.maximum);
    },
  );

  test.each(difficultyIds)(
    "レベル %s の図は5手以内に詰まず、正解の手順を持たないこと",
    (difficulty) => {
      const { position } = readPreviewPosition(difficulty);

      expect(isTsumeShogiMateWithin(position, 5)).toBe(false);
    },
  );

  test.each(adjacentLevels)(
    "レベル %s の駒と持駒を、レベル %s の図がすべて同じ位置に含み、初手の王手を増やすこと",
    (lower, upper) => {
      const lowerPreview = readPreviewPosition(lower);
      const upperPreview = readPreviewPosition(upper);

      expect(upperPreview.boardPieces).toEqual(
        expect.arrayContaining(lowerPreview.boardPieces),
      );
      for (const [type, count] of Object.entries(lowerPreview.hand)) {
        expect(
          upperPreview.hand[type as keyof TsumeShogiHand],
        ).toBeGreaterThanOrEqual(count);
      }
      expect(
        listTsumeShogiAttackerChecks(upperPreview.position).length,
      ).toBeGreaterThan(
        listTsumeShogiAttackerChecks(lowerPreview.position).length,
      );
    },
  );

  test.each(difficultyIds)(
    "レベル %s の図の玉方の駒は、どのレベルでも同じであること",
    (difficulty) => {
      const defenderPieces = readPreviewBoardPieces(difficulty)
        .filter(({ piece }) => piece.side === "defender")
        .map(toSquareKey);

      expect(defenderPieces).toEqual(
        readPreviewBoardPieces("1")
          .filter(({ piece }) => piece.side === "defender")
          .map(toSquareKey),
      );
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
