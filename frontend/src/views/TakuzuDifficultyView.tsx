import { DifficultySelectionHeading } from "@/components/DifficultySelectionHeading";
import { HomeBackLink } from "@/components/HomeBackLink";
import { takuzuDifficulties } from "@/games/takuzu/difficulty";
import { TakuzuHowToPlayDialog } from "@/games/takuzu/ui/TakuzuHowToPlayDialog";
import { TakuzuDifficultyOption } from "@/views/TakuzuDifficultyView/TakuzuDifficultyOption";

export function TakuzuDifficultyView() {
  return (
    <section className="space-y-6 sm:space-y-8">
      <div className="space-y-2">
        <HomeBackLink />
        <DifficultySelectionHeading
          title="バイナリパズル"
          renderHowToPlayDialog={({ open, onClose }) => (
            <TakuzuHowToPlayDialog open={open} onClose={onClose} />
          )}
        />
      </div>

      <div className="grid gap-2 sm:gap-4 lg:grid-cols-5">
        {takuzuDifficulties.map((difficulty) => (
          <TakuzuDifficultyOption
            key={difficulty.id}
            difficulty={difficulty.id}
            label={difficulty.label}
          />
        ))}
      </div>
    </section>
  );
}
