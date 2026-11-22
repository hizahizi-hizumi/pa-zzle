import type { CSSProperties } from "react";

import { getReagentLook } from "@/games/water-sort/ui/board/test-tube/reagent";

// 並びは色番号（0〜11）。今の絵の試薬の基の色をそのまま平らに塗る。色覚の違いで近づく組の測り方は、この色で測る。
const reagentColors: readonly string[] = [
  "#961028",
  "#2e5be0",
  "#1f8540",
  "#f1c419",
  "#5c1475",
  "#f98a2c",
  "#5fbfea",
  "#d6388a",
  "#b5dc2c",
  "#ad96dc",
  "#d9dcd8",
  "#0b605e",
];

function getColor(colorIndex: number): string {
  return reagentColors[colorIndex] ?? "#8a8f94";
}

function svgImage(svg: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function rhombus(x: number, y: number, size: number, angle: number): string {
  const half = size / 2;
  return `<path d='M${x} ${y - size} L${x + half} ${y} L${x} ${y + size} L${x - half} ${y} Z' transform='rotate(${angle} ${x} ${y})'/>`;
}

// 沈みかけた結晶の粒。明るい粒と暗い粒の2色の平らな菱形を、大きさと向きを変えて散らす。
const crystalImage = svgImage(
  "<svg xmlns='http://www.w3.org/2000/svg' width='16' height='19'>" +
    `<g fill='#fff6c4'>${rhombus(3.5, 3.5, 1.9, -18)}${rhombus(12, 8.5, 1.5, 24)}${rhombus(6, 14.5, 1.7, 8)}</g>` +
    `<g fill='#a66d00'>${rhombus(10, 2.5, 1.2, 30)}${rhombus(2.5, 10, 1.1, -30)}${rhombus(13.5, 15.5, 1.3, -12)}</g>` +
    "</svg>",
);

// 白い濁りの雲。液の幅より大きな雲を重ね、液の中には雲のもこもこした縁だけが横切るようにする。
// 丸の重なりを1つの平らな面にまとめるため不透明度は組に掛け、継ぎ目が出ないよう端をまたぐ丸は反対の端にも置く。
const CLOUD_TILE = { width: 44, height: 40 } as const;
const CLOUD_CIRCLES: readonly (readonly [number, number, number])[] = [
  [4, 6, 9],
  [17, 2, 10],
  [29, 7, 7],
  [38, 4, 6],
  [10, 26, 6],
  [22, 30, 8],
  [33, 27, 5],
];

const cloudImage = svgImage(
  `<svg xmlns='http://www.w3.org/2000/svg' width='${CLOUD_TILE.width}' height='${CLOUD_TILE.height}'>` +
    "<g fill='white' opacity='0.36'>" +
    CLOUD_CIRCLES.flatMap(([x, y, r]) =>
      [-1, 0, 1].flatMap((dx) =>
        [-1, 0, 1].map(
          (dy) =>
            `<circle cx='${x + dx * CLOUD_TILE.width}' cy='${y + dy * CLOUD_TILE.height}' r='${r}'/>`,
        ),
      ),
    ).join("") +
    "</g></svg>",
);

/** 液の塗り。平らな色の面に、色以外の手がかり（結晶・白濁・蛍光）を平らな形で重ねる。 */
export function getFlatReagentFill(colorIndex: number): CSSProperties {
  const color = getColor(colorIndex);
  switch (getReagentLook(colorIndex)) {
    case "sparkle":
      return {
        backgroundColor: color,
        backgroundImage: crystalImage,
        backgroundSize: "16px 19px",
        backgroundPosition: "0 100%",
      };
    case "milky":
      return {
        backgroundColor: color,
        backgroundImage: cloudImage,
        backgroundSize: `${CLOUD_TILE.width}px ${CLOUD_TILE.height}px`,
        backgroundPosition: "0 100%",
      };
    case "glow": {
      // 自ら光る液は、壁際の縁ほど明るい。2段の平らな帯にするため、色の境を同じ位置で切り替える。
      const outer = `color-mix(in oklab, ${color}, #fbffd8 68%)`;
      const inner = `color-mix(in oklab, ${color}, #fbffd8 34%)`;
      return {
        backgroundColor: color,
        backgroundImage: `linear-gradient(90deg, ${outer} 0 8%, ${inner} 8% 17%, transparent 17% 83%, ${inner} 83% 92%, ${outer} 92% 100%)`,
      };
    }
    default:
      return { backgroundColor: color };
  }
}

/** 注ぐ液の筋の塗り。細い筋なので手がかりを重ねず、液の色の平らな面にする。 */
export function getFlatReagentStreamFill(colorIndex: number): CSSProperties {
  return { backgroundColor: getColor(colorIndex) };
}

/** 液面の縁の暗い帯の濃さ。どの液も同じ濃さにする。 */
export const FLAT_SURFACE_SHADE = 0.32;

export function getFlatReagentSurfaceShade(): number {
  return FLAT_SURFACE_SHADE;
}
