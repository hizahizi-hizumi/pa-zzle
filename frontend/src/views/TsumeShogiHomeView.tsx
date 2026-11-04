import { useGameHome } from "@/game-catalog/game-home";
import { tsumeShogiCatalogEntry } from "@/game-catalog/tsume-shogi/tsume-shogi-catalog-entry";
import { usePreloadTsumeShogiProblemPool } from "@/games/tsume-shogi/play/use-tsume-shogi-problem-pool";
import { TsumeShogiHowToPlayDialog } from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog";
import { GameHomeScreen } from "@/zukan/ui/GameHomeScreen";

export function TsumeShogiHomeView() {
  const { screenProps } = useGameHome(tsumeShogiCatalogEntry);
  // レベルを選んでからプレイ画面が問題集を待つ時間を縮める。
  usePreloadTsumeShogiProblemPool();

  return (
    <GameHomeScreen
      {...screenProps}
      renderHowToPlayDialog={({ open, onClose }) => (
        <TsumeShogiHowToPlayDialog open={open} onClose={onClose} />
      )}
    />
  );
}
