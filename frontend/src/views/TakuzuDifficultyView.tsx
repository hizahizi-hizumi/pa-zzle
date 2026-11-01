import { DifficultyOption } from "@/components/DifficultyOption";
import { DifficultySelectionHeading } from "@/components/DifficultySelectionHeading";
import { HomeBackLink } from "@/components/HomeBackLink";
import { takuzuCatalogEntry } from "@/game-catalog/takuzu/takuzu-catalog-entry";
import { difficultyLevels } from "@/games/difficulty";
import { TAKUZU_DISPLAY_NAME } from "@/games/takuzu/display-name";
import { TakuzuDifficultyPreview } from "@/games/takuzu/ui/TakuzuDifficultyPreview";
import { TakuzuHowToPlayDialog } from "@/games/takuzu/ui/TakuzuHowToPlayDialog";
import { TakuzuTutorial } from "@/games/takuzu/ui/TakuzuTutorial";
import { useNavigate } from "@/router";

export function TakuzuDifficultyView() {
  const navigate = useNavigate();

  function startLevelOne(): void {
    navigate("/puzzles/takuzu/play/:difficulty", {
      params: { difficulty: "1" },
    });
  }

  return (
    <section className="space-y-6 sm:space-y-8">
      <div className="space-y-2">
        <HomeBackLink />
        <DifficultySelectionHeading
          title={TAKUZU_DISPLAY_NAME}
          renderHowToPlayDialog={({ open, onClose }) => (
            <TakuzuHowToPlayDialog open={open} onClose={onClose} />
          )}
          renderTutorial={({ open, onClose }) => (
            <TakuzuTutorial
              open={open}
              onStartPlay={startLevelOne}
              onClose={onClose}
            />
          )}
        />
      </div>

      <div className="grid gap-2 sm:gap-4 lg:grid-cols-5">
        {difficultyLevels.map((difficulty) => (
          <DifficultyOption
            key={difficulty.id}
            playPath={takuzuCatalogEntry.playPath}
            difficulty={difficulty.id}
            label={difficulty.label}
          >
            <TakuzuDifficultyPreview difficulty={difficulty.id} />
          </DifficultyOption>
        ))}
      </div>
    </section>
  );
}
