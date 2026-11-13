// 試作 glass: 色水の色。縁の濃い色（deep）、本体（base）、中央の明るい色（light）、液面（surface）。
type LiquidColor = { base: string; deep: string; light: string; surface: string };

const liquidColors: readonly LiquidColor[] = [
  { base: "#e2464f", deep: "#8e1426", light: "#ff8d88", surface: "#ffb0aa" }, // 赤
  { base: "#3b6cf2", deep: "#152f9c", light: "#8eb0ff", surface: "#b6cbff" }, // 青
  { base: "#2fb866", deep: "#0d6a35", light: "#7fe6a6", surface: "#aef2c7" }, // 緑
  { base: "#ffcc2e", deep: "#c98a05", light: "#fff09a", surface: "#fff6c4" }, // 黄
  { base: "#a35ae8", deep: "#5a22a6", light: "#d6aaff", surface: "#e6caff" }, // 紫
  { base: "#ff8f2e", deep: "#bf4b0b", light: "#ffc48a", surface: "#ffd9b2" }, // 橙
  { base: "#45c9ee", deep: "#0d7ea8", light: "#aef0ff", surface: "#cdf6ff" }, // 水色
  { base: "#f0589c", deep: "#a51c5e", light: "#ffa9d0", surface: "#ffc7e1" }, // 桃
  { base: "#a9d132", deep: "#5f8a0d", light: "#e0f79a", surface: "#ecfbbe" }, // 黄緑
  { base: "#b293fb", deep: "#6a47c8", light: "#e4d8ff", surface: "#efe8ff" }, // 薄紫
  { base: "#c0cad7", deep: "#6c798d", light: "#f2f5f9", surface: "#f7f9fb" }, // 薄い灰
  { base: "#22a2b2", deep: "#0a5e6c", light: "#7fdbe5", surface: "#b2ebf0" }, // 青緑
];

export function getLiquidColor(colorIndex: number): LiquidColor {
  return (
    liquidColors[colorIndex] ?? {
      base: `hsl(${(colorIndex * 47) % 360} 70% 55%)`,
      deep: `hsl(${(colorIndex * 47) % 360} 70% 30%)`,
      light: `hsl(${(colorIndex * 47) % 360} 80% 75%)`,
      surface: `hsl(${(colorIndex * 47) % 360} 80% 85%)`,
    }
  );
}

export const LIQUID_COLOR_COUNT = liquidColors.length;

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m?.[1]) return null;
  const n = Number.parseInt(m[1], 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}

/** 2色を t の割合で混ぜる（#rrggbb 以外はそのまま a を返す）。 */
export function mixHex(a: string, b: string, t: number): string {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) return a;
  const c = ca.map((v, i) => Math.round(v + ((cb[i] ?? 0) - v) * t));
  return `rgb(${c.join(",")})`;
}
