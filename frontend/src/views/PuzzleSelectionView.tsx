import { GameSelectionGallery } from "@/components/GameSelectionGallery";
import minesweeperPictogramSvg from "@/games/minesweeper/assets/pictogram.svg?raw";
import nanpurePictogramSvg from "@/games/nanpure/assets/pictogram.svg?raw";
import waterSortPictogramSvg from "@/games/water-sort/assets/pictogram.svg?raw";

const games = [
  {
    name: "ウォーターソート",
    pictogramSvg: waterSortPictogramSvg,
    to: "/puzzles/water-sort",
  },
  {
    name: "ナンプレ",
    pictogramSvg: nanpurePictogramSvg,
    to: "/puzzles/nanpure",
  },
  {
    name: "マインスイーパー",
    pictogramSvg: minesweeperPictogramSvg,
    to: "/puzzles/minesweeper",
  },
] as const;

export function PuzzleSelectionView() {
  return <GameSelectionGallery games={games} recordsTo="/records" />;
}
