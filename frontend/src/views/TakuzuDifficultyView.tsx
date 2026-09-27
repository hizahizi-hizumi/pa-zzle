import { CircleHelp } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { takuzuDifficulties } from "@/games/takuzu/difficulty";
import { TakuzuHowToPlayDialog } from "@/games/takuzu/ui/TakuzuHowToPlayDialog";
import { Link } from "@/router";
import { TakuzuDifficultyOption } from "@/views/TakuzuDifficultyView/TakuzuDifficultyOption";

export function TakuzuDifficultyView() {
  const [howToPlayOpen, setHowToPlayOpen] = useState(false);

  return (
    <section className="space-y-6 sm:space-y-8">
      <div className="space-y-2">
        <Link
          to="/"
          className="text-supporting text-muted-foreground hover:text-foreground"
        >
          ← 戻る
        </Link>
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-screen-title">バイナリパズル</h1>
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
        {takuzuDifficulties.map((difficulty) => (
          <TakuzuDifficultyOption
            key={difficulty.id}
            difficulty={difficulty.id}
            label={difficulty.label}
          />
        ))}
      </div>

      <TakuzuHowToPlayDialog
        open={howToPlayOpen}
        onClose={() => setHowToPlayOpen(false)}
      />
    </section>
  );
}
