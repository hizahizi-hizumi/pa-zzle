import { GameSelectionGallery } from "@/components/GameSelectionGallery";
import nanpurePictogramSvg from "@/games/nanpure/assets/pictogram.svg?raw";
import parkingJamPictogramSvg from "@/games/parking-jam/assets/pictogram.svg?raw";
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
    name: "パーキングジャム",
    pictogramSvg: parkingJamPictogramSvg,
    to: "/puzzles/parking-jam",
  },
] as const;

export function PuzzleSelectionView() {
  return <GameSelectionGallery games={games} recordsTo="/records" />;
}
