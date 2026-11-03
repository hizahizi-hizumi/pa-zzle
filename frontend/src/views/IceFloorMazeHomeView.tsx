import { useGameHome } from "@/game-catalog/game-home";
import { iceFloorMazeCatalogEntry } from "@/game-catalog/ice-floor-maze/ice-floor-maze-catalog-entry";
import { IceFloorMazeHowToPlayDialog } from "@/games/ice-floor-maze/ui/IceFloorMazeHowToPlayDialog";
import { GameHomeScreen } from "@/zukan/ui/GameHomeScreen";

export function IceFloorMazeHomeView() {
  const { screenProps } = useGameHome(iceFloorMazeCatalogEntry);

  return (
    <GameHomeScreen
      {...screenProps}
      renderHowToPlayDialog={({ open, onClose }) => (
        <IceFloorMazeHowToPlayDialog open={open} onClose={onClose} />
      )}
    />
  );
}
