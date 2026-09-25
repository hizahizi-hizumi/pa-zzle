import { useState } from "react";

import { minesweeperDifficulties } from "@/games/minesweeper/difficulty";
import type { MinesweeperDifficultyReviewEntry } from "@/games/minesweeper/difficulty-review";
import { assessMinesweeperDifficultyReviewProblems } from "@/games/minesweeper/difficulty-review";
import { Link } from "@/router";
import { DifficultyReviewRow } from "@/views/MinesweeperDifficultyReviewView/DifficultyReviewRow";

// 難易度ごとの盤面範囲と推論の条件を人が遊んで比べるための一時的な確認画面。
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

      {minesweeperDifficulties.map(({ id, label }) => (
        <section key={id} aria-label={label} className="space-y-2">
          <h2 className="border-b-(length:--border-width-normal) pb-2 text-heading">
            {label}
          </h2>
          <ul>
            {entries
              .filter((entry) => entry.difficulty === id)
              .map((entry) => (
                <li key={entry.identity.seed}>
                  <DifficultyReviewRow entry={entry} />
                </li>
              ))}
          </ul>
        </section>
      ))}
    </section>
  );
}
