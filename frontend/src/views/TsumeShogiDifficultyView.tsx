import { DifficultyOption } from "@/components/DifficultyOption";
import { DifficultySelectionHeading } from "@/components/DifficultySelectionHeading";
import { HomeBackLink } from "@/components/HomeBackLink";
import { difficultyLevels } from "@/games/difficulty";
import { TSUME_SHOGI_DISPLAY_NAME } from "@/games/tsume-shogi/display-name";
import { usePreloadTsumeShogiProblemPool } from "@/games/tsume-shogi/play/use-tsume-shogi-problem-pool";
import { TsumeShogiDifficultyPreview } from "@/games/tsume-shogi/ui/TsumeShogiDifficultyPreview";
import { TsumeShogiHowToPlayDialog } from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog";

export function TsumeShogiDifficultyView() {
  // 難易度を選んでからプレイ画面が問題集を待つ時間を縮める。
  usePreloadTsumeShogiProblemPool();

  return (
    <section className="space-y-6 sm:space-y-8">
      <div className="space-y-2">
        <HomeBackLink />
        <DifficultySelectionHeading
          title={TSUME_SHOGI_DISPLAY_NAME}
          renderHowToPlayDialog={({ open, onClose }) => (
            <TsumeShogiHowToPlayDialog open={open} onClose={onClose} />
          )}
        />
      </div>

      <div className="grid gap-2 sm:gap-4 lg:grid-cols-5">
        {difficultyLevels.map((difficulty) => (
          <DifficultyOption
            key={difficulty.id}
            playPath="/puzzles/tsume-shogi/play/:difficulty"
            difficulty={difficulty.id}
            label={difficulty.label}
          >
            <TsumeShogiDifficultyPreview difficulty={difficulty.id} />
          </DifficultyOption>
        ))}
      </div>
    </section>
  );
}
