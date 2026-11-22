import type { CSSProperties } from "react";

/**
 * 試薬の見え方。色覚の違いで色が近づく組は、見え方か明るさが違うように割り当てる。
 * - `clear`: 澄んだ水溶液。円筒の液が光を集めて、片側に明るい筋が立つ。
 * - `deep`: 色の濃い水溶液。光をほとんど通さず、暗い液の縁にだけ色が透ける。
 * - `glow`: 蛍光を出す水溶液。昼の光の下でも内側から光り、管のまわりに光がにじむ。
 * - `milky`: 白く濁った液。光の筋が立たず、濁りの雲が見え、底ほど濃い。
 * - `sparkle`: 細かな結晶が舞う液。金色の雨のように、きらめく粒が見える。
 */
export type ReagentLook = "clear" | "deep" | "glow" | "milky" | "sparkle";

type Reagent = {
  name: string;
  color: string;
  look: ReagentLook;
};

// 並びは色番号（0〜11）。
const reagents: readonly Reagent[] = [
  // 赤: チオシアン酸鉄(III)の血の色
  { name: "赤", color: "#961028", look: "deep" },
  // 青: テトラアンミン銅(II)の澄んだ青
  { name: "青", color: "#2e5be0", look: "clear" },
  // 緑: BTB 溶液（中性）の緑
  { name: "緑", color: "#1f8540", look: "clear" },
  // 黄: ヨウ化鉛(II)の金色の雨
  { name: "黄", color: "#f1c419", look: "sparkle" },
  // 紫: 過マンガン酸カリウムの赤紫
  { name: "紫", color: "#5c1475", look: "deep" },
  // 橙: 二クロム酸カリウムの橙
  { name: "橙", color: "#f98a2c", look: "clear" },
  // 水色: 硫酸銅(II)の空色
  { name: "水色", color: "#5fbfea", look: "clear" },
  // 桃: フェノールフタレイン（アルカリ性）の赤紫がかった桃
  { name: "桃", color: "#d6388a", look: "clear" },
  // 黄緑: フルオレセインの蛍光の黄緑
  { name: "黄緑", color: "#b5dc2c", look: "glow" },
  // 薄紫: 紫キャベツ液の濁った藤色
  { name: "薄紫", color: "#ad96dc", look: "milky" },
  // 薄い灰: 白く濁った石灰水
  { name: "薄い灰", color: "#d9dcd8", look: "milky" },
  // 青緑: 塩化銅(II)の濃い青緑
  { name: "青緑", color: "#0b605e", look: "deep" },
];

function getReagent(colorIndex: number): Reagent {
  return (
    reagents[colorIndex] ?? {
      name: `色 ${colorIndex + 1}`,
      color: "#8a8f94",
      look: "clear",
    }
  );
}

export function getReagentName(colorIndex: number): string {
  return getReagent(colorIndex).name;
}

export function getReagentLook(colorIndex: number): ReagentLook {
  return getReagent(colorIndex).look;
}

function mix(color: string, other: string, percent: number): string {
  return `color-mix(in oklab, ${color}, ${other} ${percent}%)`;
}

