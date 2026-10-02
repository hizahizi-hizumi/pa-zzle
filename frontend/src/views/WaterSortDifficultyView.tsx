import { CircleHelp } from "lucide-react";
import { useState } from "react";

import { HomeBackLink } from "@/components/HomeBackLink";
import { Button } from "@/components/ui/button";
import { waterSortDifficulties } from "@/games/water-sort/difficulty";
import { WaterSortHowToPlayDialog } from "@/games/water-sort/ui/WaterSortHowToPlayDialog";
import { WaterSortDifficultyOption } from "@/views/WaterSortDifficultyView/WaterSortDifficultyOption";

export function WaterSortDifficultyView() {
  const [howToPlayOpen, setHowToPlayOpen] = useState(false);

  return (
    <section className="space-y-6 sm:space-y-8">
      <div className="space-y-2">
        <HomeBackLink />
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-screen-title">ウォーターソート</h1>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setHowToPlayOpen(true)}
          >
            <CircleHelp />
            遊び方
          </Button>
        </div>
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

      <WaterSortHowToPlayDialog
        open={howToPlayOpen}
        onClose={() => setHowToPlayOpen(false)}
      />
    </section>
  );
}
