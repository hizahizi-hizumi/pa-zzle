import { difficultyLevels } from "@/games/difficulty";
import { assessHakoiriMusumeDifficulty } from "@/games/hakoiri-musume/difficulty";
import { analyzeHakoiriMusumeDifficulty } from "@/games/hakoiri-musume/problem/difficulty-analysis";
import {
  decodeHakoiriMusumePoolEntry,
  findHakoiriMusumePoolEntryByProblemId,
  listHakoiriMusumePoolEntries,
  restoreHakoiriMusumePoolEntry,
} from "@/games/hakoiri-musume/problem/problem-pool";
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
    ["1", 500],
    ["2", 500],
    ["3", 500],
    ["4", 500],
    ["5", 300],
  ] as const;

  test.each(countCases)("レベル %s は %i 問を持つこと", (difficulty, count) => {
    const entries = listHakoiriMusumePoolEntries(difficulty);

    expect(entries).toHaveLength(count);
  });
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

    test("分析し直すと、問題集の最短手数・準備の長さとレベルになること", () => {
      const analysis = analyzeHakoiriMusumeDifficulty(pooled.problem);
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
