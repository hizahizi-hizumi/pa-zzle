import { GameHomeScreen } from "@/app/game-home/GameHomeScreen";
import { useGameHome } from "@/app/game-home/game-home";
import { hitofudePuzzleCatalogEntry } from "@/app/game-integration/hitofude-puzzle/hitofude-puzzle-catalog-entry";
import { HitofudePuzzleHowToPlayDialog } from "@/games/hitofude-puzzle/ui/HitofudePuzzleHowToPlayDialog";
import { HitofudePuzzleTutorial } from "@/games/hitofude-puzzle/ui/HitofudePuzzleTutorial";

export function HitofudePuzzleHomeView() {
  const { screenProps } = useGameHome(hitofudePuzzleCatalogEntry);

  return (
    <GameHomeScreen
      {...screenProps}
      renderHowToPlayDialog={({ open, onClose, onOpenTutorial }) => (
        <HitofudePuzzleHowToPlayDialog
          open={open}
          onClose={onClose}
          onOpenTutorial={onOpenTutorial}
        />
      )}
      renderTutorial={({ open, onClose, playStart }) => (
        <HitofudePuzzleTutorial
          open={open}
          playStart={playStart}
          onClose={onClose}
        />
      )}
    />
  );
}
