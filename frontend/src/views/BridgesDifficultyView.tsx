import { DifficultyOption } from "@/components/DifficultyOption";
import { DifficultySelectionHeading } from "@/components/DifficultySelectionHeading";
import { HomeBackLink } from "@/components/HomeBackLink";
import { bridgesCatalogEntry } from "@/game-catalog/bridges/bridges-catalog-entry";
import { BRIDGES_DISPLAY_NAME } from "@/games/bridges/display-name";
import { BridgesDifficultyPreview } from "@/games/bridges/ui/BridgesDifficultyPreview";
import { BridgesHowToPlayDialog } from "@/games/bridges/ui/BridgesHowToPlayDialog";
import { difficultyLevels } from "@/games/difficulty";

export function BridgesDifficultyView() {
  return (
    <section className="space-y-6 sm:space-y-8">
      <div className="space-y-2">
        <HomeBackLink />
        <DifficultySelectionHeading
          title={BRIDGES_DISPLAY_NAME}
          gameId={bridgesCatalogEntry.id}
          renderHowToPlayDialog={({ open, onClose }) => (
            <BridgesHowToPlayDialog open={open} onClose={onClose} />
          )}
        />
      </div>

      <div className="grid gap-2 sm:gap-4 lg:grid-cols-5">
        {difficultyLevels.map((difficulty) => (
          <DifficultyOption
            key={difficulty.id}
            playPath={bridgesCatalogEntry.playPath}
            difficulty={difficulty.id}
            label={difficulty.label}
          >
            <BridgesDifficultyPreview difficulty={difficulty.id} />
          </DifficultyOption>
        ))}
      </div>
    </section>
  );
}
