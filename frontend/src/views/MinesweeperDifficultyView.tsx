import { minesweeperDifficulties } from "@/games/minesweeper/difficulty";
import { Link } from "@/router";
import { MinesweeperDifficultyOption } from "@/views/MinesweeperDifficultyView/MinesweeperDifficultyOption";

export function MinesweeperDifficultyView() {
  return (
    <section className="space-y-8">
      <div className="space-y-2">
        <Link
          to="/"
          className="text-supporting text-muted-foreground hover:text-foreground"
        >
          ← 戻る
        </Link>
        <h1 className="text-screen-title">マインスイーパー</h1>
      </div>

      <div className="grid gap-3 lg:grid-cols-5 lg:gap-4">
        {minesweeperDifficulties.map((difficulty) => (
          <MinesweeperDifficultyOption
            key={difficulty.id}
            difficulty={difficulty.id}
            label={difficulty.label}
          />
        ))}
      </div>
    </section>
  );
}
