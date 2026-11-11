import { assessHakoiriMusumeDifficulty } from "@/games/hakoiri-musume/difficulty";
import { analyzeHakoiriMusumeDifficulty } from "@/games/hakoiri-musume/problem/difficulty-analysis";
import reference from "@/games/hakoiri-musume/problem/generation/research-reference.json";
import { parseHakoiriMusumeBoard } from "@/games/hakoiri-musume/puzzle/board";

// 調査コード（scripts/research/hakoiri_musume_difficulty.py）が出した、採った案 H の特徴とレベル。
// 全479局面の突き合わせは試験の時間に収まらないので、ここでは合意の2例を確かめる。状態の数の少ない駒の組の件数と標本は
// `generation/pool-selection.test.ts` で確かめる。

describe("analyzeHakoiriMusumeDifficulty", () => {
  const agreementCases = reference.fixtures.filter(
    ({ name }) => !name.startsWith("sample-"),
  );

  describe.each(agreementCases)(
    "合意の例 $name の場合",
    ({ board, features, level }) => {
      // 全局面をたどる分析は数秒かかるので、試験の時間の上限に掛からないよう、準備の段で済ませる。
      const analysis = analyzeHakoiriMusumeDifficulty({
        pieces: parseHakoiriMusumeBoard(board)!,
      });

      test("調査コードと同じ特徴とレベルになること", () => {
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

describe("娘の1手をグラフの2辺に分けると準備の長さが下がる盤面の場合", () => {
  // 反例探し（2回目）の盤面。最短の解の準備（14）が最短手数の 0.87 倍を超えるので、提供範囲外。
  const analysis = analyzeHakoiriMusumeDifficulty({
    pieces: parseHakoiriMusumeBoard("hihisAAsvAAvwhiw....")!,
  });

  test("準備の長さを 9 と数え、提供範囲外とすること", () => {
    const assessment = assessHakoiriMusumeDifficulty(analysis);

    expect(analysis).toMatchObject({
      status: "analyzed",
      features: { preparationLength: 9 },
    });
    expect(assessment.status).toBe("out-of-range");
  });
});
