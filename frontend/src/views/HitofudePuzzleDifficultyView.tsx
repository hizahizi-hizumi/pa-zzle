import { DifficultyOption } from "@/components/DifficultyOption";
import { DifficultySelectionHeading } from "@/components/DifficultySelectionHeading";
import { HomeBackLink } from "@/components/HomeBackLink";
import { hitofudePuzzleCatalogEntry } from "@/game-catalog/hitofude-puzzle/hitofude-puzzle-catalog-entry";
import { difficultyLevels } from "@/games/difficulty";
import { HITOFUDE_PUZZLE_DISPLAY_NAME } from "@/games/hitofude-puzzle/display-name";
import { HitofudePuzzleDifficultyPreview } from "@/games/hitofude-puzzle/ui/HitofudePuzzleDifficultyPreview";
import { HitofudePuzzleHowToPlayDialog } from "@/games/hitofude-puzzle/ui/HitofudePuzzleHowToPlayDialog";

export function HitofudePuzzleDifficultyView() {
  return (
    <section className="space-y-6 sm:space-y-8">
      <div className="space-y-2">
        <HomeBackLink />
        <DifficultySelectionHeading
          title={HITOFUDE_PUZZLE_DISPLAY_NAME}
          gameId={hitofudePuzzleCatalogEntry.id}
          renderHowToPlayDialog={({ open, onClose }) => (
            <HitofudePuzzleHowToPlayDialog open={open} onClose={onClose} />
          )}
        />
      </div>

      <div className="grid gap-2 sm:gap-4 lg:grid-cols-5">
        {difficultyLevels.map((difficulty) => (
          <DifficultyOption
            key={difficulty.id}
            playPath={hitofudePuzzleCatalogEntry.playPath}
            difficulty={difficulty.id}
            label={difficulty.label}
          >
            <HitofudePuzzleDifficultyPreview difficulty={difficulty.id} />
          </DifficultyOption>
        ))}
      </div>
    </section>
  );
}
