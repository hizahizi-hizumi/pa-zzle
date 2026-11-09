import { bridgesCatalogEntry } from "@/game-catalog/bridges/bridges-catalog-entry";
import { useGameHome } from "@/game-catalog/game-home";
import { BridgesHowToPlayDialog } from "@/games/bridges/ui/BridgesHowToPlayDialog";
import { BridgesTutorial } from "@/games/bridges/ui/BridgesTutorial";
import { GameHomeScreen } from "@/zukan/ui/GameHomeScreen";

export function BridgesHomeView() {
  const { screenProps } = useGameHome(bridgesCatalogEntry);

  return (
    <GameHomeScreen
      {...screenProps}
      renderHowToPlayDialog={({ open, onClose }) => (
        <BridgesHowToPlayDialog open={open} onClose={onClose} />
      )}
      renderTutorial={({ open, onClose, playStart }) => (
        <BridgesTutorial open={open} playStart={playStart} onClose={onClose} />
      )}
    />
  );
}
