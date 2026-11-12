import { useGameHome } from "@/game-catalog/game-home";
import { takuzuCatalogEntry } from "@/game-catalog/takuzu/takuzu-catalog-entry";
import { TakuzuGround } from "@/games/takuzu/ui/TakuzuGround";
import { TakuzuHowToPlayDialog } from "@/games/takuzu/ui/TakuzuHowToPlayDialog";
import { TakuzuTutorial } from "@/games/takuzu/ui/TakuzuTutorial";
import { GameHomeScreen } from "@/zukan/ui/GameHomeScreen";

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
