import { nanpureDifficulties } from "@/games/nanpure/difficulty";
import { Link } from "@/router";
import { NanpureDifficultyOption } from "@/views/NanpureDifficultyView/NanpureDifficultyOption";

export function NanpureDifficultyView() {
  return (
    <section className="space-y-8">
      <div className="space-y-2">
        <Link
          to="/"
          className="text-supporting text-muted-foreground hover:text-foreground"
        >
          ← 戻る
        </Link>
        <h1 className="text-screen-title">ナンプレ</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {nanpureDifficulties.map((difficulty) => (
          <NanpureDifficultyOption
            key={difficulty.id}
            difficulty={difficulty.id}
            label={difficulty.label}
          />
        ))}
      </div>
    </section>
  );
}
