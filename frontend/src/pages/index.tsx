import { GameSelectionCard } from "@/components/GameSelectionCard";
import sudokuPictogram from "../../../.claude/skills/design-game-pictogram/examples/sudoku.svg";
import waterSortPictogram from "../../../.claude/skills/design-game-pictogram/examples/water-sort.svg";

export default function HomePage() {
  return (
    <section className="space-y-8">
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">
          ゲームを選ぶ
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          今日はどのパズルで遊びますか？
        </h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <GameSelectionCard
          to="/games/water-sort"
          name="カラーウォーターソート"
          pictogramSrc={waterSortPictogram}
        />
        <GameSelectionCard
          to="/games/sudoku"
          name="ナンプレ"
          pictogramSrc={sudokuPictogram}
        />
      </div>
    </section>
  );
}
