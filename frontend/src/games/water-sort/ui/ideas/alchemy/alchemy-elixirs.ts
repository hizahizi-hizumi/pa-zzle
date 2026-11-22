import type { CSSProperties } from "react";

/**
 * 霊液の見た目の性質。色だけに頼らず、暗い工房でも液の性質で見分けられるようにする。
 * - `clear`: 澄んで深い。
 * - `ember`: 内に熾火を抱いて、芯が明るく光る。
 * - `luminous`: 液そのものが淡く光る。
 * - `gold`: 金の粒が舞う。
 * - `motes`: 銀の細かな粒が漂う。
 * - `bubbles`: ねばりがあり、泡を抱いている。
 * - `smoke`: 中に煙がたなびく。
 * - `milky`: 乳白に濁っている。
 * - `mist`: 乳白に濁り、靄が渦を巻く。
 * - `mercury`: 水銀のように金属の光を返す。
 */
type ElixirNature =
  | "clear"
  | "ember"
  | "luminous"
  | "gold"
  | "motes"
  | "bubbles"
  | "smoke"
  | "milky"
  | "mist"
  | "mercury";

type Elixir = {
  color: string;
  nature: ElixirNature;
  /** 注ぐときの糸の太さ（px）。ねばる液ほど太く、水銀は細い。 */
  threadWidthPx: number;
};

// 色番号は `get-water-color-view.ts` と同じ並び（赤・青・緑・黄・紫・橙・水色・桃・黄緑・薄紫・薄い灰・青緑）。
const elixirs: readonly Elixir[] = [
  { color: "#e3403f", nature: "clear", threadWidthPx: 2.5 },
  { color: "#4f6ff2", nature: "clear", threadWidthPx: 2.5 },
  { color: "#33b863", nature: "clear", threadWidthPx: 2.5 },
  { color: "#ecbc2a", nature: "gold", threadWidthPx: 3 },
  { color: "#a052dc", nature: "smoke", threadWidthPx: 2.5 },
  { color: "#ff8a2a", nature: "ember", threadWidthPx: 3 },
  { color: "#7fe2f6", nature: "luminous", threadWidthPx: 2 },
  { color: "#f27db6", nature: "milky", threadWidthPx: 3 },
  { color: "#b7db3c", nature: "bubbles", threadWidthPx: 4 },
  { color: "#c6abff", nature: "mist", threadWidthPx: 3 },
  { color: "#c9cfd8", nature: "mercury", threadWidthPx: 1.6 },
  { color: "#22a6a3", nature: "motes", threadWidthPx: 2.5 },
];

const fallbackElixir: Elixir = {
  color: "#9a9a9a",
  nature: "clear",
  threadWidthPx: 2.5,
};

export function getElixir(colorIndex: number): Elixir {
  return elixirs[colorIndex] ?? fallbackElixir;
}

/** 円筒の器に入った液の、左右の陰と、左寄りの照り。 */
const cylinderShade =
  "linear-gradient(90deg, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0) 20%, rgba(255,255,255,0.18) 33%, rgba(255,255,255,0) 50%, rgba(0,0,0,0.1) 76%, rgba(0,0,0,0.46) 100%)";

const softCylinderShade =
  "linear-gradient(90deg, rgba(0,0,0,0.26) 0%, rgba(0,0,0,0) 22%, rgba(255,255,255,0.12) 36%, rgba(255,255,255,0) 54%, rgba(0,0,0,0.06) 78%, rgba(0,0,0,0.3) 100%)";

