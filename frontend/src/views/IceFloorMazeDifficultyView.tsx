import { DifficultyOption } from "@/components/DifficultyOption";
import { DifficultySelectionHeading } from "@/components/DifficultySelectionHeading";
import { HomeBackLink } from "@/components/HomeBackLink";
import { iceFloorMazeCatalogEntry } from "@/game-catalog/ice-floor-maze/ice-floor-maze-catalog-entry";
import { difficultyLevels } from "@/games/difficulty";
import { ICE_FLOOR_MAZE_DISPLAY_NAME } from "@/games/ice-floor-maze/display-name";
import { IceFloorMazeDifficultyPreview } from "@/games/ice-floor-maze/ui/IceFloorMazeDifficultyPreview";
import { IceFloorMazeHowToPlayDialog } from "@/games/ice-floor-maze/ui/IceFloorMazeHowToPlayDialog";

export function IceFloorMazeDifficultyView() {
  return (
    <section className="space-y-6 sm:space-y-8">
      <div className="space-y-2">
        <HomeBackLink />
        <DifficultySelectionHeading
          title={ICE_FLOOR_MAZE_DISPLAY_NAME}
          gameId={iceFloorMazeCatalogEntry.id}
          renderHowToPlayDialog={({ open, onClose }) => (
            <IceFloorMazeHowToPlayDialog open={open} onClose={onClose} />
          )}
        />
      </div>

      <div className="grid gap-2 sm:gap-4 lg:grid-cols-5">
        {difficultyLevels.map((difficulty) => (
          <DifficultyOption
            key={difficulty.id}
            playPath={iceFloorMazeCatalogEntry.playPath}
            difficulty={difficulty.id}
            label={difficulty.label}
          >
            <IceFloorMazeDifficultyPreview difficulty={difficulty.id} />
          </DifficultyOption>
        ))}
      </div>
    </section>
  );
}
