import { CircleHelp } from "lucide-react";
import { useState } from "react";

import { HomeBackLink } from "@/components/HomeBackLink";
import { Button } from "@/components/ui/button";
import { parkingJamDifficulties } from "@/games/parking-jam/difficulty";
import { ParkingJamHowToPlayDialog } from "@/games/parking-jam/ui/ParkingJamHowToPlayDialog";
import { ParkingJamDifficultyOption } from "@/views/ParkingJamDifficultyView/ParkingJamDifficultyOption";

export function ParkingJamDifficultyView() {
  const [howToPlayOpen, setHowToPlayOpen] = useState(false);

  return (
    <section className="space-y-6 sm:space-y-8">
      <div className="space-y-2">
        <HomeBackLink />
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-screen-title">パーキングジャム</h1>
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
        {parkingJamDifficulties.map((difficulty) => (
          <ParkingJamDifficultyOption
            key={difficulty.id}
            difficulty={difficulty.id}
            label={difficulty.label}
          />
        ))}
      </div>

      <ParkingJamHowToPlayDialog
        open={howToPlayOpen}
        onClose={() => setHowToPlayOpen(false)}
      />
    </section>
  );
}
