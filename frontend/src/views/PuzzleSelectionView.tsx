import { GameSelectionGallery } from "@/components/GameSelectionGallery";
import { gameCatalog } from "@/game-catalog/game-catalog";
import { iceFloorMazeCatalogEntry } from "@/game-catalog/ice-floor-maze/ice-floor-maze-catalog-entry";

// 氷の床迷路は記録の定義と結果画面をつないだ段でゲームカタログへ載せる。それまではここで末尾に足す。
const games = [...gameCatalog, iceFloorMazeCatalogEntry].map(
  ({ name, pictogramSvg, entryPath }) => ({
    name,
    pictogramSvg,
    to: entryPath,
  }),
);

export function PuzzleSelectionView() {
  return <GameSelectionGallery games={games} recordsTo="/records" />;
}
