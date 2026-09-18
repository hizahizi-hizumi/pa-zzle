import { GameSelectionGallery } from "@/components/GameSelectionGallery";
import nanpurePictogramSvg from "@/games/nanpure/assets/pictogram.svg?raw";
import waterSortPictogramSvg from "@/games/water-sort/assets/pictogram.svg?raw";

const games = [
  {
    name: "ウォーターソート",
    pictogramSvg: waterSortPictogramSvg,
    to: "/games/water-sort",
  },
  {
    name: "ナンプレ",
    pictogramSvg: nanpurePictogramSvg,
    to: "/games/nanpure",
  },
] as const;

export default function HomePage() {
  return <GameSelectionGallery games={games} />;
}
