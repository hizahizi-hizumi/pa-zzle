import { DifficultyOption } from "@/components/DifficultyOption";
import { DifficultySelectionHeading } from "@/components/DifficultySelectionHeading";
import { HomeBackLink } from "@/components/HomeBackLink";
import { slidePuzzleCatalogEntry } from "@/game-catalog/slide-puzzle/slide-puzzle-catalog-entry";
import { difficultyLevels } from "@/games/difficulty";
import { SLIDE_PUZZLE_DISPLAY_NAME } from "@/games/slide-puzzle/display-name";
import { SlidePuzzleDifficultyPreview } from "@/games/slide-puzzle/ui/SlidePuzzleDifficultyPreview";
import { SlidePuzzleHowToPlayDialog } from "@/games/slide-puzzle/ui/SlidePuzzleHowToPlayDialog";

export function SlidePuzzleDifficultyView() {
  return (
    <section className="space-y-6 sm:space-y-8">
      <div className="space-y-2">
        <HomeBackLink />
        <DifficultySelectionHeading
          title={SLIDE_PUZZLE_DISPLAY_NAME}
          renderHowToPlayDialog={({ open, onClose }) => (
            <SlidePuzzleHowToPlayDialog open={open} onClose={onClose} />
          )}
        />
      </div>

      <div className="grid gap-2 sm:gap-4 lg:grid-cols-5">
        {difficultyLevels.map((difficulty) => (
          <DifficultyOption
            key={difficulty.id}
            playPath={slidePuzzleCatalogEntry.playPath}
            difficulty={difficulty.id}
            label={difficulty.label}
          >
            <SlidePuzzleDifficultyPreview difficulty={difficulty.id} />
          </DifficultyOption>
        ))}
      </div>
    </section>
  );
}
