import { useSyncExternalStore } from "react";

import { AppTitleScreen } from "@/components/AppTitleScreen";
import { GameSelectionGallery } from "@/components/GameSelectionGallery";
import { gameCatalog } from "@/game-catalog/game-catalog";
import {
  enterApp,
  getAppLaunchTitle,
  subscribeAppLaunchTitle,
} from "@/lib/app-launch";

const games = gameCatalog.map(({ name, pictogramSvg, homePath }) => ({
  name,
  pictogramSvg,
  to: homePath,
}));

export function PuzzleSelectionView() {
  const title = useSyncExternalStore(
    subscribeAppLaunchTitle,
    getAppLaunchTitle,
  );

  return (
    <>
      <GameSelectionGallery games={games} recordsTo="/records" />
      <AppTitleScreen title={title} games={games} onEnter={enterApp} />
    </>
  );
}
