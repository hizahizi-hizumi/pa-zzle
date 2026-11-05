import {
  findHakoiriMusumePoolEntryByProblemId,
  listHakoiriMusumePoolProblemIds,
} from "@/games/hakoiri-musume/problem/problem-pool";
import {
  findHakoiriMusumePoolProblemFeatures,
  measureHakoiriMusumeProblemFeatures,
} from "@/games/hakoiri-musume/problem-features";
import { parseHakoiriMusumeBoard } from "@/games/hakoiri-musume/puzzle/board";

/** 盤面の20文字で `character` が占めるマスの数。 */
function countCells(board: string, character: string): number {
  return [...board].filter((cell) => cell === character).length;
}

describe("findHakoiriMusumePoolProblemFeatures", () => {
  const [problemId] = listHakoiriMusumePoolProblemIds("1");
  const [board] = findHakoiriMusumePoolEntryByProblemId("1", problemId!)!;

  test("問題集の盤面から横長と小駒の数を数えること", () => {
    const features = findHakoiriMusumePoolProblemFeatures("1", problemId!);

    // 横長は左端の `h` 1マス、小駒は `s` 1マスで1個
    expect(features).toMatchObject({
      horizontalCount: countCells(board, "h"),
      smallCount: countCells(board, "s"),
    });
  });

  test("問題集に無い問題 ID には null を返すこと", () => {
    const features = findHakoiriMusumePoolProblemFeatures("1", "unknown");

    expect(features).toBeNull();
  });
});

describe("measureHakoiriMusumeProblemFeatures", () => {
  const cases = [
    ["横刀立馬（出口の前の2マスがつながる）", "vAAvwAAwvhivwssws..s", 1],
    ["右上の2マスと下の2マスが離れている", "vAA.wAA.svsvvwsww.s.", 3],
    ["上の段と下の段の2か所", "..hiAAhiAAhihihis..s", 2],
  ] as const;

  test.each(cases)(
    "上下左右でつながった空きを1か所と数えること: %s",
    (_, board, expected) => {
      const features = measureHakoiriMusumeProblemFeatures(
        parseHakoiriMusumeBoard(board)!,
      );

      expect(features.emptyGroupCount).toBe(expected);
    },
  );
});
