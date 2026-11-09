import { useGameHome } from "@/game-catalog/game-home";
import { iceFloorMazeCatalogEntry } from "@/game-catalog/ice-floor-maze/ice-floor-maze-catalog-entry";
import { IceFloorMazeGround } from "@/games/ice-floor-maze/ui/IceFloorMazeGround";
import { IceFloorMazeHowToPlayDialog } from "@/games/ice-floor-maze/ui/IceFloorMazeHowToPlayDialog";
import { IceFloorMazeTutorial } from "@/games/ice-floor-maze/ui/IceFloorMazeTutorial";
import { GameHomeScreen } from "@/zukan/ui/GameHomeScreen";

export function IceFloorMazeHomeView() {
  const { screenProps } = useGameHome(iceFloorMazeCatalogEntry);

  return (
    <GameHomeScreen
      {...screenProps}
      ground={<IceFloorMazeGround />}
      renderHowToPlayDialog={({ open, onClose, onOpenTutorial }) => (
        <IceFloorMazeHowToPlayDialog
          open={open}
          onClose={onClose}
          onOpenTutorial={onOpenTutorial}
        />
      )}
      renderTutorial={({ open, onClose, playStart }) => (
        <IceFloorMazeTutorial
          open={open}
          playStart={playStart}
          onClose={onClose}
        />
      )}
    />
  );
}
