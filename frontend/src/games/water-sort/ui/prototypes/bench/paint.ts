// 試作 bench の色。液の色は今の画面と同じ色名・色を元にする。
import { getWaterColorView } from "@/games/water-sort/ui/board/water-bottle/get-water-color-view";

function parse(color: string): [number, number, number] {
  if (color.startsWith("#")) {
    const n = Number.parseInt(color.slice(1), 16);
    return [n >> 16, (n >> 8) & 255, n & 255];
  }
  const m = color.match(/hsl\((\d+(?:\.\d+)?) (\d+)% (\d+)%\)/);
  if (m) {
    const h = Number(m[1]) / 360;
    const s = Number(m[2]) / 100;
    const l = Number(m[3]) / 100;
    const f = (n: number) => {
      const kk = (n + h * 12) % 12;
      const a = s * Math.min(l, 1 - l);
      return Math.round(
        255 * (l - a * Math.max(-1, Math.min(kk - 3, 9 - kk, 1))),
      );
    };
    return [f(0), f(8), f(4)];
  }
  return [128, 128, 128];
}

function toHex([r, g, b]: [number, number, number]) {
  return `#${[r, g, b]
    .map((v) =>
      Math.round(Math.min(255, Math.max(0, v)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

export function mix(a: string, b: string, t: number): string {
  const ca = parse(a);
  const cb = parse(b);
  return toHex([
    ca[0] + (cb[0] - ca[0]) * t,
    ca[1] + (cb[1] - ca[1]) * t,
    ca[2] + (cb[2] - ca[2]) * t,
  ]);
}

export type LiquidPaint = {
  base: string;
  light: string;
  deep: string;
  surface: string;
  rim: string;
};

const cache = new Map<number, LiquidPaint>();

export function liquidPaint(colorIndex: number): LiquidPaint {
  let paint = cache.get(colorIndex);
  if (!paint) {
    const base = getWaterColorView(colorIndex).color;
    paint = {
      base,
      light: mix(base, "#ffffff", 0.1),
      deep: mix(base, "#1a1030", 0.17),
      surface: mix(base, "#ffffff", 0.42),
      rim: mix(base, "#ffffff", 0.62),
    };
    cache.set(colorIndex, paint);
  }
  return paint;
}

export const LIQUID_COLOR_COUNT = 12;
