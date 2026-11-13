import { assessHakoiriMusumeDifficulty } from "@/games/hakoiri-musume/difficulty";
import { analyzeHakoiriMusumeDifficulty } from "@/games/hakoiri-musume/problem/difficulty-analysis";
import reference from "@/games/hakoiri-musume/problem/generation/research-reference.json";
import {
  hakoiriMusumeClassicLayout,
  parseHakoiriMusumeClassicBoard,
} from "@/games/hakoiri-musume/puzzle/classic-board";
import { parseHakoiriMusumeArrangement } from "@/games/hakoiri-musume/puzzle/notation";

// 調査コード（scripts/research/hakoiri_musume_difficulty.py）が出した、採った案 H の特徴とレベル。
// 全479局面の突き合わせは試験の時間に収まらないので、ここでは易しい例と横刀立馬を確かめる。前の問題集の全問の値は、
// 問題集の生成スクリプトの `--verify` で確かめる。

describe("analyzeHakoiriMusumeDifficulty", () => {
  const agreementCases = reference.fixtures.filter(
    ({ name }) => !name.startsWith("sample-"),
  );

  describe.each(agreementCases)(
    "例 $name の場合",
    ({ board, features, level }) => {
      // 全局面をたどる分析は数秒かかるので、試験の時間の上限に掛からないよう、準備の段で済ませる。
      const analysis = analyzeHakoiriMusumeDifficulty({
        layout: hakoiriMusumeClassicLayout,
        pieces: parseHakoiriMusumeClassicBoard(board)!,
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
    layout: hakoiriMusumeClassicLayout,
    pieces: parseHakoiriMusumeClassicBoard("hihisAAsvAAvwhiw....")!,
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

describe("壁のある盤の問題の場合", () => {
  // 試遊用の問題 W2d-1（壁が左上と右下の角）。最短 19 手。
  const analysis = analyzeHakoiriMusumeDifficulty(
    parseHakoiriMusumeArrangement(
      "4x5;#a../bac./bAA./dAAe/ffg#;bottom1-2@3.1",
    )!,
  );

  test("全局面をたどって分析し、壁を空きに数えないこと", () => {
    expect(analysis).toMatchObject({
      status: "analyzed",
      features: { optimalMoveCount: 19, emptyCellCount: 4 },
    });
  });
});

describe("6 × 6 の盤の問題の場合", () => {
  const analysis = analyzeHakoiriMusumeDifficulty(
    parseHakoiriMusumeArrangement(
      "6x6;.AAa.b/cAAadb/ceffd./gehijk/g.hijk/llmmnn;bottom2-3@4.2",
    )!,
  );

  test("全局面を数え切れないので、分析しないと返すこと", () => {
    expect(analysis).toEqual({
      status: "unsupported",
      reason: "unsupported-board",
    });
  });
});
