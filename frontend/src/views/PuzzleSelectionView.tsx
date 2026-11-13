import { useSyncExternalStore } from "react";

import { AppTitleScreen } from "@/components/AppTitleScreen";
import { GameSelectionGallery } from "@/components/GameSelectionGallery";
import { useAppHome } from "@/game-catalog/app-home";
import { gameCatalog } from "@/game-catalog/game-catalog";
import type { GameCatalogEntry } from "@/game-catalog/game-catalog-entry";
import {
  enterApp,
  getAppLaunchTitle,
  subscribeAppLaunchTitle,
} from "@/lib/app-launch";
import { gameSelectionOrderSetting } from "@/lib/game-selection-order-setting";

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
