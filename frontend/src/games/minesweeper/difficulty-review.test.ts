import {
  _private,
  assessMinesweeperDifficultyReviewProblems,
  formatMinesweeperProblemIdentitySearch,
  restoreMinesweeperProblemFromSearch,
} from "@/games/minesweeper/difficulty-review";
import type { MinesweeperProblemIdentity } from "@/games/minesweeper/problem/problem";

const { parseMinesweeperProblemIdentitySearch } = _private;

describe("assessMinesweeperDifficultyReviewProblems", () => {
  const entries = assessMinesweeperDifficultyReviewProblems();

  test("難易度ごとに3問ずつ並べること", () => {
    const counts = Object.groupBy(entries, (entry) => entry.difficulty);

    expect(
      Object.fromEntries(
        Object.entries(counts).map(([difficulty, group]) => [
          difficulty,
          group?.length,
        ]),
      ),
    ).toEqual({ 1: 3, 2: 3, 3: 3, 4: 3, 5: 3 });
  });

  test("全ての確認用問題を載せている難易度に分類すること", () => {
    for (const entry of entries) {
      expect(entry.assessment).toEqual({
        status: "classified",
        difficulty: entry.difficulty,
      });
    }
  });
});

describe("formatMinesweeperProblemIdentitySearch", () => {
  const identity: MinesweeperProblemIdentity = {
    generatorVersion: "1",
    seed: "ms-10x10-15-125",
    conditions: {
      rows: 10,
      columns: 10,
      mineCount: 15,
      startCellPlacement: "random",
    },
    generationAttempt: 1,
  };

  test("検索パラメータから同じ問題の再現情報へ戻せること", () => {
    const search = formatMinesweeperProblemIdentitySearch(identity);
    const parsedIdentity = parseMinesweeperProblemIdentitySearch(
      new URLSearchParams(search),
    );

    expect(search).toBe(
      "?seed=ms-10x10-15-125&rows=10&columns=10&mines=15&start=random&attempt=1",
    );
    expect(parsedIdentity).toEqual(identity);
  });
});

describe("restoreMinesweeperProblemFromSearch", () => {
  const cases = [
    ["項目が欠けた検索パラメータ", "?seed=a&rows=10&columns=10&mines=15"],
    [
      "整数でない盤面サイズ",
      "?seed=a&rows=ten&columns=10&mines=15&start=random&attempt=1",
    ],
    [
      "未定義の開始マスの決め方",
      "?seed=a&rows=10&columns=10&mines=15&start=corner&attempt=1",
    ],
    [
      "生成できない盤面サイズ",
      "?seed=a&rows=99&columns=10&mines=15&start=random&attempt=1",
    ],
  ] as const;

  test.each(cases)("%sを復元できない問題とすること", (_name, search) => {
    const result = restoreMinesweeperProblemFromSearch(
      new URLSearchParams(search),
    );

    expect(result).toBeUndefined();
  });
});
