// 試作 label: 色水の色。番号は `getWaterColorView` と同じ並び。

const liquidColors: readonly (readonly [string, string])[] = [
  ["#ec3f45", "#a8172a"], // 赤
  ["#4f80f2", "#2244b2"], // 青
  ["#46c46e", "#1d8744"], // 緑
  ["#ffd72e", "#d99e00"], // 黄
  ["#aa65e8", "#6a2eb8"], // 紫
  ["#ff8a1e", "#cc5208"], // 橙
  ["#72d8f0", "#2a9cc0"], // 水色
  ["#f276b6", "#bd3980"], // 桃
  ["#c0dc4e", "#84a31d"], // 黄緑
  ["#c6a9ff", "#8565d6"], // 薄紫
  ["#c9d1dc", "#828fa2"], // 薄い灰
  ["#4cb3bf", "#1f7d8c"], // 青緑
];

function parse(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [value >> 16, (value >> 8) & 255, value & 255];
}

function format([r, g, b]: [number, number, number]): string {
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

export function mix(hex: string, target: string, amount: number): string {
  const a = parse(hex);
  const b = parse(target);
  return format([
    a[0] + (b[0] - a[0]) * amount,
    a[1] + (b[1] - a[1]) * amount,
    a[2] + (b[2] - a[2]) * amount,
  ]);
}

function toHex(rgb: string): string {
  const parts = rgb.match(/\d+/g)?.map(Number) ?? [0, 0, 0];
  return `#${parts
    .slice(0, 3)
    .map((part) => part.toString(16).padStart(2, "0"))
    .join("")}`;
}

export type LiquidTone = { light: string; dark: string; surface: string; glow: string };

/**
 * 色水の色。`deep` は封をして澄んだ度合い（0 は曇った液、1 は澄んで一段深い液）。
 */
export function liquidTone(colorIndex: number, deep: number): LiquidTone {
  const [light, dark] = liquidColors[colorIndex] ?? ["#999999", "#666666"];
  const hazyLight = toHex(mix(light, "#eef2f4", 0.07));
  const hazyDark = toHex(mix(dark, "#c8d0d6", 0.14));
  const deepLight = toHex(mix(light, dark, 0.2));
  const deepDark = toHex(mix(dark, "#140a1e", 0.3));
  const toneLight = toHex(mix(hazyLight, deepLight, deep));
  const toneDark = toHex(mix(hazyDark, deepDark, deep));
  return {
    light: toneLight,
    dark: toneDark,
    surface: mix(toneLight, "#ffffff", 0.42 - deep * 0.08),
    glow: light,
  };
}

export function baseLiquidColor(colorIndex: number): string {
  return liquidColors[colorIndex]?.[0] ?? "#999999";
}
