import { DifficultyOption } from "@/components/DifficultyOption";
import { DifficultySelectionHeading } from "@/components/DifficultySelectionHeading";
import { HomeBackLink } from "@/components/HomeBackLink";
import { minesweeperCatalogEntry } from "@/game-catalog/minesweeper/minesweeper-catalog-entry";
import { difficultyLevels } from "@/games/difficulty";
import { MINESWEEPER_DISPLAY_NAME } from "@/games/minesweeper/display-name";
import { MinesweeperDifficultyPreview } from "@/games/minesweeper/ui/MinesweeperDifficultyPreview";
import { MinesweeperHowToPlayDialog } from "@/games/minesweeper/ui/MinesweeperHowToPlayDialog";

export function MinesweeperDifficultyView() {
  return (
    <section className="space-y-6 sm:space-y-8">
      <div className="space-y-2">
        <HomeBackLink />
        <DifficultySelectionHeading
          title={MINESWEEPER_DISPLAY_NAME}
          renderHowToPlayDialog={({ open, onClose }) => (
            <MinesweeperHowToPlayDialog open={open} onClose={onClose} />
          )}
        />
      </div>

      <div className="grid gap-2 sm:gap-4 lg:grid-cols-5">
        {difficultyLevels.map((difficulty) => (
          <DifficultyOption
            key={difficulty.id}
            playPath={minesweeperCatalogEntry.playPath}
            difficulty={difficulty.id}
            label={difficulty.label}
          >
            <MinesweeperDifficultyPreview difficulty={difficulty.id} />
          </DifficultyOption>
        ))}
      </div>
    </section>
  );
}
