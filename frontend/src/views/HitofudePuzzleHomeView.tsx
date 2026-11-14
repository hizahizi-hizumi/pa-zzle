import { GameHomeScreen } from "@/app/game-home/GameHomeScreen";
import { useGameHome } from "@/app/game-home/game-home";
import { hitofudePuzzleCatalogEntry } from "@/app/game-integration/hitofude-puzzle/hitofude-puzzle-catalog-entry";
import { HitofudePuzzleGround } from "@/games/hitofude-puzzle/ui/HitofudePuzzleGround";
import { HitofudePuzzleHowToPlayDialog } from "@/games/hitofude-puzzle/ui/HitofudePuzzleHowToPlayDialog";
import { HitofudePuzzleTutorial } from "@/games/hitofude-puzzle/ui/HitofudePuzzleTutorial";

export function HitofudePuzzleHomeView() {
  const { screenProps } = useGameHome(hitofudePuzzleCatalogEntry);

  return (
    <GameHomeScreen
      {...screenProps}
      ground={<HitofudePuzzleGround />}
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
