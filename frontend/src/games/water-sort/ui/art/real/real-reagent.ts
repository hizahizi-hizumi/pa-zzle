import type { CSSProperties } from "react";

import { cssImage } from "@/games/water-sort/ui/art/real/real-texture";

/**
 * 試薬の液の見え方。光は左上の奥の窓から来て、液の円柱を後ろから透る。
 * - `clear`: 澄んだ液。円柱がレンズになって窓の像が左右入れ替わり、中心より右に明るい帯が立つ。縁は屈折で暗い。
 * - `deep`: 色の濃い液。光をほとんど通さず、右の帯だけが暗く色づく。
 * - `glow`: 蛍光の液。液自体が光るので縁ほど明るく、縁が暗くならない。
 * - `milky`: 濁った液。光を散らすので窓の帯が立たず、光の来る左ほど明るく、縁も暗くならない。
 * - `sparkle`: 結晶が舞う液。澄んだ液の中で、細かな板状の結晶が光をはね返してきらめく。
 */
export type RealReagentLook = "clear" | "deep" | "glow" | "milky" | "sparkle";

type RealReagent = {
  color: string;
  look: RealReagentLook;
};

// 並びは色番号（0〜11）。色覚の違いで色差が近づく組（黄/黄緑・水色/薄紫・橙/黄緑・黄/橙）は、見え方を変える。
const reagents: readonly RealReagent[] = [
  { color: "#9a1229", look: "deep" },
  { color: "#2e5be0", look: "clear" },
  { color: "#1f8540", look: "clear" },
  { color: "#f1c419", look: "sparkle" },
  { color: "#5c1475", look: "deep" },
  { color: "#f98a2c", look: "clear" },
  { color: "#5fbfea", look: "clear" },
  { color: "#d6388a", look: "clear" },
  { color: "#b5dc2c", look: "glow" },
  { color: "#ad96dc", look: "milky" },
  { color: "#d9dcd8", look: "milky" },
  { color: "#0b605e", look: "deep" },
];

function getReagent(colorIndex: number): RealReagent {
  return reagents[colorIndex] ?? { color: "#8a8f94", look: "clear" };
}

export function getRealReagentLook(colorIndex: number): RealReagentLook {
  return getReagent(colorIndex).look;
}

function mix(color: string, other: string, percent: number): string {
  return `color-mix(in oklab, ${color}, ${other} ${percent}%)`;
}

function toDataUri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// 濁りの雲。液の中の大きな濃淡なので、表面のざらつきより粗い。
const turbidityImage = cssImage(
  toDataUri(
    "<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><filter id='n' x='0' y='0' width='1' height='1' color-interpolation-filters='sRGB'><feTurbulence type='fractalNoise' baseFrequency='0.07' numOctaves='2' seed='4' stitchTiles='stitch'/><feColorMatrix values='1.4 0 0 0 -0.2  1.4 0 0 0 -0.2  1.4 0 0 0 -0.2  0 0 0 0 1'/></filter><rect width='64' height='64' filter='url(#n)'/></svg>",
  ),
);

// 結晶のきらめき。光をはね返した板状の結晶（明るい点）と、光の当たらない向きの結晶（かすかに暗い点）。画面の px で並べる。
const crystalImage = cssImage(
  toDataUri(
    "<svg xmlns='http://www.w3.org/2000/svg' width='13' height='15'>" +
      "<g fill='#fffef4'>" +
      "<circle cx='2.5' cy='2.5' r='0.6'/><circle cx='9.5' cy='5.5' r='0.5'/><circle cx='5.5' cy='10.5' r='0.6'/><circle cx='11' cy='13' r='0.45'/>" +
      "</g><g fill='#fff6cc' fill-opacity='0.75'>" +
      "<circle cx='7' cy='1.5' r='0.35'/><circle cx='1' cy='7.5' r='0.35'/><circle cx='12' cy='9' r='0.3'/><circle cx='8.5' cy='13.5' r='0.3'/><circle cx='4' cy='14' r='0.3'/>" +
      "</g><g fill='#7a4c00' fill-opacity='0.25'>" +
      "<circle cx='4.5' cy='6' r='0.45'/><circle cx='10.5' cy='1' r='0.4'/><circle cx='2' cy='12' r='0.4'/>" +
      "</g></svg>",
  ),
);

