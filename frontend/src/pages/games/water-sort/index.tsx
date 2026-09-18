import { waterSortDifficulties } from "@/games/water-sort/game/difficulty";
import { Link } from "@/router";

export default function WaterSortDifficultyPage() {
  return (
    <section className="space-y-8">
      <div className="space-y-2">
        <Link
          to="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← 戻る
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">ウォーターソート</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {waterSortDifficulties.map((difficulty) => (
          <Link
            key={difficulty.id}
            to="/games/water-sort/play/:difficulty"
            params={{ difficulty: difficulty.id }}
            className="block py-4 text-center text-xl font-semibold tracking-tight underline-offset-4 hover:underline"
          >
            {difficulty.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
