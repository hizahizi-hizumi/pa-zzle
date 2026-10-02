import { DifficultySelectionHeading } from "@/components/DifficultySelectionHeading";
import { HomeBackLink } from "@/components/HomeBackLink";
import { waterSortDifficulties } from "@/games/water-sort/difficulty";
import { WaterSortHowToPlayDialog } from "@/games/water-sort/ui/WaterSortHowToPlayDialog";
import { WaterSortDifficultyOption } from "@/views/WaterSortDifficultyView/WaterSortDifficultyOption";

export function WaterSortDifficultyView() {
  return (
    <section className="space-y-6 sm:space-y-8">
      <div className="space-y-2">
        <HomeBackLink />
        <DifficultySelectionHeading
          title="ウォーターソート"
          renderHowToPlayDialog={({ open, onClose }) => (
            <WaterSortHowToPlayDialog open={open} onClose={onClose} />
          )}
        />
      </div>

      <div className="grid gap-2 sm:gap-4 lg:grid-cols-5">
        {waterSortDifficulties.map((difficulty) => (
          <WaterSortDifficultyOption
            key={difficulty.id}
            difficulty={difficulty.id}
            label={difficulty.label}
          />
        ))}
      </div>
    </section>
  );
}
