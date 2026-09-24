import {
  _private,
  assessMinesweeperDifficultyReviewProblems,
  formatMinesweeperProblemIdentitySearch,
  restoreMinesweeperProblemFromSearch,
} from "./difficulty-review";
import type { MinesweeperProblemIdentity } from "./problem/problem";

const { parseMinesweeperProblemIdentitySearch } = _private;

describe("assessMinesweeperDifficultyReviewProblems", () => {
  test("全ての確認用問題を推測なしで解ける問題として判定すること", () => {
    const entries = assessMinesweeperDifficultyReviewProblems();

    const statuses = new Set(entries.map((entry) => entry.assessment.status));
    expect([...statuses].sort()).toEqual(["classified", "out-of-range"]);
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
