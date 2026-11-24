import { listFukumenzanNearProblemKeys } from "@/games/fukumenzan/problem/generation/near-problem-keys";
import researchCases from "@/games/fukumenzan/problem/generation/research-difficulty-cases.json";
import { parseFukumenzanEquation } from "@/games/fukumenzan/problem/problem";

describe("listFukumenzanNearProblemKeys", () => {
  test.each(researchCases.nearProblem)(
    "$left と $right が共有するキーが研究用の期待値と同じになること",
    ({ left, right, shared }) => {
      const [leftKeys, rightKeys] = [left, right].map((text) =>
        listFukumenzanNearProblemKeys(parseFukumenzanEquation(text)!),
      );
      const common = [...leftKeys!].filter((key) => rightKeys!.has(key));

      expect(common.toSorted()).toEqual(shared);
    },
  );

  describe("足す数を並べ替えた式の場合", () => {
    const problem = parseFukumenzanEquation("NNV+UFN+NTT=NFVT")!;
    const reordered = parseFukumenzanEquation("NTT+UFN+NNV=NFVT")!;

    test("同じキーの集まりを返すこと", () => {
      const keys = [problem, reordered].map((equation) =>
        [...listFukumenzanNearProblemKeys(equation)].toSorted(),
      );

      expect(keys[0]).toEqual(keys[1]);
    });
  });
});
