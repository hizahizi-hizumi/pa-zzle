import { bridgesCatalogEntry } from "@/game-catalog/bridges/bridges-catalog-entry";
import { useGameHome } from "@/game-catalog/game-home";
import { BridgesHowToPlayDialog } from "@/games/bridges/ui/BridgesHowToPlayDialog";
import { GameHomeScreen } from "@/zukan/ui/GameHomeScreen";

export function BridgesHomeView() {
  const { screenProps } = useGameHome(bridgesCatalogEntry);

  return (
    <GameHomeScreen
      {...screenProps}
      renderHowToPlayDialog={({ open, onClose }) => (
        <BridgesHowToPlayDialog open={open} onClose={onClose} />
      )}
    />
  );
}
