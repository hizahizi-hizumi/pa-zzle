import type { CSSProperties } from "react";

/**
 * 液の質感。
 * - `liqueur`: 透きとおったリキュールやシロップ。カウンターの灯りを抜けて中が明るく、縁が深い色に沈む。
 * - `cream`: クリームやミルクを含む、光を通さない柔らかい層。艶を抑える。
 * - `soda`: 炭酸。淡く透けて、細かい泡が浮かぶ。
 */
type LiquidKind = "liqueur" | "cream" | "soda";

type BarLiquid = {
  kind: LiquidKind;
  /** 層の中ほどの色。 */
  color: string;
  /** グラスの縁で沈む色。 */
  edge: string;
  /** 灯りを抜けた芯の色。 */
  core: string;
};

/** 色番号（`get-water-color-view.ts`）ごとの、カウンターに並ぶ材料。読み上げの色の名前は今のまま。 */
const barLiquids: readonly BarLiquid[] = [
  // 赤: グレナデン
  { kind: "liqueur", color: "#c81f3c", edge: "#5e0718", core: "#ff5a6e" },
  // 青: ブルーキュラソー
  { kind: "liqueur", color: "#1f6ee6", edge: "#0a2a74", core: "#5fb0ff" },
  // 緑: ミント
  { kind: "liqueur", color: "#16a352", edge: "#05482a", core: "#5ee59a" },
  // 黄: ガリアーノ
  { kind: "liqueur", color: "#f0c021", edge: "#8a5a05", core: "#fff07a" },
  // 紫: パルフェタムール
  { kind: "liqueur", color: "#8a35cc", edge: "#3a0f63", core: "#c88bff" },
  // 橙: アプリコット
  { kind: "liqueur", color: "#ee7a16", edge: "#7a2c03", core: "#ffb256" },
  // 水色: ソーダ
  { kind: "soda", color: "#8fd9ee", edge: "#3d8eaa", core: "#d9f7ff" },
  // 桃: いちごのクリーム
  { kind: "cream", color: "#ef86b0", edge: "#a24a72", core: "#ffc2da" },
  // 黄緑: メロン
  { kind: "liqueur", color: "#97cf22", edge: "#3e5f05", core: "#dcff6a" },
  // 薄紫: すみれのミルク
  { kind: "cream", color: "#bfa2ee", edge: "#7a5fae", core: "#e6d8ff" },
  // 薄い灰: クリーム
  { kind: "cream", color: "#ebe3d4", edge: "#a69a86", core: "#fffaf0" },
  // 青緑: ブルーとメロンを重ねた青緑のリキュール
  { kind: "liqueur", color: "#0fa39f", edge: "#03504f", core: "#5cf0e4" },
];

export function getBarLiquid(colorIndex: number): BarLiquid {
  return (
    barLiquids[colorIndex] ?? {
      kind: "liqueur",
      color: "#888888",
      edge: "#333333",
      core: "#cccccc",
    }
  );
}

/** 層の上の境目で光が折れて明るみ、下ほど沈む。透きとおった液だけに重ねる。 */
const clearLiquidDepth =
  "linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0) 35%, rgba(0,0,0,0) 65%, rgba(0,0,0,0.14))";

const sodaBubbles = [
  "radial-gradient(circle at 22% 30%, rgba(255,255,255,0.85) 0 1px, transparent 1.6px)",
  "radial-gradient(circle at 64% 70%, rgba(255,255,255,0.7) 0 0.8px, transparent 1.4px)",
  "radial-gradient(circle at 78% 22%, rgba(255,255,255,0.6) 0 0.7px, transparent 1.2px)",
  "radial-gradient(circle at 40% 82%, rgba(255,255,255,0.55) 0 0.6px, transparent 1.1px)",
].join(", ");

/** 円い筒に入った液の層を、横から見た姿で塗る。 */
export function getLiquidStyle(colorIndex: number): CSSProperties {
  const { kind, color, edge, core } = getBarLiquid(colorIndex);
  switch (kind) {
    case "liqueur":
      return {
        backgroundColor: color,
        backgroundImage: `${clearLiquidDepth}, linear-gradient(90deg, ${edge} 0%, ${color} 20%, color-mix(in oklab, ${core} 55%, ${color}) 42%, ${color} 70%, color-mix(in oklab, ${edge} 70%, ${color}) 100%)`,
      };
    case "cream":
      return {
        backgroundColor: color,
        backgroundImage: `linear-gradient(90deg, color-mix(in oklab, ${edge} 80%, ${color}) 0%, ${color} 24%, color-mix(in oklab, ${core} 45%, ${color}) 46%, ${color} 72%, color-mix(in oklab, ${edge} 60%, ${color}) 100%)`,
      };
    case "soda":
      return {
        backgroundColor: color,
        backgroundImage: `${sodaBubbles}, ${clearLiquidDepth}, linear-gradient(90deg, ${edge} 0%, ${color} 22%, color-mix(in oklab, ${core} 55%, ${color}) 42%, ${color} 70%, color-mix(in oklab, ${edge} 70%, ${color}) 100%)`,
        backgroundSize:
          "9px 11px, 7px 9px, 11px 13px, 8px 7px, 100% 100%, 100% 100%",
      };
  }
}

/** 層の上の境目。リキュールとソーダは光る線で、クリームはぼやけた白で、層が重なった姿を見せる。 */
export function getLiquidSurfaceShadow(colorIndex: number): string {
  const { kind } = getBarLiquid(colorIndex);
  return kind === "cream"
    ? "inset 0 2px 2px -1px rgba(255,255,255,0.45)"
    : "inset 0 1px 0 rgba(255,255,255,0.4)";
}
