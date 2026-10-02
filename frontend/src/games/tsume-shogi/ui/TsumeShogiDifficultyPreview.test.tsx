import { cleanup, render } from "@testing-library/react";

import { difficultyLevels } from "@/games/difficulty";
import {
  assessTsumeShogiDifficulty,
  type TsumeShogiDifficulty,
} from "@/games/tsume-shogi/difficulty";
import { analyzeTsumeShogiDifficulty } from "@/games/tsume-shogi/problem/difficulty-analysis";
import { createTsumeShogiProblemFingerprint } from "@/games/tsume-shogi/problem/generation/fingerprint";
import { validateTsumeShogiProblem } from "@/games/tsume-shogi/problem/generation/validator";
import type { TsumeShogiProblem } from "@/games/tsume-shogi/problem/problem";
import {
  listTsumeShogiPoolEntries,
  restoreTsumeShogiPoolEntry,
  storeTsumeShogiProblemPool,
} from "@/games/tsume-shogi/problem/problem-pool";
import problemPoolJson from "@/games/tsume-shogi/problem/problem-pool.json";
import { isTsumeShogiMateWithin } from "@/games/tsume-shogi/puzzle/mate-search";
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

const {
  previewProblems,
  readPreviewBoardPieces,
  splitPreviewRow,
  PREVIEW_FILE_COUNT,
} = _private;

// 問題集の本体は画面を開いたときに読み込むので、テストではファイルの内容を先に置いておく。
storeTsumeShogiProblemPool(problemPoolJson);

const difficultyIds = difficultyLevels.map(({ id }) => id);

/** 詰将棋として扱う手数。図の手数は、詰む最短の手数として求める。 */
const supportedPlies = [3, 5] as const;

const sfenLetters: Record<TsumeShogiPieceType, string> = {
  king: "k",
  rook: "r",
  bishop: "b",
  gold: "g",
  silver: "s",
  knight: "n",
  lance: "l",
  pawn: "p",
  dragon: "+r",
  horse: "+b",
  promSilver: "+s",
  promKnight: "+n",
  promLance: "+l",
  promPawn: "+p",
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
      const letter = sfenLetters[boardPiece.piece.type];
      row +=
        boardPiece.piece.side === "attacker" ? letter.toUpperCase() : letter;
    }
    if (emptyCount > 0) row += emptyCount;
    rows.push(row);
  }
  return rows.join("/");
}

/** 図の局面を、詰む最短の手数の問題として読む。作意は strict validator の作意にする。 */
function readPreviewProblem(difficulty: TsumeShogiDifficulty) {
  const hand: Partial<Record<keyof TsumeShogiHand, number>> = {};
  for (const type of previewProblems[difficulty].hand) {
    hand[type] = (hand[type] ?? 0) + 1;
  }
  const initialPosition = createTsumeShogiPosition(
    toSfenBoard(readPreviewBoardPieces(difficulty)),
    hand,
  );
  const plies =
    supportedPlies.find((candidate) =>
      isTsumeShogiMateWithin(initialPosition, candidate),
    ) ?? Math.max(...supportedPlies);
  const validation = validateTsumeShogiProblem(initialPosition, plies);
  const problem: TsumeShogiProblem | null = validation.mainLine
    ? { initialPosition, mainLine: validation.mainLine.moves, plies }
    : null;
  return { validation, problem };
}

function listPoolPositionKeys(): Set<string> {
  return new Set(
    difficultyIds.flatMap((difficulty) =>
      listTsumeShogiPoolEntries(difficulty).map(
        (entry, index) =>
          createTsumeShogiProblemFingerprint(
            restoreTsumeShogiPoolEntry(entry, {
              poolVersion: problemPoolJson.poolVersion,
              problemId: `${difficulty}-${index + 1}`,
            }).problem,
          ).position,
      ),
    ),
  );
}

describe("previewProblems", () => {
  const previews = new Map(
    difficultyIds.map((difficulty) => [
      difficulty,
      readPreviewProblem(difficulty),
    ]),
  );
  const poolPositionKeys = listPoolPositionKeys();

  test.each(difficultyIds)(
    "レベル %s の図は strict validator で問題として成り立つこと",
    (difficulty) => {
      const verdict = previews.get(difficulty)?.validation.verdict;

      expect(verdict).toBe("accepted");
    },
  );

  test.each(difficultyIds)(
    "レベル %s の図はそのレベルに分類されること",
    (difficulty) => {
      const problem = previews.get(difficulty)?.problem;

      const assessment = problem
        ? assessTsumeShogiDifficulty(analyzeTsumeShogiDifficulty(problem))
        : null;

      expect(assessment).toMatchObject({ status: "classified", difficulty });
    },
  );

  test.each(difficultyIds)(
    "レベル %s の図の盤面は切り出した5筋×3段に収まること",
    (difficulty) => {
      const rowLengths = previewProblems[difficulty].board.map(
        (row) => splitPreviewRow(row).length,
      );

      expect(rowLengths).toEqual([
        PREVIEW_FILE_COUNT,
        PREVIEW_FILE_COUNT,
        PREVIEW_FILE_COUNT,
      ]);
    },
  );

  test("どの図も問題集の問題と同じ局面ではないこと", () => {
    const pooledPreviews = difficultyIds.filter((difficulty) => {
      const problem = previews.get(difficulty)?.problem;
      return (
        problem &&
        poolPositionKeys.has(
          createTsumeShogiProblemFingerprint(problem).position,
        )
      );
    });

    expect(pooledPreviews).toEqual([]);
  });

  test("5つの図の攻方の手順はどれも重ならないこと", () => {
    const attacks = difficultyIds.map((difficulty) => {
      const problem = previews.get(difficulty)?.problem;
      return problem && createTsumeShogiProblemFingerprint(problem).attack;
    });

    expect(new Set(attacks).size).toBe(difficultyIds.length);
  });
});

describe("TsumeShogiDifficultyPreview", () => {
  test.each(difficultyIds)(
    "レベル %s では盤上の駒と攻方の持駒をすべて描くこと",
    (difficulty) => {
      const { container } = render(
        <TsumeShogiDifficultyPreview difficulty={difficulty} />,
      );

      expect(container.querySelectorAll("svg[viewBox]")).toHaveLength(
        readPreviewBoardPieces(difficulty).length +
          previewProblems[difficulty].hand.length,
      );
    },
  );
});
