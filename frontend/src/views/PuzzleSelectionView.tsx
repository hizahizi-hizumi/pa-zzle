import { useSyncExternalStore } from "react";

import { AppTitleScreen } from "@/components/AppTitleScreen";
import { GameSelectionGallery } from "@/components/GameSelectionGallery";
import { useAppHome } from "@/game-catalog/app-home";
import { gameCatalog } from "@/game-catalog/game-catalog";
import type { GameCatalogEntry } from "@/game-catalog/game-catalog-entry";
import { useGameSheetPreviews } from "@/game-catalog/game-sheet-previews";
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
  const {
    selectedGameIndex,
    selectedGameContinuation,
    selectGame,
    records,
    attempts,
  } = useAppHome(gameCatalog, { isCovered, firstGameId: orderedIds[0] });
  const selectedId = gameCatalog[selectedGameIndex]?.id;
  const sheetPreviews = useGameSheetPreviews(
    gameCatalog,
    selectedId,
    records,
    attempts,
  );
  const orderedGames = orderedIds.flatMap((id) => {
    const game = games.find((item) => item.id === id);
    return game ? [{ ...game, sheetPreview: sheetPreviews.get(id) }] : [];
  });
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
