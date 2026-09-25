import { takuzuDifficulties } from "@/games/takuzu/difficulty";
import { Link } from "@/router";
import { TakuzuDifficultyOption } from "@/views/TakuzuDifficultyView/TakuzuDifficultyOption";

export function TakuzuDifficultyView() {
  return (
    <section className="space-y-6 sm:space-y-8">
      <div className="space-y-2">
        <Link
          to="/"
          className="text-supporting text-muted-foreground hover:text-foreground"
        >
          ← 戻る
        </Link>
        <h1 className="text-screen-title">バイナリパズル</h1>
      </div>

      <div className="grid gap-3 lg:grid-cols-5 lg:gap-4">
        {takuzuDifficulties.map((difficulty) => (
          <TakuzuDifficultyOption
            key={difficulty.id}
            difficulty={difficulty.id}
            label={difficulty.label}
          />
        ))}
      </div>
    </section>
  );
}
