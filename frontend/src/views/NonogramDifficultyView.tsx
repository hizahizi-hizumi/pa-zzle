import { DifficultyOption } from "@/components/DifficultyOption";
import { DifficultySelectionHeading } from "@/components/DifficultySelectionHeading";
import { HomeBackLink } from "@/components/HomeBackLink";
import { nonogramCatalogEntry } from "@/game-catalog/nonogram/nonogram-catalog-entry";
import { difficultyLevels } from "@/games/difficulty";
import { NONOGRAM_DISPLAY_NAME } from "@/games/nonogram/display-name";
import { NonogramDifficultyPreview } from "@/games/nonogram/ui/NonogramDifficultyPreview";
import { NonogramHowToPlayDialog } from "@/games/nonogram/ui/NonogramHowToPlayDialog";

export function NonogramDifficultyView() {
  return (
    <section className="space-y-6 sm:space-y-8">
      <div className="space-y-2">
        <HomeBackLink />
        <DifficultySelectionHeading
          title={NONOGRAM_DISPLAY_NAME}
          renderHowToPlayDialog={({ open, onClose }) => (
            <NonogramHowToPlayDialog open={open} onClose={onClose} />
          )}
        />
      </div>

      <div className="grid gap-2 sm:gap-4 lg:grid-cols-5">
        {difficultyLevels.map((difficulty) => (
          <DifficultyOption
            key={difficulty.id}
            playPath={nonogramCatalogEntry.playPath}
            difficulty={difficulty.id}
            label={difficulty.label}
          >
            <NonogramDifficultyPreview difficulty={difficulty.id} />
          </DifficultyOption>
        ))}
      </div>
    </section>
  );
}
