import { DifficultyOption } from "@/components/DifficultyOption";
import { DifficultySelectionHeading } from "@/components/DifficultySelectionHeading";
import { HomeBackLink } from "@/components/HomeBackLink";
import { reflectionCatalogEntry } from "@/game-catalog/reflection/reflection-catalog-entry";
import { difficultyLevels } from "@/games/difficulty";
import { REFLECTION_DISPLAY_NAME } from "@/games/reflection/display-name";
import { reflectionLaserPathMode } from "@/games/reflection/laser-path-mode";
import { ReflectionDifficultyPreview } from "@/games/reflection/ui/ReflectionDifficultyPreview";
import { ReflectionHowToPlayDialog } from "@/games/reflection/ui/ReflectionHowToPlayDialog";

export function ReflectionDifficultyView() {
  return (
    <section className="space-y-6 sm:space-y-8">
      <div className="space-y-2">
        <HomeBackLink />
        <DifficultySelectionHeading
          title={REFLECTION_DISPLAY_NAME}
          renderHowToPlayDialog={({ open, onClose }) => (
            <ReflectionHowToPlayDialog
              open={open}
              laserPathMode={reflectionLaserPathMode}
              onClose={onClose}
            />
          )}
        />
      </div>

      <div className="grid gap-2 sm:gap-4 lg:grid-cols-5">
        {difficultyLevels.map((difficulty) => (
          <DifficultyOption
            key={difficulty.id}
            playPath={reflectionCatalogEntry.playPath}
            difficulty={difficulty.id}
            label={difficulty.label}
          >
            <ReflectionDifficultyPreview difficulty={difficulty.id} />
          </DifficultyOption>
        ))}
      </div>
    </section>
  );
}
