import {
  getReflectionSymmetryKey,
  listReflectionBoardSymmetries,
  mirrorReflectionBoardLeftRight,
  rotateReflectionBoardClockwise,
} from "@/games/reflection/problem/generation/symmetry";
import { parseReflectionBoard } from "@/games/reflection/puzzle/board";
import {
  computeReflectionClues,
  type ReflectionClue,
} from "@/games/reflection/puzzle/laser";

function toSortedClueKeys(clues: readonly ReflectionClue[]): string[] {
  return clues.map((clue) => `${clue.outcome}:${clue.distance}`).sort();
}

describe("rotateReflectionBoardClockwise", () => {
  const board = parseReflectionBoard(["/|.", "...", "..."]);

  test("配置を時計回りに回し、斜め鏡と両面鏡の向きを入れ替えること", () => {
    const result = rotateReflectionBoardClockwise(board);

    expect(result).toEqual(parseReflectionBoard(["..\\", "..=", "..."]));
  });
});

describe("mirrorReflectionBoardLeftRight", () => {
  const board = parseReflectionBoard(["/|=", "...", "..."]);

  test("配置を左右反転し、斜め鏡の向きだけを入れ替えること", () => {
    const result = mirrorReflectionBoardLeftRight(board);

    expect(result).toEqual(parseReflectionBoard(["=|\\", "...", "..."]));
  });
});

describe("listReflectionBoardSymmetries", () => {
  const board = parseReflectionBoard(["/...", ".|o.", "..=@", "\\..."]);

  test("どの同型盤面も外周ヒントの組を並べ替えたものになること", () => {
    const symmetries = listReflectionBoardSymmetries(board);

    const clueSets = symmetries.map((symmetry) =>
      toSortedClueKeys(computeReflectionClues(symmetry)),
    );
    expect(symmetries).toHaveLength(8);
    for (const clueSet of clueSets) {
      expect(clueSet).toEqual(toSortedClueKeys(computeReflectionClues(board)));
    }
  });
});

describe("getReflectionSymmetryKey", () => {
  const board = parseReflectionBoard(["/..", ".o.", "..@"]);
  const otherBoard = parseReflectionBoard(["/..", "o..", "..@"]);

  test("回転・反転した盤面に同じキーを返すこと", () => {
    const keys = listReflectionBoardSymmetries(board).map(
      getReflectionSymmetryKey,
    );

    expect(new Set(keys).size).toBe(1);
  });

  test("同型でない盤面に別のキーを返すこと", () => {
    const key = getReflectionSymmetryKey(board);
    const otherKey = getReflectionSymmetryKey(otherBoard);

    expect(otherKey).not.toBe(key);
  });

  describe("斜め鏡を1つだけ置いた盤面", () => {
    const singlePieceBoard = parseReflectionBoard(["/..", "...", "..."]);

    test("マス番号の並びが辞書順で最小になる向きをキーにすること", () => {
      const key = getReflectionSymmetryKey(singlePieceBoard);

      expect(key).toBe("000000001");
    });
  });
});
