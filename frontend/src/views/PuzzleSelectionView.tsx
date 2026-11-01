import { GameSelectionGallery } from "@/components/GameSelectionGallery";
import { gameCatalog } from "@/game-catalog/game-catalog";

const games = gameCatalog.map(({ name, pictogramSvg, homePath }) => ({
  name,
  pictogramSvg,
  to: homePath,
}));

export function PuzzleSelectionView() {
  return <GameSelectionGallery games={games} recordsTo="/records" />;
}
