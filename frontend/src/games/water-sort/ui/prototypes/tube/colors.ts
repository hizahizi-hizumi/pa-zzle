// 色水の色。名前（読み上げ）は今の画面と同じ `getWaterColorView` を使い、見た目の色だけをここで決める。
// light は液面に近い上の色、deep は底の色。

type LiquidColor = { light: string; deep: string };

const liquidColors: readonly LiquidColor[] = [
  { light: "#f0514c", deep: "#b3232b" }, // 赤
  { light: "#3d74f0", deep: "#1c3fa8" }, // 青
  { light: "#3cc35c", deep: "#1b8a3d" }, // 緑
  { light: "#ffd93d", deep: "#dc9a0c" }, // 黄
  { light: "#8a3ee0", deep: "#4f1d9c" }, // 紫
  { light: "#ff9233", deep: "#d25812" }, // 橙
  { light: "#8fe6ff", deep: "#38aed6" }, // 水色
  { light: "#ff7dbf", deep: "#cf3a88" }, // 桃
  { light: "#c6e64a", deep: "#83a818" }, // 黄緑
  { light: "#e2cdff", deep: "#a98be8" }, // 薄紫
  { light: "#f7f3ea", deep: "#b9b0a0" }, // 薄い灰
  { light: "#16968b", deep: "#0b5e58" }, // 青緑
];

export function liquidColor(colorIndex: number): LiquidColor {
  return (
    liquidColors[colorIndex] ?? {
      light: `hsl(${(colorIndex * 47) % 360} 75% 62%)`,
      deep: `hsl(${(colorIndex * 47) % 360} 70% 40%)`,
    }
  );
}

export const LIQUID_COLOR_COUNT = liquidColors.length;

export function lighten(hex: string, k: number): string {
  if (!hex.startsWith("#")) return hex;
  const n = Number.parseInt(hex.slice(1), 16);
  const r = n >> 16;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const mix = (v: number) => Math.round(v + (255 - v) * k);
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}

/** hex を黒へ k だけ寄せる。 */
export function darken(hex: string, k: number): string {
  if (!hex.startsWith("#")) return hex;
  const n = Number.parseInt(hex.slice(1), 16);
  const r = n >> 16;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const mix = (v: number) => Math.round(v * (1 - k));
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}
