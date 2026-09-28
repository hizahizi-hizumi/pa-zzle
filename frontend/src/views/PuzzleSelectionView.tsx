import { GameSelectionGallery } from "@/components/GameSelectionGallery";
import { gameCatalog } from "@/game-catalog/game-catalog";
import reflectionPictogramSvg from "@/games/reflection/assets/pictogram.svg?raw";
import { REFLECTION_DISPLAY_NAME } from "@/games/reflection/display-name";

// リフレクションは記録の定義と結果画面をつないだ段でゲームカタログへ載せる。それまではここで末尾に足す。
const games = [
  ...gameCatalog.map(({ name, pictogramSvg, entryPath }) => ({
    name,
    pictogramSvg,
    to: entryPath,
  })),
  {
    name: REFLECTION_DISPLAY_NAME,
    pictogramSvg: reflectionPictogramSvg,
    to: "/puzzles/reflection" as const,
  },
];

export function PuzzleSelectionView() {
  return <GameSelectionGallery games={games} recordsTo="/records" />;
}
