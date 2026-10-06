import { DifficultyOption } from "@/components/DifficultyOption";
import { DifficultySelectionHeading } from "@/components/DifficultySelectionHeading";
import { HomeBackLink } from "@/components/HomeBackLink";
import { parkingJamCatalogEntry } from "@/game-catalog/parking-jam/parking-jam-catalog-entry";
import { difficultyLevels } from "@/games/difficulty";
import { PARKING_JAM_DISPLAY_NAME } from "@/games/parking-jam/display-name";
import { ParkingJamDifficultyPreview } from "@/games/parking-jam/ui/ParkingJamDifficultyPreview";
import { ParkingJamHowToPlayDialog } from "@/games/parking-jam/ui/ParkingJamHowToPlayDialog";

export function ParkingJamDifficultyView() {
  return (
    <section className="space-y-6 sm:space-y-8">
      <div className="space-y-2">
        <HomeBackLink />
        <DifficultySelectionHeading
          title={PARKING_JAM_DISPLAY_NAME}
          renderHowToPlayDialog={({ open, onClose }) => (
            <ParkingJamHowToPlayDialog open={open} onClose={onClose} />
          )}
        />
      </div>

      <div className="grid gap-2 sm:gap-4 lg:grid-cols-5">
        {difficultyLevels.map((difficulty) => (
          <DifficultyOption
            key={difficulty.id}
            playPath={parkingJamCatalogEntry.playPath}
            difficulty={difficulty.id}
            label={difficulty.label}
          >
            <ParkingJamDifficultyPreview difficulty={difficulty.id} />
          </DifficultyOption>
        ))}
      </div>
    </section>
  );
}
