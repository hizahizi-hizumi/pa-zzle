import { GameSelectionGallery } from "@/components/GameSelectionGallery";
import { gameCatalog } from "@/game-catalog/game-catalog";
import type { GameCatalogEntry } from "@/game-catalog/game-catalog-entry";

const games = gameCatalog.map(
  ({
    name,
    pictogramSvg,
    pictogramShowcaseSvg,
    entryPath,
  }: GameCatalogEntry) => ({
    name,
    pictogramSvg,
    pictogramShowcaseSvg,
    to: entryPath,
  }),
);

export function PuzzleSelectionView() {
  return <GameSelectionGallery games={games} recordsTo="/records" />;
}
