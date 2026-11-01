import kayaBoardUrl from "@/games/tsume-shogi/assets/wood/kaya-board.webp";
import kayaKomadaiUrl from "@/games/tsume-shogi/assets/wood/kaya-komadai.webp";
import tsugePieceUrl from "@/games/tsume-shogi/assets/wood/tsuge-piece.webp";

/**
 * 盤・駒台・駒に敷く木目。どれも SVG の feTurbulence で手続き生成した柾目を、表示の約2倍の大きさで WebP に焼き込んだもの
 * （実行時に生成の描画を走らせない）。外部の画像素材は使っていない。
 * - `boardTop`: 榧の天柾。細く平行な柾目で、年輪の間隔は幅の中でゆっくり変わる。盤の側面もこれを暗くして使う。
 * - `komadaiTop`: 同じ榧を長手方向に使った駒台の天面。
 * - `pieceFace`: 柘植の駒の面。盤より黄色く明るく、細かく不規則な木目。駒2枚分の大きさで、駒ごとに位置をずらして使う。
 */
export const tsumeShogiWoodTextures = {
  boardTop: kayaBoardUrl,
  komadaiTop: kayaKomadaiUrl,
  pieceFace: tsugePieceUrl,
} as const;
