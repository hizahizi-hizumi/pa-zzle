/**
 * 例と入口のゴールの盤面の升の幅（`--tsume-shogi-figure-square`）。どちらも同じ大きさの升に見せる。
 * スマートフォンでは、ゴールの盤面（5筋と、淡く消えていく半升と、段の縁）が画面の幅（左右の余白を除く）に収まる大きさにし、
 * 本番の盤の升（幅 390px で約 36px）より大きく、駒の字を読みやすくする。
 * PC では固定の大きさにし、3筋に切り出した対の例2つが、右の列（40rem）の例の面に、共通の部品の対の間を空けて横に並ぶ大きさにする。
 */
export const tsumeShogiFigureSquareClassName =
  "[--tsume-shogi-figure-square:min(3.75rem,calc((100vw-3.25rem)/5.5))] lg:[--tsume-shogi-figure-square:4rem]";
