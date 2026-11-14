import { GameHomeScreen } from "@/app/game-home/GameHomeScreen";
import { useGameHome } from "@/app/game-home/game-home";
import { takuzuCatalogEntry } from "@/app/game-integration/takuzu/takuzu-catalog-entry";
import { TakuzuGround } from "@/games/takuzu/ui/TakuzuGround";
import { TakuzuHowToPlayDialog } from "@/games/takuzu/ui/TakuzuHowToPlayDialog";
import { TakuzuTutorial } from "@/games/takuzu/ui/TakuzuTutorial";

export function TakuzuHomeView() {
  const { screenProps } = useGameHome(takuzuCatalogEntry);

  return (
    <GameHomeScreen
      {...screenProps}
      ground={<TakuzuGround />}
      renderHowToPlayDialog={({ open, onClose }) => (
        <TakuzuHowToPlayDialog open={open} onClose={onClose} />
      )}
      renderTutorial={({ open, onClose, playStart }) => (
        <TakuzuTutorial open={open} playStart={playStart} onClose={onClose} />
      )}
    />
  );
}
