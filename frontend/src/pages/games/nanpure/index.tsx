import { StartConditionOption } from "@/components/StartConditionOption";
import {
  type NanpureDifficulty,
  nanpureDifficulties,
} from "@/games/nanpure/difficulty";
import { NanpureDifficultyPreview } from "@/games/nanpure/ui/NanpureDifficultyPreview";
import { Link } from "@/router";

export default function NanpureDifficultyPage() {
  return (
    <section className="space-y-8">
      <div className="space-y-2">
        <Link
          to="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← 戻る
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">ナンプレ</h1>
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

function NanpureDifficultyOption({
  difficulty,
  label,
}: {
  difficulty: NanpureDifficulty;
  label: string;
}) {
  return (
    <Link
      to="/games/nanpure/play/:difficulty"
      params={{ difficulty }}
      className="group block rounded-2xl focus-visible:outline-none"
    >
      <StartConditionOption label={label}>
        <NanpureDifficultyPreview difficulty={difficulty} />
      </StartConditionOption>
    </Link>
  );
}
