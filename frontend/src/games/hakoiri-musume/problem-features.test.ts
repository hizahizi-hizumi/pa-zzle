import { listHakoiriMusumePoolProblemIds } from "@/games/hakoiri-musume/problem/problem-pool";
import { findHakoiriMusumePoolProblemFeatures } from "@/games/hakoiri-musume/problem-features";

describe("findHakoiriMusumePoolProblemFeatures", () => {
  // レベル1 の問題集の先頭は合意の易しい例（横長1個・小駒2個）。
  const [problemId] = listHakoiriMusumePoolProblemIds("1");

  test("問題集の盤面から横長と小駒の数を数えること", () => {
    const features = findHakoiriMusumePoolProblemFeatures("1", problemId!);

    expect(features).toEqual({ horizontalCount: 1, smallCount: 2 });
  });

  test("問題集に無い問題 ID には null を返すこと", () => {
    const features = findHakoiriMusumePoolProblemFeatures("1", "unknown");

    expect(features).toBeNull();
  });
});
