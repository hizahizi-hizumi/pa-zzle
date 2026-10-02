import { HomeBackLink } from "@/components/HomeBackLink";
import { slidePuzzleDifficulties } from "@/games/slide-puzzle/difficulty";
import { SlidePuzzleDifficultyOption } from "@/views/SlidePuzzleDifficultyView/SlidePuzzleDifficultyOption";

export function SlidePuzzleDifficultyView() {
  return (
    <section className="space-y-6 sm:space-y-8">
      <div className="space-y-2">
        <HomeBackLink />
        <h1 className="text-screen-title">スライドパズル</h1>
      </div>

      <div className="grid gap-2 sm:gap-4 lg:grid-cols-5">
        {slidePuzzleDifficulties.map((difficulty) => (
          <SlidePuzzleDifficultyOption
            key={difficulty.id}
            difficulty={difficulty.id}
            label={difficulty.label}
          />
        ))}
      </div>
    </section>
  );
}
