import { useGameHome } from "@/game-catalog/game-home";
import { parkingJamCatalogEntry } from "@/game-catalog/parking-jam/parking-jam-catalog-entry";
import { ParkingJamHowToPlayDialog } from "@/games/parking-jam/ui/ParkingJamHowToPlayDialog";
import { GameHomeScreen } from "@/zukan/ui/GameHomeScreen";

export function ParkingJamHomeView() {
  const { screenProps } = useGameHome(parkingJamCatalogEntry);

  return (
    <GameHomeScreen
      {...screenProps}
      renderHowToPlayDialog={({ open, onClose }) => (
        <ParkingJamHowToPlayDialog open={open} onClose={onClose} />
      )}
    />
  );
}