/** 管の内側の幅に掛ける、液の塊の塗り。立てた液・傾けた液・注ぎ先へ入る液に同じ塗りを使う。 */
export function getRealReagentFill(colorIndex: number): CSSProperties {
  const { color: c, look } = getReagent(colorIndex);
  switch (look) {
    case "clear":
      return {
        backgroundImage: `linear-gradient(90deg, ${mix(c, "black", 58)} 0%, ${mix(c, "black", 26)} 6%, ${mix(c, "black", 8)} 20%, ${c} 40%, ${mix(c, "white", 26)} 56%, ${mix(c, "white", 42)} 62%, ${mix(c, "white", 18)} 70%, ${c} 80%, ${mix(c, "black", 28)} 93%, ${mix(c, "black", 60)} 100%)`,
      };
    case "deep":
      return {
        backgroundImage: `linear-gradient(90deg, ${mix(c, "black", 66)} 0%, ${mix(c, "black", 38)} 8%, ${mix(c, "black", 18)} 30%, ${mix(c, "black", 6)} 50%, ${mix(c, "white", 14)} 61%, ${mix(c, "black", 4)} 70%, ${mix(c, "black", 32)} 90%, ${mix(c, "black", 66)} 100%)`,
      };
    case "glow":
      return {
        backgroundImage: `linear-gradient(90deg, ${mix(c, "#fdffe4", 82)} 0%, ${mix(c, "#f8ffc4", 56)} 5%, ${mix(c, "#f4ffb0", 24)} 16%, ${mix(c, "#f4ffb0", 8)} 38%, ${mix(c, "#fdffe0", 40)} 61%, ${mix(c, "#f4ffb0", 10)} 76%, ${mix(c, "#f4ffb0", 34)} 89%, ${mix(c, "#f8ffc4", 58)} 95%, ${mix(c, "#fdffe4", 80)} 100%)`,
      };
    case "milky":
      return {
        backgroundImage: `${turbidityImage}, linear-gradient(90deg, ${mix(c, "#3a4045", 20)} 0%, ${mix(c, "white", 26)} 9%, ${mix(c, "white", 18)} 32%, ${mix(c, "white", 6)} 62%, ${mix(c, "#3a4045", 10)} 88%, ${mix(c, "#3a4045", 26)} 100%)`,
        backgroundSize: "64px 64px, 100% 100%",
        backgroundBlendMode: "soft-light, normal",
      };
    case "sparkle":
      return {
        backgroundImage: `${crystalImage}, linear-gradient(90deg, ${mix(c, "#5a3200", 52)} 0%, ${mix(c, "#7a4a00", 22)} 7%, ${mix(c, "#7a4a00", 6)} 22%, ${c} 42%, ${mix(c, "white", 30)} 58%, ${mix(c, "white", 40)} 63%, ${mix(c, "white", 14)} 72%, ${mix(c, "#7a4a00", 6)} 84%, ${mix(c, "#5a3200", 50)} 100%)`,
        backgroundSize: "13px 15px, 100% 100%",
      };
  }
}

/** 液面の縁の暗い線（ガラスに接するメニスカス）の濃さ。白っぽい液ほど濃くして、空の管と見分ける。 */
export function getRealReagentSurfaceShade(colorIndex: number): number {
  return getReagent(colorIndex).look === "milky" ? 0.44 : 0.3;
}

/** 注ぐ液の細い流れ。左の縁につやが立ち、窓の光が透って中心より右が明るい。 */
export function getRealReagentStreamFill(colorIndex: number): CSSProperties {
  const { color: c, look } = getReagent(colorIndex);
  if (look === "milky") {
    return {
      backgroundImage: `linear-gradient(90deg, ${mix(c, "#3a4045", 30)}, ${mix(c, "white", 40)} 24%, ${mix(c, "white", 12)} 55%, ${mix(c, "#3a4045", 26)})`,
    };
  }
  const darkness = look === "deep" ? 50 : 30;
  return {
    backgroundImage: `linear-gradient(90deg, ${mix(c, "black", darkness + 15)}, ${mix(c, "white", 62)} 20%, ${mix(c, "black", darkness / 3)} 40%, ${mix(c, "white", look === "deep" ? 10 : 30)} 66%, ${mix(c, "black", darkness)})`,
    opacity: look === "deep" ? 0.97 : 0.92,
  };
}

/** 液を透った光が、手前の木や天板に落とす色と強さ（0〜1）。濃い液と濁った液はあまり通さない。 */
export function getRealReagentCaustic(colorIndex: number): {
  color: string;
  strength: number;
} {
  const { color: c, look } = getReagent(colorIndex);
  switch (look) {
    case "deep":
      return { color: mix(c, "white", 10), strength: 0.35 };
    case "milky":
      return { color: mix(c, "white", 30), strength: 0.4 };
    case "glow":
      return { color: mix(c, "#f4ffb0", 30), strength: 0.95 };
    default:
      return { color: mix(c, "white", 22), strength: 0.8 };
  }
}
