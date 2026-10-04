import { GameSelectionGallery } from "@/components/GameSelectionGallery";
import { gameCatalog } from "@/game-catalog/game-catalog";
import tsumeShogiPictogramSvg from "@/games/tsume-shogi/assets/pictogram.svg?raw";
import { TSUME_SHOGI_DISPLAY_NAME } from "@/games/tsume-shogi/display-name";

// 詰将棋は記録の定義と結果画面をつないだ段でゲームカタログへ載せる。それまではここで末尾に足す。
const games = [
  ...gameCatalog.map(({ name, pictogramSvg, entryPath }) => ({
    name,
    pictogramSvg,
    to: entryPath,
  })),
  {
    name: TSUME_SHOGI_DISPLAY_NAME,
    pictogramSvg: tsumeShogiPictogramSvg,
    to: "/puzzles/tsume-shogi" as const,
  },
];

export function PuzzleSelectionView() {
  return <GameSelectionGallery games={games} recordsTo="/records" />;
}
