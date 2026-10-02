import { CircleHelp } from "lucide-react";
import { useState } from "react";

import { HomeBackLink } from "@/components/HomeBackLink";
import { Button } from "@/components/ui/button";
import { reflectionDifficulties } from "@/games/reflection/difficulty";
import { REFLECTION_DISPLAY_NAME } from "@/games/reflection/display-name";
import { reflectionLaserPathMode } from "@/games/reflection/laser-path-mode";
import { ReflectionHowToPlayDialog } from "@/games/reflection/ui/ReflectionHowToPlayDialog";
import { ReflectionDifficultyOption } from "@/views/ReflectionDifficultyView/ReflectionDifficultyOption";

export function ReflectionDifficultyView() {
  const [howToPlayOpen, setHowToPlayOpen] = useState(false);

  return (
    <section className="space-y-6 sm:space-y-8">
      <div className="space-y-2">
        <HomeBackLink />
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-screen-title">{REFLECTION_DISPLAY_NAME}</h1>
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
        {reflectionDifficulties.map((difficulty) => (
          <ReflectionDifficultyOption
            key={difficulty.id}
            difficulty={difficulty.id}
            label={difficulty.label}
          />
        ))}
      </div>

      <ReflectionHowToPlayDialog
        open={howToPlayOpen}
        laserPathMode={reflectionLaserPathMode}
        onClose={() => setHowToPlayOpen(false)}
      />
    </section>
  );
}
