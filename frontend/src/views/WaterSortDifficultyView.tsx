import { waterSortDifficulties } from "@/games/water-sort/difficulty";
import { Link } from "@/router";
import { WaterSortDifficultyOption } from "@/views/WaterSortDifficultyView/WaterSortDifficultyOption";

export function WaterSortDifficultyView() {
  return (
    <section className="space-y-8">
      <div className="space-y-2">
        <Link
          to="/"
          className="text-supporting text-muted-foreground hover:text-foreground"
        >
          ← 戻る
        </Link>
        <h1 className="text-screen-title">ウォーターソート</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {waterSortDifficulties.map((difficulty) => (
          <WaterSortDifficultyOption
            key={difficulty.id}
            difficulty={difficulty.id}
            label={difficulty.label}
          />
        ))}
      </div>
    </section>
  );
}
