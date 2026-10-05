import { DifficultySelectionHeading } from "@/components/DifficultySelectionHeading";
import { HomeBackLink } from "@/components/HomeBackLink";
import { difficultyLevels } from "@/games/difficulty";
import { NANPURE_DISPLAY_NAME } from "@/games/nanpure/display-name";
import { NanpureHowToPlayDialog } from "@/games/nanpure/ui/NanpureHowToPlayDialog";
import { NanpureDifficultyOption } from "@/views/NanpureDifficultyView/NanpureDifficultyOption";

export function NanpureDifficultyView() {
  return (
    <section className="space-y-6 sm:space-y-8">
      <div className="space-y-2">
        <HomeBackLink />
        <DifficultySelectionHeading
          title={NANPURE_DISPLAY_NAME}
          renderHowToPlayDialog={({ open, onClose }) => (
            <NanpureHowToPlayDialog open={open} onClose={onClose} />
          )}
        />
      </div>

      <div className="grid gap-2 sm:gap-4 lg:grid-cols-5">
        {difficultyLevels.map((difficulty) => (
          <NanpureDifficultyOption
            key={difficulty.id}
            difficulty={difficulty.id}
            label={difficulty.label}
          />
        ))}
      </div>
    </section>
  );
}
