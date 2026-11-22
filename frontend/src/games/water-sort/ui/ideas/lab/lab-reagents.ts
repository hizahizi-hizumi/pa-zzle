import type { CSSProperties } from "react";

/**
 * 試薬の見え方。
 * - `clear`: 澄んだ水溶液。円筒の液が光を集めて、片側に明るい筋が立つ。
 * - `deep`: 色の濃い水溶液。光をほとんど通さず、縁にだけ色が透ける。
 * - `glow`: 蛍光を出す水溶液。昼の光の下でも内側から光る。
 * - `milky`: 白く濁った液。光の筋が立たず、濁りの斑が見える。
 */
type ReagentLook = "clear" | "deep" | "glow" | "milky";

type Reagent = {
  color: string;
  look: ReagentLook;
};

// 並びは `get-water-color-view.ts` の色番号（0〜11）。読み上げの色の名前はそちらのまま使う。
const reagents: readonly Reagent[] = [
  // 赤: チオシアン酸鉄(III)の血の色
  { color: "#c4203a", look: "clear" },
  // 青: テトラアンミン銅(II)の深い青
  { color: "#2346c9", look: "deep" },
  // 緑: BTB 溶液（中性）の緑
  { color: "#2a9c45", look: "clear" },
  // 黄: BTB 溶液（酸性）の黄
  { color: "#f1c419", look: "clear" },
  // 紫: 過マンガン酸カリウムの赤紫
  { color: "#6d1a86", look: "deep" },
  // 橙: 二クロム酸カリウムの橙
  { color: "#ec7a12", look: "clear" },
  // 水色: 硫酸銅(II)の空色
  { color: "#5fbfea", look: "clear" },
  // 桃: フェノールフタレイン（アルカリ性）の桃
  { color: "#ea4c9c", look: "clear" },
  // 黄緑: フルオレセインの蛍光の黄緑
  { color: "#b5dc2c", look: "glow" },
  // 薄紫: 紫キャベツ液の濁った藤色
  { color: "#ad96dc", look: "milky" },
  // 薄い灰: 白く濁った石灰水
  { color: "#d9dcd8", look: "milky" },
  // 青緑: 塩化銅(II)の青緑
  { color: "#14978f", look: "clear" },
];

const fallbackReagent: Reagent = { color: "#8a8f94", look: "clear" };

function getReagent(colorIndex: number): Reagent {
  return reagents[colorIndex] ?? fallbackReagent;
}

export function getReagentColor(colorIndex: number): string {
  return getReagent(colorIndex).color;
}

function mix(color: string, other: string, percent: number): string {
  return `color-mix(in oklab, ${color}, ${other} ${percent}%)`;
}

// 濁りの斑。ラスター画像を使わず、SVG のノイズで描く。
const turbidityImage = `url("data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.09' numOctaves='3' seed='4'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 -1.6 1.25'/></filter><rect width='60' height='60' filter='url(#n)'/></svg>",
)}")`;

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
        backgroundImage: `linear-gradient(90deg, ${mix(color, "black", 55)} 0%, ${mix(color, "black", 22)} 16%, ${color} 40%, ${mix(color, "black", 12)} 62%, ${mix(color, "white", 26)} 74%, ${mix(color, "black", 10)} 82%, ${mix(color, "black", 50)} 100%)`,
      };
    case "glow":
      return {
        backgroundImage: `linear-gradient(90deg, ${mix(color, "#3d6b00", 40)} 0%, ${color} 18%, ${mix(color, "#fbffd0", 48)} 50%, ${color} 76%, ${mix(color, "#3d6b00", 34)} 100%)`,
        boxShadow: `inset 0 0 6px ${mix(color, "#f6ffb0", 40)}`,
      };
    case "milky":
      return {
        backgroundImage: `${turbidityImage}, linear-gradient(90deg, ${mix(color, "black", 22)} 0%, ${mix(color, "white", 22)} 30%, ${mix(color, "white", 10)} 62%, ${mix(color, "black", 18)} 100%)`,
        backgroundSize: "30px 30px, 100% 100%",
        backgroundBlendMode: "soft-light, normal",
      };
  }
}

/** 注ぐ液の筋の塗り。 */
export function getReagentStreamFill(colorIndex: number): CSSProperties {
  const { color, look } = getReagent(colorIndex);
  return {
    backgroundImage: `linear-gradient(90deg, ${mix(color, "black", 25)}, ${mix(color, "white", 40)} 45%, ${color} 70%, ${mix(color, "black", 20)})`,
    opacity: look === "milky" || look === "deep" ? 0.95 : 0.88,
  };
}

/** 試験管立ての板に落ちる、液を透った光の色。 */
export function getReagentCausticColor(colorIndex: number): string {
  const { color, look } = getReagent(colorIndex);
  return look === "milky" || look === "deep"
    ? mix(color, "transparent", 55)
    : mix(color, "white", 20);
}
