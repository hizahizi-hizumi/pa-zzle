import {
  assessHakoiriMusumeDifficulty,
  classifyHakoiriMusumeFeatures,
} from "@/games/hakoiri-musume/difficulty";
import {
  analyzeHakoiriMusumeDifficulty,
  readHakoiriMusumeDifficultyFeatures,
} from "@/games/hakoiri-musume/problem/difficulty-analysis";
import {
  analyzeHakoiriMusumePieceSet,
  listHakoiriMusumeCandidates,
} from "@/games/hakoiri-musume/problem/generation/pool-selection";
import reference from "@/games/hakoiri-musume/problem/generation/research-reference.json";
import { parseHakoiriMusumeBoard } from "@/games/hakoiri-musume/puzzle/board";

// 調査コード（scripts/research/hakoiri_musume_difficulty.py）が出した、採った案 G の特徴とレベル。
// 全480局面の突き合わせは試験の時間に収まらないので、ここでは合意の2例と、状態の数の少ない駒の組だけを確かめる。

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

describe("listHakoiriMusumeCandidates", () => {
  const smallSets = reference.pieceSets.filter(({ states }) => states <= 5_000);

  describe.each(smallSets)(
    "駒の組 $pieceSet の場合",
    ({ pieceSet, candidates: candidateCount, status }) => {
      const fixtures = reference.fixtures.filter(({ board }) => {
        const counts = { v: 0, h: 0, s: 0 };
        for (const character of board) {
          if (character in counts)
            counts[character as keyof typeof counts] += 1;
        }
        return (
          counts.v === pieceSet.vertical &&
          counts.h === pieceSet.horizontal &&
          counts.s === pieceSet.small
        );
      });

      test("左右反転を除いた候補の数と、分類の状態ごとの数が調査コードと一致すること", () => {
        const candidates = listHakoiriMusumeCandidates(
          analyzeHakoiriMusumePieceSet(pieceSet),
          reference.seed,
        );
        const counts: Record<string, number> = {};
        for (const { assessment } of candidates) {
          const key =
            assessment.status === "classified"
              ? assessment.difficulty
              : assessment.status === "out-of-range"
                ? assessment.reason
                : assessment.status;
          counts[key] = (counts[key] ?? 0) + 1;
        }

        expect(candidates).toHaveLength(candidateCount);
        expect(counts).toEqual(status);
      });

      test("調査コードの標本の局面が、同じ特徴とレベルになること", () => {
        const space = analyzeHakoiriMusumePieceSet(pieceSet);
        const mismatches = fixtures.filter(({ board, features, level }) => {
          const actual = readHakoiriMusumeDifficultyFeatures(
            space.measures,
            space.graph.indexByBoard.get(board)!,
            space.emptyCellCount,
          );
          const assessment = classifyHakoiriMusumeFeatures(actual);
          return (
            Object.entries(features).some(
              ([key, value]) => actual[key as keyof typeof actual] !== value,
            ) ||
            assessment.status !== "classified" ||
            assessment.difficulty !== String(level)
          );
        });

        expect(mismatches).toEqual([]);
      });
    },
  );
});
