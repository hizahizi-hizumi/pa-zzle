import { useGameHome } from "@/game-catalog/game-home";
import { hitofudePuzzleCatalogEntry } from "@/game-catalog/hitofude-puzzle/hitofude-puzzle-catalog-entry";
import { HitofudePuzzleHowToPlayDialog } from "@/games/hitofude-puzzle/ui/HitofudePuzzleHowToPlayDialog";
import { HitofudePuzzleTutorial } from "@/games/hitofude-puzzle/ui/HitofudePuzzleTutorial";
import { GameHomeScreen } from "@/zukan/ui/GameHomeScreen";

export function HitofudePuzzleHomeView() {
  const { screenProps } = useGameHome(hitofudePuzzleCatalogEntry);

  return (
    <GameHomeScreen
      {...screenProps}
      renderHowToPlayDialog={({ open, onClose }) => (
        <HitofudePuzzleHowToPlayDialog open={open} onClose={onClose} />
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
