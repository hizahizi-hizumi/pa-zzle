/**
 * 瓶の絵の座標。盤面のボトルは幅:高さ = 0.36 なので、viewBox を 36×100 にして歪ませずに描く。
 * 液は胴のまっすぐな所にだけ入れ、4段がどれも同じ高さになるようにする。
 */
export const JAR_VIEW_BOX = "0 0 36 100";

/** 液を入れる内側（viewBox の座標）。 */
export const JAR_SYRUP_LEFT = 3.7;
export const JAR_SYRUP_RIGHT = 32.3;
export const JAR_SYRUP_TOP = 23;
export const JAR_SYRUP_BOTTOM = 90.5;

/** 液の入れ物を、ボトルの箱に対する割合で置く。 */
export const JAR_SYRUP_BOX = {
  left: `${(JAR_SYRUP_LEFT / 36) * 100}%`,
  right: `${((36 - JAR_SYRUP_RIGHT) / 36) * 100}%`,
  top: `${JAR_SYRUP_TOP}%`,
  bottom: `${100 - JAR_SYRUP_BOTTOM}%`,
} as const;

/** 液の入れ物の下の角の丸み（入れ物の幅と高さに対する割合）。 */
export const JAR_SYRUP_RADIUS = "0 0 15% 15% / 0 0 6% 6%";

/** 液面の高さ（ボトルの箱の上端からの割合）。`slotCount` は入っている段の数。 */
export function getSyrupSurfaceRatio(slotCount: number): number {
  return (
    (JAR_SYRUP_BOTTOM - ((JAR_SYRUP_BOTTOM - JAR_SYRUP_TOP) * slotCount) / 4) /
    100
  );
}

/** 胴・首・口の輪郭。口は広く、肩は小さい。 */
export const JAR_OUTLINE_PATH =
  "M6.2 6.6 L6.2 14 C6.2 16.6 2 17.4 2 21.5 L2 91 C2 95.2 4.6 97.4 8.6 97.4 L27.4 97.4 C31.4 97.4 34 95.2 34 91 L34 21.5 C34 17.4 29.8 16.6 29.8 14 L29.8 6.6 Z";

/** ガラスの厚みの内側の線。 */
export const JAR_INNER_PATH =
  "M7.6 7 L7.6 14.4 C7.6 17.6 3.5 18.2 3.5 22 L3.5 90.4 C3.5 93.6 5.4 95.6 8.8 95.6 L27.2 95.6 C30.6 95.6 32.5 93.6 32.5 90.4 L32.5 22 C32.5 18.2 28.4 17.6 28.4 14.4 L28.4 7 Z";