function svgImage(svg: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

type Wisp = {
  /** 筋の色（0〜1）。 */
  rgb: readonly [number, number, number];
  baseFrequency: string;
  /** 雑音の濃さから筋の不透明度を作る傾きと切片。傾きが大きいほど筋の縁がくっきりする。 */
  alphaSlope: number;
  alphaIntercept: number;
  opacity: number;
};

/** 液の中にたなびく煙・靄。継ぎ目なく並べられる小さな絵にする。 */
function wispImage({
  rgb: [red, green, blue],
  baseFrequency,
  alphaSlope,
  alphaIntercept,
  opacity,
}: Wisp): string {
  return svgImage(
    `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="36"><filter id="w" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${baseFrequency}" numOctaves="2" seed="4" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 ${red} 0 0 0 0 ${green} 0 0 0 0 ${blue} ${alphaSlope} 0 0 0 ${alphaIntercept}"/></filter><rect width="48" height="36" filter="url(#w)" opacity="${opacity}"/></svg>`,
  );
}

const smokeWisps = wispImage({
  rgb: [0.96, 0.86, 1],
  baseFrequency: "0.05 0.14",
  alphaSlope: 4.2,
  alphaIntercept: -1.85,
  opacity: 0.85,
});

const mistClouds = wispImage({
  rgb: [1, 1, 1],
  baseFrequency: "0.09 0.11",
  alphaSlope: 2.4,
  alphaIntercept: -0.9,
  opacity: 0.7,
});

function getNatureLayers(nature: ElixirNature): {
  image: string;
  size?: string;
} {
  switch (nature) {
    case "clear":
      return {
        image: `linear-gradient(180deg, rgba(255,255,255,0.08), rgba(0,0,0,0.22)), ${cylinderShade}`,
      };
    case "ember":
      return {
        image: `radial-gradient(ellipse 46% 58% at 46% 55%, rgba(255,246,196,0.9) 0%, rgba(255,214,120,0.45) 38%, rgba(255,214,120,0) 76%), ${softCylinderShade}`,
      };
    case "luminous":
      return {
        image: `radial-gradient(ellipse 70% 80% at 45% 50%, rgba(240,255,255,0.7) 0%, rgba(240,255,255,0.14) 55%, rgba(240,255,255,0) 85%), ${softCylinderShade}`,
      };
    case "gold":
      return {
        image: `radial-gradient(circle at 30% 35%, #fffbe6 0 0.8px, rgba(255,251,230,0) 1.3px), radial-gradient(circle at 72% 70%, #fff3c0 0 0.7px, rgba(255,243,192,0) 1.2px), radial-gradient(circle at 55% 20%, #7a4e05 0 0.7px, rgba(122,78,5,0) 1.1px), radial-gradient(circle at 15% 80%, #8a5a08 0 0.6px, rgba(138,90,8,0) 1px), ${cylinderShade}`,
        size: "9px 10px, 13px 9px, 11px 12px, 8px 13px, 100% 100%",
      };
    case "motes":
      return {
        image: `radial-gradient(circle at 25% 30%, rgba(235,255,250,0.95) 0 0.5px, rgba(235,255,250,0) 0.9px), radial-gradient(circle at 70% 65%, rgba(235,255,250,0.8) 0 0.45px, rgba(235,255,250,0) 0.8px), ${cylinderShade}`,
        size: "5px 6px, 7px 5px, 100% 100%",
      };
    case "bubbles":
      return {
        image: `radial-gradient(circle at 35% 40%, rgba(255,255,230,0) 0 1.1px, rgba(255,255,230,0.75) 1.3px 1.8px, rgba(255,255,230,0) 2.1px), radial-gradient(circle at 75% 75%, rgba(255,255,230,0) 0 0.6px, rgba(255,255,230,0.7) 0.8px 1.2px, rgba(255,255,230,0) 1.5px), linear-gradient(180deg, rgba(255,255,255,0.1), rgba(60,70,0,0.18)), ${softCylinderShade}`,
        size: "11px 12px, 8px 9px, 100% 100%, 100% 100%",
      };
    case "smoke":
      return {
        image: `${smokeWisps}, linear-gradient(180deg, rgba(255,255,255,0.04), rgba(20,0,40,0.3)), ${cylinderShade}`,
        size: "48px 36px, 100% 100%, 100% 100%",
      };
    case "milky":
      return {
        image: `radial-gradient(ellipse 75% 60% at 38% 42%, rgba(255,255,255,0.42), rgba(255,255,255,0) 72%), ${softCylinderShade}`,
      };
    case "mist":
      return {
        image: `${mistClouds}, radial-gradient(ellipse 75% 60% at 38% 42%, rgba(255,255,255,0.3), rgba(255,255,255,0) 72%), ${softCylinderShade}`,
        size: "48px 36px, 100% 100%, 100% 100%",
      };
    case "mercury":
      return {
        image:
          "linear-gradient(90deg, #4c525c 0%, #8a919c 9%, #f4f6fa 24%, #a3aab5 38%, #6f7682 52%, #d9dde4 68%, #fafbfd 76%, #8d939e 88%, #474c55 100%)",
      };
  }
}

/** 液1帯の地の描き方。同じ色が続く帯は1つにまとめて描くので、模様は帯の中で途切れない。 */
export function getElixirStyle(colorIndex: number): CSSProperties {
  const { color, nature } = getElixir(colorIndex);
  const { image, size } = getNatureLayers(nature);
  return {
    backgroundColor: color,
    backgroundImage: image,
    ...(size === undefined ? {} : { backgroundSize: size }),
  };
}

/** 帯の上の液面と、下の境の陰。元素は交わらないので、色の境ははっきり分かれる。 */
export function getElixirSurfaceShadow(colorIndex: number): string {
  const { nature } = getElixir(colorIndex);
  if (nature === "mercury") {
    return "inset 0 2px 1px rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.45)";
  }
  return "inset 0 1.5px 0 rgba(255,255,255,0.5), inset 0 2.5px 2px rgba(255,255,255,0.12), inset 0 -1px 0 rgba(0,0,0,0.4)";
}
