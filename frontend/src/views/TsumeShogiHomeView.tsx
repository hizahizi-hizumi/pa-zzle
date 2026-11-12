import { useGameHome } from "@/game-catalog/game-home";
import { tsumeShogiCatalogEntry } from "@/game-catalog/tsume-shogi/tsume-shogi-catalog-entry";
import { usePreloadTsumeShogiProblemPool } from "@/games/tsume-shogi/play/use-tsume-shogi-problem-pool";
import { TsumeShogiGround } from "@/games/tsume-shogi/ui/TsumeShogiGround";
import { TsumeShogiHowToPlayDialog } from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog";
import { TsumeShogiTutorial } from "@/games/tsume-shogi/ui/TsumeShogiTutorial";
import { GameHomeScreen } from "@/zukan/ui/GameHomeScreen";

export function TsumeShogiHomeView() {
  const { screenProps } = useGameHome(tsumeShogiCatalogEntry);
  // レベルを選んでからプレイ画面が問題集を待つ時間を縮める。
  usePreloadTsumeShogiProblemPool();

  return (
    <GameHomeScreen
      {...screenProps}
      ground={<TsumeShogiGround />}
      renderHowToPlayDialog={({ open, onClose }) => (
        <TsumeShogiHowToPlayDialog open={open} onClose={onClose} />
      )}
      renderTutorial={({ open, onClose, playStart }) => (
        <TsumeShogiTutorial
          open={open}
          playStart={playStart}
          onClose={onClose}
        />
      )}
    />
  );
}
