import { useGameHome } from "@/game-catalog/game-home";
import { takuzuCatalogEntry } from "@/game-catalog/takuzu/takuzu-catalog-entry";
import { TakuzuDifficultyPreview } from "@/games/takuzu/ui/TakuzuDifficultyPreview";
import { TakuzuHowToPlayDialog } from "@/games/takuzu/ui/TakuzuHowToPlayDialog";
import { GameHomeScreen } from "@/zukan/ui/GameHomeScreen";

export function TakuzuHomeView() {
  const { screenProps } = useGameHome(takuzuCatalogEntry);

  return (
    <GameHomeScreen
      {...screenProps}
      renderLevelPreview={(difficulty) => (
        <TakuzuDifficultyPreview difficulty={difficulty} />
      )}
      renderHowToPlayDialog={({ open, onClose }) => (
        <TakuzuHowToPlayDialog open={open} onClose={onClose} />
      )}
    />
  );
}
