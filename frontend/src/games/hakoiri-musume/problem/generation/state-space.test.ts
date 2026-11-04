import reference from "@/games/hakoiri-musume/problem/generation/research-reference.json";
import {
  countHakoiriMusumeEmptyCells,
  enumerateHakoiriMusumePieceSetBoards,
  listHakoiriMusumeNextBoards,
  mirrorHakoiriMusumeBoard,
} from "@/games/hakoiri-musume/problem/generation/state-space";
import {
  formatHakoiriMusumeBoard,
  parseHakoiriMusumeBoard,
} from "@/games/hakoiri-musume/puzzle/board";
import {
  listHakoiriMusumePieceDestinations,
  placeHakoiriMusumePiece,
} from "@/games/hakoiri-musume/puzzle/rules";
import { createHakoiriMusumeInitialState } from "@/games/hakoiri-musume/puzzle/state";
import { createProblemSeededRandom } from "@/games/problem-seed";

/** ルールの関数（駒ごとの1手の行き先）で求めた、1手で行ける盤面。 */
function listNextBoardsByRules(board: string): string[] {
  const state = createHakoiriMusumeInitialState(
    parseHakoiriMusumeBoard(board)!,
  );
  const boards = new Set<string>();
  state.pieces.forEach((_, pieceIndex) => {
    for (const cell of listHakoiriMusumePieceDestinations(state, pieceIndex)) {
      boards.add(
        formatHakoiriMusumeBoard(
          placeHakoiriMusumePiece(state, pieceIndex, cell).pieces,
        ),
      );
    }
  });
  return [...boards].sort();
}

describe("listHakoiriMusumeNextBoards", () => {
  // 横刀立馬の駒の組の全局面から、無作為に選んだ局面
  const random = createProblemSeededRandom("hakoiri-state-space");
  const allBoards = enumerateHakoiriMusumePieceSetBoards({
    vertical: 4,
    horizontal: 1,
    small: 4,
  });
  const boards = Array.from(
    { length: 300 },
    () => allBoards[Math.floor(random() * allBoards.length)]!,
  );

  test("ルールの関数で求めた1手の行き先と一致すること", () => {
    const mismatches = boards.filter(
      (board) =>
        listHakoiriMusumeNextBoards(board).sort().join() !==
        listNextBoardsByRules(board).join(),
    );

    expect(mismatches).toEqual([]);
  });
});

describe("mirrorHakoiriMusumeBoard", () => {
  const cases = [
    ["横刀立馬", "vAAvwAAwvhivwssws..s", "vAAvwAAwvhivwssws..s"],
    // sAA. / vAA. / w... / hi.. / s..s を左右に反転する
    ["左右対称でない盤面", "sAA.vAA.w...hi..s..s", ".AAs.AAv...w..his..s"],
  ] as const;

  test.each(cases)("左右を反転すること: %s", (_, board, expected) => {
    const mirrored = mirrorHakoiriMusumeBoard(board);

    expect(mirrored).toBe(expected);
  });
});

describe("enumerateHakoiriMusumePieceSetBoards", () => {
  // 調査コードが数えた、状態の数の少ない駒の組
  const cases = reference.pieceSets.filter(({ states }) => states <= 5_000);

  test.each(cases)(
    "駒の組の置き方を調査コードと同じ数だけ数え上げること: $pieceSet",
    ({ pieceSet, states }) => {
      const boards = enumerateHakoiriMusumePieceSetBoards(pieceSet);

      expect(boards).toHaveLength(states);
      expect(new Set(boards).size).toBe(states);
      expect(
        boards.every(
          (board) =>
            countHakoiriMusumeEmptyCells(board) ===
            16 - 2 * (pieceSet.vertical + pieceSet.horizontal) - pieceSet.small,
        ),
      ).toBe(true);
    },
  );
});
