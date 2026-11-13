// 色水の色。名前（読み上げ）は今の画面と同じ `getWaterColorView` を使い、見た目の色だけをここで決める。
// light は液面に近い上の色、deep は底の色。

type LiquidColor = { light: string; deep: string };

const liquidColors: readonly LiquidColor[] = [
  { light: "#f25a55", deep: "#b5262e" }, // 赤
  { light: "#4a86f5", deep: "#1f45b3" }, // 青
  { light: "#45c46f", deep: "#1d8a45" }, // 緑
  { light: "#ffda4d", deep: "#e09d10" }, // 黄
  { light: "#a35ee8", deep: "#5f25ad" }, // 紫
  { light: "#ff9d40", deep: "#d75f17" }, // 橙
  { light: "#86e0f7", deep: "#2fa6d1" }, // 水色
  { light: "#ff85c2", deep: "#d33f8c" }, // 桃
  { light: "#c8e352", deep: "#86a91c" }, // 黄緑
  { light: "#d4bcff", deep: "#9175e3" }, // 薄紫
  { light: "#e3e7ec", deep: "#8e9aaa" }, // 薄い灰
  { light: "#43bdb0", deep: "#16756f" }, // 青緑
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
