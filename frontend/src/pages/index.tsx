import { GameSelectionGallery } from "@/components/GameSelectionGallery";
import sudokuPictogramSvg from "@/games/sudoku/assets/pictogram.svg?raw";
import waterSortPictogramSvg from "@/games/water-sort/assets/pictogram.svg?raw";

const games = [
  {
    name: "ウォーターソート",
    pictogramSvg: waterSortPictogramSvg,
    to: "/games/water-sort",
  },
  {
    name: "ナンプレ",
    pictogramSvg: sudokuPictogramSvg,
    to: "/games/sudoku",
  },
] as const;

export default function HomePage() {
  return <GameSelectionGallery games={games} />;
}
