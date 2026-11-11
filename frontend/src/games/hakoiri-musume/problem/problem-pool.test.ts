import { difficultyLevels } from "@/games/difficulty";
import { assessHakoiriMusumeDifficulty } from "@/games/hakoiri-musume/difficulty";
import { analyzeHakoiriMusumeDifficulty } from "@/games/hakoiri-musume/problem/difficulty-analysis";
import {
  decodeHakoiriMusumePoolEntry,
  findHakoiriMusumePoolEntryByProblemId,
  findHakoiriMusumePoolProblemFeatures,
  listHakoiriMusumePoolEntries,
  listHakoiriMusumePoolProblemIds,
  measureHakoiriMusumeProblemFeatures,
  restoreHakoiriMusumePoolEntry,
} from "@/games/hakoiri-musume/problem/problem-pool";
import { parseHakoiriMusumeBoard } from "@/games/hakoiri-musume/puzzle/board";
import { createProblemId } from "@/games/problem-id";

const poolEntries = difficultyLevels.flatMap(({ id: difficulty }) =>
  listHakoiriMusumePoolEntries(difficulty).map((entry) => ({
    difficulty,
    entry,
    problemId: createProblemId(decodeHakoiriMusumePoolEntry(entry).identity),
  })),
);

describe("listHakoiriMusumePoolEntries", () => {
  const countCases = [
    ["1", 400, 500],
    ["2", 400, 500],
    ["3", 400, 500],
    ["4", 400, 500],
    ["5", 150, 200],
  ] as const;

  test.each(countCases)(
    "レベル %s は %i 問以上 %i 問以下を持つこと",
    (difficulty, minimum, maximum) => {
      const entries = listHakoiriMusumePoolEntries(difficulty);

      expect(entries.length).toBeGreaterThanOrEqual(minimum);
      expect(entries.length).toBeLessThanOrEqual(maximum);
    },
  );
});

describe("restoreHakoiriMusumePoolEntry", () => {
  test("全項目の盤面を問題として読み、最短手数と準備の長さを添えること", () => {
    const restored = poolEntries.map(({ entry }) =>
      restoreHakoiriMusumePoolEntry(entry),
    );

    expect(
      restored.every(
        ({ workload }, index) =>
          workload.optimalMoveCount === poolEntries[index]!.entry[1] &&
          workload.preparationLength === poolEntries[index]!.entry[2],
      ),
    ).toBe(true);
  });

  describe("レベル5 の先頭の問題の場合", () => {
    // 全問の分析し直しは問題集の生成スクリプトの --verify が受け持つ。ここでは全局面の少ない1問で、問題集と分析のつながりを確かめる。
    const pooled = restoreHakoiriMusumePoolEntry(
      listHakoiriMusumePoolEntries("5")[0]!,
    );

    // 全局面をたどる分析は数秒かかるので、試験の時間の上限に掛からないよう、準備の段で済ませる。
    const analysis = analyzeHakoiriMusumeDifficulty(pooled.problem);

    test("分析し直すと、問題集の最短手数・準備の長さとレベルになること", () => {
      const assessment = assessHakoiriMusumeDifficulty(analysis);

      expect(analysis).toMatchObject({
        status: "analyzed",
        features: {
          optimalMoveCount: pooled.workload.optimalMoveCount,
          preparationLength: pooled.workload.preparationLength,
        },
      });
      expect(assessment).toEqual({ status: "classified", difficulty: "5" });
    });
  });
});

describe("findHakoiriMusumePoolEntryByProblemId", () => {
  const firstLevelOneEntry = poolEntries.find(
    ({ difficulty }) => difficulty === "1",
  )!;

  test("問題集の全項目の問題IDが互いに異なること", () => {
    const distinctProblemIds = new Set(
      poolEntries.map(({ problemId }) => problemId),
    );

    expect(distinctProblemIds.size).toBe(poolEntries.length);
  });

  test("問題集の全項目をその難易度と問題IDで引けること", () => {
    const unresolvedEntries = poolEntries.filter(
      ({ difficulty, entry, problemId }) =>
        findHakoiriMusumePoolEntryByProblemId(difficulty, problemId) !== entry,
    );

    expect(unresolvedEntries).toEqual([]);
  });

  test("別の難易度の問題IDには null を返すこと", () => {
    const entry = findHakoiriMusumePoolEntryByProblemId(
      "2",
      firstLevelOneEntry.problemId,
    );

    expect(entry).toBeNull();
  });
});

/** 盤面の20文字で `character` が占めるマスの数。 */
function countCells(board: string, character: string): number {
  return [...board].filter((cell) => cell === character).length;
}

describe("findHakoiriMusumePoolProblemFeatures", () => {
  const [problemId] = listHakoiriMusumePoolProblemIds("1");
  const [board] = findHakoiriMusumePoolEntryByProblemId("1", problemId!)!;

  test("問題集の盤面から横長・縦長・小駒の数を数えること", () => {
    const features = findHakoiriMusumePoolProblemFeatures("1", problemId!);

    // 横長は左端の `h`、縦長は上端の `v`、小駒は `s` の1マスで1個
    expect(features).toMatchObject({
      horizontalCount: countCells(board, "h"),
      verticalCount: countCells(board, "v"),
      smallCount: countCells(board, "s"),
      emptyCellCount: countCells(board, "."),
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
