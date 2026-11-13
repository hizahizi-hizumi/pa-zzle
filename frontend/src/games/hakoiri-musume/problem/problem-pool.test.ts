import { difficultyLevels } from "@/games/difficulty";
import type { HakoiriMusumeDifficulty } from "@/games/hakoiri-musume/difficulty";
import { assessHakoiriMusumeDifficulty } from "@/games/hakoiri-musume/difficulty";
import { analyzeHakoiriMusumeDifficulty } from "@/games/hakoiri-musume/problem/difficulty-analysis";
import {
  decodeHakoiriMusumePoolEntry,
  findHakoiriMusumePoolEntryByProblemId,
  findHakoiriMusumePoolProblemFeatures,
  type HakoiriMusumeProblemPoolEntry,
  listHakoiriMusumePoolEntries,
  listHakoiriMusumePoolProblemIds,
  measureHakoiriMusumeProblemFeatures,
  restoreHakoiriMusumePoolEntry,
} from "@/games/hakoiri-musume/problem/problem-pool";
import problemPoolJson from "@/games/hakoiri-musume/problem/problem-pool.json";
import {
  hakoiriMusumeClassicLayout,
  parseHakoiriMusumeClassicBoard,
} from "@/games/hakoiri-musume/puzzle/classic-board";
import { parseHakoiriMusumeArrangement } from "@/games/hakoiri-musume/puzzle/notation";
import { createProblemId } from "@/games/problem-id";

const poolEntries = difficultyLevels.flatMap(({ id: difficulty }) =>
  listHakoiriMusumePoolEntries(difficulty).map((entry) => ({
    difficulty,
    entry,
    problemId: createProblemId(decodeHakoiriMusumePoolEntry(entry).identity),
  })),
);

describe("listHakoiriMusumePoolEntries", () => {
  test.each(difficultyLevels.map(({ id }) => id))(
    "レベル %s は 500 問を持つこと",
    (difficulty) => {
      const entries = listHakoiriMusumePoolEntries(difficulty);

      expect(entries.length).toBe(500);
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

  describe("並びから外した前の問題集の問題の場合", () => {
    const [retiredDifficulty, retiredEntries] = Object.entries(
      problemPoolJson.retired,
    ).find(([, entries]) => entries.length > 0)! as unknown as [
      HakoiriMusumeDifficulty,
      HakoiriMusumeProblemPoolEntry[],
    ];
    const retired = retiredEntries[0]!;
    const problemId = createProblemId(
      decodeHakoiriMusumePoolEntry(retired).identity,
    );

    test("問題 ID で引けて、並びには出さないこと", () => {
      const found = findHakoiriMusumePoolEntryByProblemId(
        retiredDifficulty,
        problemId,
      );
      const listed = poolEntries.some(
        (candidate) => candidate.problemId === problemId,
      );

      expect(found).toEqual(retired);
      expect(listed).toBe(false);
    });
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
      const features = measureHakoiriMusumeProblemFeatures({
        layout: hakoiriMusumeClassicLayout,
        pieces: parseHakoiriMusumeClassicBoard(board)!,
      });

      expect(features.emptyGroupCount).toBe(expected);
    },
  );

  describe("壁・L字・目標2つ・横の出口のある盤の場合", () => {
    const features = measureHakoiriMusumeProblemFeatures(
      parseHakoiriMusumeArrangement(
        "4x5;#BB./aAA./.AAb/cc.b/d..#;right1-2@1.2;top1-2@0.1",
      )!,
    );

    test("盤の大きさ・娘の数・出口・壁を数え、壁を空きに数えないこと", () => {
      expect(features).toMatchObject({
        rows: 5,
        columns: 4,
        targetCount: 2,
        wallCount: 2,
        exitWidth: 2,
        exits: [
          { side: "right", width: 2 },
          { side: "top", width: 2 },
        ],
        emptyCellCount: 6,
      });
    });
  });
});
