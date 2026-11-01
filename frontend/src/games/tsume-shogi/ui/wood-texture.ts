import kayaBoardUrl from "@/games/tsume-shogi/assets/wood/kaya-board.webp";
import kayaKomadaiUrl from "@/games/tsume-shogi/assets/wood/kaya-komadai.webp";
import tsugePieceUrl from "@/games/tsume-shogi/assets/wood/tsuge-piece.webp";

/**
 * 盤・駒台・駒に敷く木目。手続き生成した柾目を、表示の約2倍の大きさで画像に焼き込んだもので、実行時に生成の描画を走らせない。
 * 外部の画像素材は使わない。作り直しは `scripts/assets/tsume_shogi_wood_textures.mjs`。
 * - `boardTop`: 榧の天柾。細く平行な柾目で、年輪の間隔は幅の中でゆっくり変わる。
 * - `komadaiTop`: 同じ榧を長手方向に使った駒台の天面。
 * - `pieceFace`: 柘植の駒の面の細い柾目。駒の面の色にごく淡く重ね、駒ごとに模様の向きと位置を変えて使う。
 */
export const tsumeShogiWoodTextures = {
  boardTop: kayaBoardUrl,
  komadaiTop: kayaKomadaiUrl,
  pieceFace: tsugePieceUrl,
} as const;
