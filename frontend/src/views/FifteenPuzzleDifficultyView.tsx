import { fifteenPuzzleDifficulties } from "@/games/fifteen-puzzle/difficulty";
import { Link } from "@/router";
import { FifteenPuzzleDifficultyOption } from "@/views/FifteenPuzzleDifficultyView/FifteenPuzzleDifficultyOption";

export function FifteenPuzzleDifficultyView() {
  return (
    <section className="space-y-6 sm:space-y-8">
      <div className="space-y-2">
        <Link
          to="/"
          className="text-supporting text-muted-foreground hover:text-foreground"
        >
          ← 戻る
        </Link>
        <h1 className="text-screen-title">15パズル</h1>
      </div>

      <div className="grid gap-2 sm:gap-4 lg:grid-cols-5">
        {fifteenPuzzleDifficulties.map((difficulty) => (
          <FifteenPuzzleDifficultyOption
            key={difficulty.id}
            difficulty={difficulty.id}
            label={difficulty.label}
          />
        ))}
      </div>
    </section>
  );
}
