import { assessHakoiriMusumeDifficulty } from "@/games/hakoiri-musume/difficulty";
import { analyzeHakoiriMusumeDifficulty } from "@/games/hakoiri-musume/problem/difficulty-analysis";
import reference from "@/games/hakoiri-musume/problem/generation/research-reference.json";
import { parseHakoiriMusumeBoard } from "@/games/hakoiri-musume/puzzle/board";

// 調査コード（scripts/research/hakoiri_musume_difficulty.py）が出した、採った案 G の特徴とレベル。
// 全492局面の突き合わせは試験の時間に収まらないので、ここでは合意の2例を確かめる。状態の数の少ない駒の組の件数と標本は
// `generation/pool-selection.test.ts` で確かめる。

describe("analyzeHakoiriMusumeDifficulty", () => {
  const agreementCases = reference.fixtures.filter(
    ({ name }) => !name.startsWith("sample-"),
  );

  describe.each(agreementCases)(
    "合意の例 $name の場合",
    ({ board, features, level }) => {
      const problem = { pieces: parseHakoiriMusumeBoard(board)! };

      test("調査コードと同じ特徴とレベルになること", () => {
        const analysis = analyzeHakoiriMusumeDifficulty(problem);
        const assessment = assessHakoiriMusumeDifficulty(analysis);

        expect(analysis).toMatchObject({ status: "analyzed", features });
        expect(assessment).toEqual({
          status: "classified",
          difficulty: String(level),
        });
      });
    },
  );
});
