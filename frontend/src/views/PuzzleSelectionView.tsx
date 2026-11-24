import { useMemo, useState, useSyncExternalStore } from "react";
import { gameCatalog } from "@/app/game-integration/game-catalog";
import type { GameCatalogEntry } from "@/app/game-integration/game-catalog-entry";
import { readHomeOriginGameId } from "@/app/navigation/home-origin";
import { gameSelectionOrderSetting } from "@/features/settings/game-selection-order-setting";
import {
  enterApp,
  getAppLaunchTitle,
  subscribeAppLaunchTitle,
} from "@/lib/app-launch";
import { AppTitleScreen } from "@/views/PuzzleSelectionView/AppTitleScreen";
import { useAppHome } from "@/views/PuzzleSelectionView/app-home";
import { GameSelectionGallery } from "@/views/PuzzleSelectionView/GameSelectionGallery";
import { useGameSheetPreviews } from "@/views/PuzzleSelectionView/game-sheet-previews";

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
  const [originGameId] = useState(readHomeOriginGameId);
  const preferredOrder = useSyncExternalStore(
    gameSelectionOrderSetting.subscribe,
    gameSelectionOrderSetting.getSnapshot,
    gameSelectionOrderSetting.getSnapshot,
  );
  const hiddenIds = useSyncExternalStore(
    gameSelectionOrderSetting.subscribe,
    gameSelectionOrderSetting.getHiddenSnapshot,
    gameSelectionOrderSetting.getHiddenSnapshot,
  );
  const visibleIds = useMemo(() => {
    const orderedIds = gameSelectionOrderSetting.sortGameIds(
      gameCatalog.map(({ id }) => id),
      preferredOrder,
    );
    return gameSelectionOrderSetting.visibleGameIds(orderedIds, hiddenIds);
  }, [preferredOrder, hiddenIds]);
  const visibleCatalog = useMemo(
    () => gameCatalog.filter(({ id }) => visibleIds.includes(id)),
    [visibleIds],
  );
  const {
    selectedGameIndex,
    selectedGameContinuation,
    selectGame,
    records,
    attempts,
  } = useAppHome(visibleCatalog, {
    opensCovered: isCovered,
    originGameId,
    fallbackGameId: visibleIds[0],
  });
  const selectedId = visibleCatalog[selectedGameIndex]?.id;
  // 並び順が同じなら、同じ並びを渡して台紙を求め直させない。
  const orderedCatalog = useMemo(
    () =>
      visibleIds.flatMap((id) => {
        const game = gameCatalog.find((entry) => entry.id === id);
        return game ? [game] : [];
      }),
    [visibleIds],
  );
  const sheetPreviews = useGameSheetPreviews(
    orderedCatalog,
    selectedId,
    records,
    attempts,
  );
  const orderedGames = visibleIds.flatMap((id) => {
    const game = games.find((item) => item.id === id);
    return game ? [{ ...game, sheetPreview: sheetPreviews.get(id) }] : [];
  });
  const orderedSelectedIndex = orderedGames.findIndex(
    ({ id }) => id === selectedId,
  );

  function selectOrderedGame(index: number) {
    const id = orderedGames[index]?.id;
    const catalogIndex = visibleCatalog.findIndex((game) => game.id === id);
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
      <AppTitleScreen title={title} games={orderedGames} onEnter={enterApp} />
    </>
  );
}
