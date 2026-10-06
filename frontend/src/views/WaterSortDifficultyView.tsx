import { DifficultyOption } from "@/components/DifficultyOption";
import { DifficultySelectionHeading } from "@/components/DifficultySelectionHeading";
import { HomeBackLink } from "@/components/HomeBackLink";
import { waterSortCatalogEntry } from "@/game-catalog/water-sort/water-sort-catalog-entry";
import { difficultyLevels } from "@/games/difficulty";
import { WATER_SORT_DISPLAY_NAME } from "@/games/water-sort/display-name";
import { WaterSortDifficultyPreview } from "@/games/water-sort/ui/WaterSortDifficultyPreview";
import { WaterSortHowToPlayDialog } from "@/games/water-sort/ui/WaterSortHowToPlayDialog";

export function WaterSortDifficultyView() {
  return (
    <section className="space-y-6 sm:space-y-8">
      <div className="space-y-2">
        <HomeBackLink />
        <DifficultySelectionHeading
          title={WATER_SORT_DISPLAY_NAME}
          renderHowToPlayDialog={({ open, onClose }) => (
            <WaterSortHowToPlayDialog open={open} onClose={onClose} />
          )}
        />
      </div>

      <div className="grid gap-2 sm:gap-4 lg:grid-cols-5">
        {difficultyLevels.map((difficulty) => (
          <DifficultyOption
            key={difficulty.id}
            playPath={waterSortCatalogEntry.playPath}
            difficulty={difficulty.id}
            label={difficulty.label}
          >
            <WaterSortDifficultyPreview difficulty={difficulty.id} />
          </DifficultyOption>
        ))}
      </div>
    </section>
  );
}
