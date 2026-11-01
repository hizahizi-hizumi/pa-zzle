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

const games = gameCatalog.map(
  ({
    name,
    pictogramSvg,
    pictogramShowcaseSvg,
    homePath,
  }: GameCatalogEntry) => ({
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
  const { selectedGameIndex, selectedGameContinuation, selectGame } =
    useAppHome(gameCatalog, { isCovered: title.status !== "hidden" });

  return (
    <>
      <GameSelectionGallery
        games={games}
        recordsTo="/records"
        selectedIndex={selectedGameIndex}
        continuation={selectedGameContinuation}
        onSelect={selectGame}
      />
      <AppTitleScreen title={title} games={games} onEnter={enterApp} />
    </>
  );
}
