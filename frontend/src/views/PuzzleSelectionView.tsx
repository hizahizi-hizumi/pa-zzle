import { useSyncExternalStore } from "react";
import { gameCatalog } from "@/app/game-integration/game-catalog";
import type { GameCatalogEntry } from "@/app/game-integration/game-catalog-entry";
import { gameSelectionOrderSetting } from "@/features/settings/game-selection-order-setting";
import {
  enterApp,
  getAppLaunchTitle,
  subscribeAppLaunchTitle,
} from "@/lib/app-launch";
import { AppTitleScreen } from "@/views/PuzzleSelectionView/AppTitleScreen";
import { useAppHome } from "@/views/PuzzleSelectionView/app-home";
import { GameSelectionGallery } from "@/views/PuzzleSelectionView/GameSelectionGallery";

const games = gameCatalog.map(
  ({
    id,
    name,
    pictogramSvg,
    pictogramShowcaseSvg,
    homePath,
  }: GameCatalogEntry) => ({
    id,
    name,
    pictogramSvg,
    pictogramShowcaseSvg,
    to: homePath,
  }),
);

export function PuzzleSelectionView() {
  const title = useSyncExternalStore(
    subscribeAppLaunchTitle,
    getAppLaunchTitle,
  );
  const isCovered = title.status !== "hidden";
  const preferredOrder = useSyncExternalStore(
    gameSelectionOrderSetting.subscribe,
    gameSelectionOrderSetting.getSnapshot,
    gameSelectionOrderSetting.getSnapshot,
  );
  const orderedIds = gameSelectionOrderSetting.sortGameIds(
    gameCatalog.map(({ id }) => id),
    preferredOrder,
  );
  const { selectedGameIndex, selectedGameContinuation, selectGame } =
    useAppHome(gameCatalog, {
      opensCovered: isCovered,
      fallbackGameId: orderedIds[0],
    });
  const orderedGames = orderedIds.flatMap((id) => {
    const game = games.find((item) => item.id === id);
    return game ? [game] : [];
  });
  const selectedId = gameCatalog[selectedGameIndex]?.id;
  const orderedSelectedIndex = orderedGames.findIndex(
    ({ id }) => id === selectedId,
  );

  function selectOrderedGame(index: number) {
    const id = orderedGames[index]?.id;
    const catalogIndex = gameCatalog.findIndex((game) => game.id === id);
    if (catalogIndex !== -1) selectGame(catalogIndex);
  }

  return (
    <>
      <GameSelectionGallery
        games={orderedGames}
        recordsTo="/records"
        selectedIndex={orderedSelectedIndex}
        continuation={selectedGameContinuation}
        onSelect={selectOrderedGame}
        isCovered={isCovered}
      />
      <AppTitleScreen title={title} games={games} onEnter={enterApp} />
    </>
  );
}
