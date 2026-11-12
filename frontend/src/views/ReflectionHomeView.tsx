import { useGameHome } from "@/game-catalog/game-home";
import { reflectionCatalogEntry } from "@/game-catalog/reflection/reflection-catalog-entry";
import { ReflectionGround } from "@/games/reflection/ui/ReflectionGround";
import { ReflectionHowToPlayDialog } from "@/games/reflection/ui/ReflectionHowToPlayDialog";
import { ReflectionTutorial } from "@/games/reflection/ui/ReflectionTutorial";
import { GameHomeScreen } from "@/zukan/ui/GameHomeScreen";

export function ReflectionHomeView() {
  const { screenProps } = useGameHome(reflectionCatalogEntry);

  return (
    <GameHomeScreen
      {...screenProps}
      ground={<ReflectionGround />}
      renderHowToPlayDialog={({ open, onClose }) => (
        <ReflectionHowToPlayDialog open={open} onClose={onClose} />
      )}
      renderTutorial={({ open, onClose, playStart }) => (
        <ReflectionTutorial
          open={open}
          playStart={playStart}
          onClose={onClose}
        />
      )}
    />
  );
}
