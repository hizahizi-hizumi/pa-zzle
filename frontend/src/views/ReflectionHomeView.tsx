import { useGameHome } from "@/game-catalog/game-home";
import { reflectionCatalogEntry } from "@/game-catalog/reflection/reflection-catalog-entry";
import { ReflectionHowToPlayDialog } from "@/games/reflection/ui/ReflectionHowToPlayDialog";
import { GameHomeScreen } from "@/zukan/ui/GameHomeScreen";

export function ReflectionHomeView() {
  const { screenProps } = useGameHome(reflectionCatalogEntry);

  return (
    <GameHomeScreen
      {...screenProps}
      renderHowToPlayDialog={({ open, onClose }) => (
        <ReflectionHowToPlayDialog open={open} onClose={onClose} />
      )}
    />
  );
}