function svgImage(svg: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

// 濁りの雲。ラスター画像を使わず、SVG のノイズで描く。繰り返しの継ぎ目が段の境目に見えないよう、端をつなげる。
const turbidityImage = svgImage(
  "<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48'><filter id='n' x='0' y='0' width='1' height='1'><feTurbulence type='fractalNoise' baseFrequency='0.0625' numOctaves='3' seed='4' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 -2.4 1.55'/></filter><rect width='48' height='48' filter='url(#n)'/></svg>",
);

// 金色の雨の結晶の粒。明るく光る粒と、影になった粒を散らす。
const sparkleImage = svgImage(
  "<svg xmlns='http://www.w3.org/2000/svg' width='30' height='34'>" +
    "<g fill='#fffbe0'>" +
    "<rect x='4' y='3' width='2.6' height='1.3' rx='0.5' transform='rotate(-25 5 4)'/>" +
    "<rect x='19' y='9' width='2.2' height='1.2' rx='0.5' transform='rotate(30 20 10)'/>" +
    "<rect x='9' y='17' width='2.8' height='1.3' rx='0.5' transform='rotate(12 10 18)'/>" +
    "<rect x='23' y='24' width='2.4' height='1.2' rx='0.5' transform='rotate(-40 24 25)'/>" +
    "<rect x='3' y='28' width='2' height='1.1' rx='0.5' transform='rotate(35 4 29)'/>" +
    "<rect x='14' y='30' width='1.6' height='1' rx='0.4'/>" +
    "</g><g fill='#8a5a00' fill-opacity='0.75'>" +
    "<rect x='12' y='6' width='2.2' height='1.1' rx='0.4' transform='rotate(20 13 7)'/>" +
    "<rect x='26' y='15' width='2' height='1' rx='0.4' transform='rotate(-20 27 16)'/>" +
    "<rect x='3' y='12' width='1.8' height='1' rx='0.4' transform='rotate(50 4 13)'/>" +
    "<rect x='17' y='22' width='2.2' height='1.1' rx='0.4' transform='rotate(-15 18 23)'/>" +
    "<rect x='8' y='24' width='1.6' height='0.9' rx='0.4'/>" +
    "</g></svg>",
);

/** 液の塊の塗り。管の左右の縁ほど液の層が厚く見えるので、縁を暗く、光の来る側に筋を立てる。 */
export function getReagentFill(colorIndex: number): CSSProperties {
  const { color, look } = getReagent(colorIndex);
  switch (look) {
    case "clear":
      return {
        backgroundImage: `linear-gradient(90deg, ${mix(color, "black", 38)} 0%, ${mix(color, "black", 8)} 14%, ${mix(color, "white", 14)} 34%, ${color} 56%, ${mix(color, "white", 46)} 72%, ${mix(color, "white", 10)} 80%, ${mix(color, "black", 30)} 100%)`,
      };
    case "deep":
      return {
        backgroundImage: `linear-gradient(90deg, ${mix(color, "black", 62)} 0%, ${mix(color, "black", 24)} 16%, ${color} 36%, ${mix(color, "white", 6)} 52%, ${mix(color, "black", 12)} 66%, ${mix(color, "white", 30)} 74%, ${mix(color, "black", 22)} 81%, ${mix(color, "black", 60)} 100%)`,
      };
    case "glow":
      return {
        backgroundImage: `linear-gradient(90deg, ${mix(color, "#3d6b00", 30)} 0%, ${mix(color, "#fbffd0", 20)} 16%, ${mix(color, "#fdffe6", 62)} 50%, ${mix(color, "#fbffd0", 20)} 80%, ${mix(color, "#3d6b00", 26)} 100%)`,
        boxShadow: `inset 0 0 8px 1px ${mix(color, "#f8ffc0", 55)}`,
      };
    case "milky":
      return {
        backgroundImage: `${turbidityImage}, linear-gradient(180deg, transparent 40%, ${mix(color, "#3a4045", 18)} 100%), linear-gradient(90deg, ${mix(color, "#3a4045", 34)} 0%, ${mix(color, "white", 8)} 32%, ${mix(color, "white", 14)} 58%, ${mix(color, "#3a4045", 28)} 100%)`,
        backgroundSize: "26px 26px, 100% 100%, 100% 100%",
        backgroundBlendMode: "soft-light, normal, normal",
      };
    case "sparkle":
      return {
        backgroundImage: `${sparkleImage}, linear-gradient(90deg, ${mix(color, "#7a4a00", 42)} 0%, ${mix(color, "#7a4a00", 12)} 16%, ${color} 40%, ${mix(color, "white", 30)} 66%, ${mix(color, "#7a4a00", 10)} 82%, ${mix(color, "#7a4a00", 36)} 100%)`,
        backgroundSize: "15px 17px, 100% 100%",
      };
  }
}

/** 液面の明るさ。白っぽい液ほど、液面の縁の影を濃くして、空の管の明るさと見分ける。 */
export function getReagentSurfaceShade(colorIndex: number): number {
  return getReagent(colorIndex).look === "milky" ? 0.42 : 0.22;
}

/** 蛍光の液が管のまわりににじませる光の色。蛍光でない液は `null`。 */
export function getReagentGlowColor(colorIndex: number): string | null {
  const { color, look } = getReagent(colorIndex);
  return look === "glow" ? mix(color, "#f6ffb8", 35) : null;
}

/** 注ぐ液の筋の塗り。 */
export function getReagentStreamFill(colorIndex: number): CSSProperties {
  const { color, look } = getReagent(colorIndex);
  return {
    backgroundImage: `linear-gradient(90deg, ${mix(color, "black", 25)}, ${mix(color, "white", 40)} 45%, ${color} 70%, ${mix(color, "black", 20)})`,
    opacity: look === "clear" || look === "glow" ? 0.88 : 0.95,
  };
}

/** 試験管立ての板に落ちる、液を透った光の色。 */
export function getReagentCausticColor(colorIndex: number): string {
  const { color, look } = getReagent(colorIndex);
  return look === "milky" || look === "deep"
    ? mix(color, "transparent", 55)
    : mix(color, "white", 20);
}
