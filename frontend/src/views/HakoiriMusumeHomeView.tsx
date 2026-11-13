import { useGameHome } from "@/game-catalog/game-home";
import { hakoiriMusumeCatalogEntry } from "@/game-catalog/hakoiri-musume/hakoiri-musume-catalog-entry";
import { HakoiriMusumeGround } from "@/games/hakoiri-musume/ui/HakoiriMusumeGround";
import { HakoiriMusumeHowToPlayDialog } from "@/games/hakoiri-musume/ui/HakoiriMusumeHowToPlayDialog";
import { HakoiriMusumeTutorial } from "@/games/hakoiri-musume/ui/HakoiriMusumeTutorial";
import { GameHomeScreen } from "@/zukan/ui/GameHomeScreen";

export function HakoiriMusumeHomeView() {
  const { screenProps } = useGameHome(hakoiriMusumeCatalogEntry);

  return (
    <GameHomeScreen
      {...screenProps}
      ground={<HakoiriMusumeGround />}
      renderHowToPlayDialog={({ open, onClose }) => (
        <HakoiriMusumeHowToPlayDialog open={open} onClose={onClose} />
      )}
      renderTutorial={({ open, onClose, playStart }) => (
        <HakoiriMusumeTutorial
          open={open}
          playStart={playStart}
          onClose={onClose}
        />
      )}
    />
  );
}
