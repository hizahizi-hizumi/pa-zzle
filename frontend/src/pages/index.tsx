import { GameSelectionGallery } from "@/components/GameSelectionGallery";
import waterSortPictogram from "@/games/water-sort/assets/pictogram.svg";
import sudokuPictogram from "../../../.claude/skills/design-game-pictogram/examples/sudoku.svg";

const games = [
  {
    name: "ウォーターソート",
    pictogramSrc: waterSortPictogram,
    to: "/games/water-sort",
  },
  {
    name: "ナンプレ",
    pictogramSrc: sudokuPictogram,
    to: "/games/sudoku",
  },
] as const;

export default function HomePage() {
  return <GameSelectionGallery games={games} />;
}
