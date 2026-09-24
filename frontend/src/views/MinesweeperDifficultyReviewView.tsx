import { useState } from "react";

import type { MinesweeperDifficultyReviewEntry } from "@/games/minesweeper/difficulty-review";
import { assessMinesweeperDifficultyReviewProblems } from "@/games/minesweeper/difficulty-review";
import type { MinesweeperDifficultyReviewGroup } from "@/games/minesweeper/problem/difficulty-review-problems";
import { Link } from "@/router";
import { DifficultyReviewRow } from "@/views/MinesweeperDifficultyReviewView/DifficultyReviewRow";

const reviewGroups: readonly {
  group: MinesweeperDifficultyReviewGroup;
  title: string;
}[] = [
  { group: "representative", title: "代表（難易度1〜5）" },
  { group: "boundary", title: "境界" },
  { group: "anomaly", title: "異常" },
];

// 難易度分類を人が遊んで比べるための一時的な確認画面。
export function MinesweeperDifficultyReviewView() {
  const [entries] = useState<readonly MinesweeperDifficultyReviewEntry[]>(() =>
    assessMinesweeperDifficultyReviewProblems(),
  );

  return (
    <section className="mx-auto w-full max-w-3xl space-y-8">
      <div className="space-y-2">
        <Link
          to="/puzzles/minesweeper"
          className="text-supporting text-muted-foreground hover:text-foreground"
        >
          ← 難易度選択
        </Link>
        <h1 className="text-screen-title">マインスイーパー難易度の確認</h1>
      </div>

      {reviewGroups.map(({ group, title }) => (
        <section key={group} aria-label={title} className="space-y-2">
          <h2 className="border-b-(length:--border-width-normal) pb-2 text-heading">
            {title}
          </h2>
          <ul>
            {entries
              .filter((entry) => entry.group === group)
              .map((entry) => (
                <li key={`${group}:${entry.identity.seed}`}>
                  <DifficultyReviewRow entry={entry} />
                </li>
              ))}
          </ul>
        </section>
      ))}
    </section>
  );
}
