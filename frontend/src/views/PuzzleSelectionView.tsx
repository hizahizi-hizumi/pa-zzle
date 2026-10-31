import { GameSelectionGallery } from "@/components/GameSelectionGallery";
import { gameCatalog } from "@/game-catalog/game-catalog";

const games = gameCatalog.map(({ name, pictogramSvg, entryPath }) => ({
  name,
  pictogramSvg,
  to: entryPath,
}));

export function PuzzleSelectionView() {
  return <GameSelectionGallery games={games} recordsTo="/records" />;
}
