import type { CSSProperties } from "react";

/**
 * 透き通る液は光を通して中ほどが明るく、濁る液と乳の液は表面で光を返して左が明るい。
 * 透明度と粒（種・果肉・皮・泡）の差で、赤から黄に寄る果実の色どうしも見分けられるようにする。
 */
type SyrupClarity = "clear" | "cloudy" | "opaque";

type KitchenSyrup = {
  fruit: string;
  base: string;
  light: string;
  shade: string;
  clarity: SyrupClarity;
  /** 液の中の粒の SVG（タイル1枚分）と、その大きさ（px）。 */
  texture?: { svg: string; width: number; height: number };
};

function tile(width: number, height: number, body: string) {
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`,
    width,
    height,
  };
}

type Speck = { x: number; y: number; size: number; angle: number };

/** 粒を不揃いに散らす。決まった種から求めるので、描くたびに同じ散らばりになる。 */
function scatter(
  width: number,
  height: number,
  count: number,
  seed: number,
  draw: (speck: Speck) => string,
): string {
  let state = seed;
  function next() {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  }
  return Array.from({ length: count }, function placeSpeck() {
    return draw({
      x: Number((next() * width).toFixed(2)),
      y: Number((next() * height).toFixed(2)),
      size: Number((0.7 + next() * 0.6).toFixed(2)),
      angle: Math.round(next() * 180 - 90),
    });
  }).join("");
}

// 色番号は今の画面の色の名前（get-water-color-view.ts）の色味に近い果実へ当て、読み上げの色名と大きく食い違わないようにする。
const kitchenSyrups: readonly KitchenSyrup[] = [
  {
    fruit: "苺",
    base: "#d42a3a",
    light: "#f2606a",
    shade: "#97121f",
    clarity: "cloudy",
    texture: tile(
      30,
      26,
      scatter(30, 26, 11, 7, function seed({ x, y, size, angle }) {
        return `<ellipse cx="${x}" cy="${y}" rx="${0.55 * size}" ry="${0.85 * size}" transform="rotate(${angle} ${x} ${y})" fill="#ffe3a0" fill-opacity="${0.5 + size * 0.3}"/>`;
      }) +
        scatter(30, 26, 7, 19, function pulp({ x, y, size, angle }) {
          return `<ellipse cx="${x}" cy="${y}" rx="${1.6 * size}" ry="${0.7 * size}" transform="rotate(${angle} ${x} ${y})" fill="#7d0a17" fill-opacity=".28"/>`;
        }),
    ),
  },
  {
    fruit: "ブルーベリー",
    base: "#3d4b93",
    light: "#5f6fb5",
    shade: "#232b63",
    clarity: "opaque",
    texture: tile(
      28,
      24,
      scatter(28, 24, 9, 3, function skin({ x, y, size, angle }) {
        return `<ellipse cx="${x}" cy="${y}" rx="${1.3 * size}" ry="${0.8 * size}" transform="rotate(${angle} ${x} ${y})" fill="#15173f" fill-opacity=".5"/>`;
      }) +
        scatter(28, 24, 8, 41, function bloom({ x, y, size }) {
          return `<circle cx="${x}" cy="${y}" r="${0.5 * size}" fill="#a9b3e6" fill-opacity=".4"/>`;
        }),
    ),
  },
  {
    fruit: "キウイ",
    base: "#82b234",
    light: "#a9d158",
    shade: "#557c1c",
    clarity: "cloudy",
    texture: tile(
      26,
      22,
      scatter(26, 22, 6, 23, function flesh({ x, y, size }) {
        return `<circle cx="${x}" cy="${y}" r="${1.2 * size}" fill="#eaf7b4" fill-opacity=".22"/>`;
      }) +
        scatter(26, 22, 13, 5, function seed({ x, y, size, angle }) {
          return `<ellipse cx="${x}" cy="${y}" rx="${0.45 * size}" ry="${0.85 * size}" transform="rotate(${angle} ${x} ${y})" fill="#15130a" fill-opacity=".9"/>`;
        }),
    ),
  },
  {
    fruit: "柚子",
    base: "#f2cf3e",
    light: "#fbe78a",
    shade: "#cfa11a",
    clarity: "cloudy",
    texture: tile(
      32,
      26,
      scatter(32, 26, 7, 29, function cloud({ x, y, size }) {
        return `<circle cx="${x}" cy="${y}" r="${1.6 * size}" fill="#fff8d8" fill-opacity=".35"/>`;
      }) +
        scatter(32, 26, 9, 13, function zest({ x, y, size, angle }) {
          return `<ellipse cx="${x}" cy="${y}" rx="${1.3 * size}" ry=".38" transform="rotate(${angle} ${x} ${y})" fill="#e0920f" fill-opacity=".55"/>`;
        }),
    ),
  },
  {
    fruit: "葡萄",
    base: "#7b2371",
    light: "#c058aa",
    shade: "#45093f",
    clarity: "clear",
  },
  {
    fruit: "橙",
    base: "#f0861f",
    light: "#ffb059",
    shade: "#c55c0c",
    clarity: "cloudy",
    texture: tile(
      28,
      24,
      scatter(28, 24, 12, 17, function vesicle({ x, y, size, angle }) {
        return `<ellipse cx="${x}" cy="${y}" rx="${0.55 * size}" ry="${1.8 * size}" transform="rotate(${angle} ${x} ${y})" fill="#ffd38c" fill-opacity=".55"/>`;
      }),
    ),
  },
  {
    fruit: "バタフライピー",
    base: "#2a6fdf",
    light: "#6aa6ff",
    shade: "#163c9a",
    clarity: "clear",
  },
  {
    fruit: "桃",
    base: "#f5a898",
    light: "#ffd3c7",
    shade: "#dc7c6e",
    clarity: "cloudy",
    texture: tile(
      34,
      28,
      scatter(34, 28, 6, 31, function nectar({ x, y, size }) {
        return `<ellipse cx="${x}" cy="${y}" rx="${2.6 * size}" ry="${1.5 * size}" fill="#fff1ea" fill-opacity=".32"/>`;
      }) +
        scatter(34, 28, 5, 37, function fiber({ x, y, size, angle }) {
          return `<ellipse cx="${x}" cy="${y}" rx="${1.6 * size}" ry="${0.55 * size}" transform="rotate(${angle} ${x} ${y})" fill="#e47d6c" fill-opacity=".28"/>`;
        }),
    ),
  },
  {
    fruit: "メロン",
    base: "#4fbf7c",
    light: "#9be8b4",
    shade: "#23834b",
    clarity: "clear",
    texture: tile(
      28,
      30,
      scatter(28, 30, 9, 11, function bubble({ x, y, size }) {
        return `<circle cx="${x}" cy="${y}" r="${0.7 * size}" fill="none" stroke="#f2fff6" stroke-opacity=".75" stroke-width=".5"/>`;
      }),
    ),
  },
  {
    fruit: "ラベンダー",
    base: "#a487d8",
    light: "#d9c8f5",
    shade: "#5f4596",
    clarity: "cloudy",
  },
  {
    fruit: "ミルク",
    base: "#fdfbf6",
    light: "#ffffff",
    shade: "#ad9a78",
    clarity: "opaque",
  },
  {
    fruit: "珈琲",
    base: "#5a3521",
    light: "#80553a",
    shade: "#341b0f",
    clarity: "opaque",
  },
];

export function getKitchenSyrup(colorIndex: number): KitchenSyrup {
  return (
    kitchenSyrups[colorIndex] ?? {
      fruit: `色 ${colorIndex + 1}`,
      base: `hsl(${(colorIndex * 47) % 360} 60% 50%)`,
      light: `hsl(${(colorIndex * 47) % 360} 60% 65%)`,
      shade: `hsl(${(colorIndex * 47) % 360} 60% 35%)`,
      clarity: "cloudy",
    }
  );
}

function getClarityGradient({ base, light, shade, clarity }: KitchenSyrup) {
  switch (clarity) {
    case "clear":
      return `radial-gradient(ellipse 70% 120% at 42% 55%, ${light} 0%, ${base} 48%, ${shade} 100%)`;
    case "cloudy":
      return `linear-gradient(90deg, ${shade} 0%, ${light} 22%, ${base} 48%, ${base} 70%, ${shade} 100%)`;
    case "opaque":
      return `linear-gradient(90deg, ${base} 0%, ${light} 20%, ${base} 46%, ${base} 74%, ${shade} 100%)`;
  }
}

/** 瓶の丸みで、液の両端が暗く沈む。 */
const JAR_ROUNDNESS_GRADIENT =
  "linear-gradient(90deg, rgba(40,24,8,0.16) 0%, rgba(40,24,8,0) 16%, rgba(40,24,8,0) 64%, rgba(40,24,8,0.22) 100%)";

/** 1段分の液の見た目。瓶の丸み・粒・光の通り方・地の色を重ねる。 */
export function getSyrupStyle(colorIndex: number): CSSProperties {
  const syrup = getKitchenSyrup(colorIndex);
  const gradient = `${JAR_ROUNDNESS_GRADIENT}, ${getClarityGradient(syrup)}`;
  if (!syrup.texture) {
    return { backgroundColor: syrup.base, backgroundImage: gradient };
  }
  const textureUrl = `url("data:image/svg+xml,${encodeURIComponent(syrup.texture.svg)}")`;
  return {
    backgroundColor: syrup.base,
    backgroundImage: `${textureUrl}, ${gradient}`,
    backgroundSize: `${syrup.texture.width}px ${syrup.texture.height}px, 100% 100%, 100% 100%`,
  };
}

/** 注ぐ筋の見た目。太く落ちるとろみを、片側の照りで出す。 */
export function getSyrupStreamStyle(colorIndex: number): CSSProperties {
  const { base, light, shade } = getKitchenSyrup(colorIndex);
  return {
    backgroundColor: base,
    backgroundImage: `linear-gradient(90deg, ${shade} 0%, ${base} 18%, ${light} 34%, ${base} 52%, ${base} 78%, ${shade} 100%)`,
  };
}
