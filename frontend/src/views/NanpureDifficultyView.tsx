import { HomeBackLink } from "@/components/HomeBackLink";
import { nanpureDifficulties } from "@/games/nanpure/difficulty";
import { NanpureDifficultyOption } from "@/views/NanpureDifficultyView/NanpureDifficultyOption";

export function NanpureDifficultyView() {
  return (
    <section className="space-y-6 sm:space-y-8">
      <div className="space-y-2">
        <HomeBackLink />
        <h1 className="text-screen-title">ナンプレ</h1>
      </div>

      <div className="grid gap-2 sm:gap-4 lg:grid-cols-5">
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
