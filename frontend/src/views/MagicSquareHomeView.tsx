import { GameHomeScreen } from "@/app/game-home/GameHomeScreen";
import { useGameHome } from "@/app/game-home/game-home";
import { magicSquareCatalogEntry } from "@/app/game-integration/magic-square/magic-square-catalog-entry";
import { MagicSquareGround } from "@/games/magic-square/ui/MagicSquareGround";
import { MagicSquareHowToPlayDialog } from "@/games/magic-square/ui/MagicSquareHowToPlayDialog";
import { MagicSquareTutorial } from "@/games/magic-square/ui/MagicSquareTutorial";

export function MagicSquareHomeView() {
  const { screenProps } = useGameHome(magicSquareCatalogEntry);

  return (
    <GameHomeScreen
      {...screenProps}
      ground={<MagicSquareGround />}
      renderHowToPlayDialog={({ open, onClose, onOpenTutorial }) => (
        <MagicSquareHowToPlayDialog
          open={open}
          onClose={onClose}
          onOpenTutorial={onOpenTutorial}
        />
      )}
      renderTutorial={({ open, onClose, playStart }) => (
        <MagicSquareTutorial
          open={open}
          playStart={playStart}
          onClose={onClose}
        />
      )}
    />
  );
}
