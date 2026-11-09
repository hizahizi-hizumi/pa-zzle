import type { ReactNode } from "react";

import { TUTORIAL_FOCUS_SCRIM_Z_INDEX } from "@/components/TutorialSpotlight";

type TutorialForegroundProps = {
  /** `true` の間、中身を覆いの上に出す。`false` なら、包まないときと同じ重なり順で描く。 */
  active: boolean;
  children: ReactNode;
};

/**
 * チュートリアルで手を引く間に、盤面の外の層で動く物（注ぐボトルなど）を、画面全体の覆いの上に出す。
 * 動く物は形が変わり続けるので、覆いを抜くと抜いた四角が物より大きく明るく見える。覆いを外すと手順ごとに画面が明滅する。
 * そこで、覆いを重ねたまま、動く物だけを覆いの上へ出す。
 *
 * 中身が `position: fixed` で画面の座標に置く層でも、この要素は包含ブロックを作らないので、中身の位置は変わらない。
 * 覆いと同じ重なりの文脈（チュートリアルの画面）の中に置いたときだけ、覆いの上に出る。
 */
export function TutorialForeground({
  active,
  children,
}: TutorialForegroundProps) {
  if (!active) {
    return children;
  }
  return (
    <div
      className="relative"
      style={{ zIndex: TUTORIAL_FOCUS_SCRIM_Z_INDEX + 1 }}
    >
      {children}
    </div>
  );
}
