import { CircleHelp } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { tsumeShogiDifficulties } from "@/games/tsume-shogi/difficulty";
import { TSUME_SHOGI_DISPLAY_NAME } from "@/games/tsume-shogi/display-name";
import { TsumeShogiHowToPlayDialog } from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog";
import { Link } from "@/router";
import { TsumeShogiDifficultyOption } from "@/views/TsumeShogiDifficultyView/TsumeShogiDifficultyOption";

export function TsumeShogiDifficultyView() {
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
          <h1 className="text-screen-title">{TSUME_SHOGI_DISPLAY_NAME}</h1>
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
        {tsumeShogiDifficulties.map((difficulty) => (
          <TsumeShogiDifficultyOption
            key={difficulty.id}
            difficulty={difficulty.id}
            label={difficulty.label}
          />
        ))}
      </div>

      <TsumeShogiHowToPlayDialog
        open={howToPlayOpen}
        onClose={() => setHowToPlayOpen(false)}
      />
    </section>
  );
}
