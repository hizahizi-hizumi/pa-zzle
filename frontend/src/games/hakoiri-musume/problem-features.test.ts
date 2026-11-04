import {
  findHakoiriMusumePoolEntryByProblemId,
  listHakoiriMusumePoolProblemIds,
} from "@/games/hakoiri-musume/problem/problem-pool";
import { findHakoiriMusumePoolProblemFeatures } from "@/games/hakoiri-musume/problem-features";

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
    expect(features).toEqual({
      horizontalCount: countCells(board, "h"),
      smallCount: countCells(board, "s"),
    });
  });

  test("問題集に無い問題 ID には null を返すこと", () => {
    const features = findHakoiriMusumePoolProblemFeatures("1", "unknown");

    expect(features).toBeNull();
  });
});
