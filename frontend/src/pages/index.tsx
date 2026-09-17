import { GameSelectionGallery } from "@/components/GameSelectionGallery";
import sudokuPictogram from "../../../.claude/skills/design-game-pictogram/examples/sudoku.svg";
import waterSortPictogram from "../../../.claude/skills/design-game-pictogram/examples/water-sort.svg";

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
