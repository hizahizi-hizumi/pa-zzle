import { GameHomeScreen } from "@/app/game-home/GameHomeScreen";
import { useGameHome } from "@/app/game-home/game-home";
import { bridgesCatalogEntry } from "@/app/game-integration/bridges/bridges-catalog-entry";
import { BridgesGround } from "@/games/bridges/ui/BridgesGround";
import { BridgesHowToPlayDialog } from "@/games/bridges/ui/BridgesHowToPlayDialog";
import { BridgesTutorial } from "@/games/bridges/ui/BridgesTutorial";

export function BridgesHomeView() {
  const { screenProps } = useGameHome(bridgesCatalogEntry);

  return (
    <GameHomeScreen
      {...screenProps}
      ground={<BridgesGround />}
      renderHowToPlayDialog={({ open, onClose }) => (
        <BridgesHowToPlayDialog open={open} onClose={onClose} />
      )}
      renderTutorial={({ open, onClose, playStart }) => (
        <BridgesTutorial open={open} playStart={playStart} onClose={onClose} />
      )}
    />
  );
}
