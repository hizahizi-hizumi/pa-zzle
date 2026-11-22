import type { CSSProperties } from "react";

type SummerWaterColor = {
  /** 瓶の中の色水。 */
  water: string;
  /** 陽が色水を通って縁側に落とす光の色。 */
  light: string;
};

/**
 * 色番号（`get-water-color-view.ts` と同じ並び）ごとの色水。
 * 紫から赤の寄りは朝顔・鳳仙花などの花をつぶした色水、ほかは絵の具を溶いた色水に見立てる。
 */
const summerWaterColors: readonly SummerWaterColor[] = [
  // 赤: 鳳仙花
  { water: "#e2414c", light: "#ff8a8f" },
  // 青: 朝顔の青
  { water: "#3256d2", light: "#7f9dff" },
  // 緑: 絵の具
  { water: "#2b9a52", light: "#7fdc98" },
  // 黄: 絵の具
  { water: "#f7cb34", light: "#ffe78a" },
  // 紫: 朝顔の紫
  { water: "#8a3cc2", light: "#c58cf2" },
  // 橙: 絵の具
  { water: "#f6862a", light: "#ffbc7a" },
  // 水色: ラムネのような空色
  { water: "#62caea", light: "#aee8fb" },
  // 桃: 朝顔の桃
  { water: "#f179b3", light: "#ffb3d6" },
  // 黄緑: 絵の具
  { water: "#a6cf37", light: "#d8f08a" },
  // 薄紫: 藤色の花
  { water: "#bba1f4", light: "#ddd0ff" },
  // 薄い灰: 薄墨
  { water: "#a8b0b9", light: "#dde2e8" },
  // 青緑: 絵の具
  { water: "#1fa396", light: "#74e0d2" },
];

export function getSummerWaterColor(colorIndex: number): SummerWaterColor {
  return (
    summerWaterColors[colorIndex] ?? {
      water: `hsl(${(colorIndex * 47) % 360} 70% 55%)`,
      light: `hsl(${(colorIndex * 47) % 360} 90% 78%)`,
    }
  );
}

/**
 * 色水の上端。
 * - `surface`: 水面。ひときわ明るく光る。
 * - `boundary`: 下の色との境。数えやすいよう細く光らせる。
 * - `none`: 同じ色がその上に続く。
 */
export type LiquidTopEdge = "surface" | "boundary" | "none";

const liquidTopEdgeShadows: Record<LiquidTopEdge, string> = {
  surface:
    "inset 0 2px 0 rgba(255,255,255,0.55), inset 0 4px 3px -2px rgba(255,255,255,0.35)",
  boundary: "inset 0 1px 0 rgba(255,255,255,0.4)",
  none: "none",
};

// 丸い瓶の中の色水に見えるよう、陽の当たる左を明るく、右を沈ませる。
const liquidRoundShading =
  "linear-gradient(90deg, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0.12) 16%, rgba(255,255,255,0) 38%, rgba(0,0,0,0) 66%, rgba(0,0,0,0.16) 92%, rgba(0,0,0,0.22) 100%)";

export function getLiquidStyle(
  colorIndex: number,
  topEdge: LiquidTopEdge,
): CSSProperties {
  return {
    backgroundColor: getSummerWaterColor(colorIndex).water,
    backgroundImage: liquidRoundShading,
    boxShadow: liquidTopEdgeShadows[topEdge],
  };
}
