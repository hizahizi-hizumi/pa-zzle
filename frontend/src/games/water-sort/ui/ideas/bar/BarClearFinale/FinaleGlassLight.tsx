import type { Ref } from "react";

import { BAR_GLASS } from "@/games/water-sort/ui/ideas/bar/bar-glass-geometry";
import { getBarLiquid } from "@/games/water-sort/ui/ideas/bar/bar-liquids";

type FinaleGlassLightProps = {
  rect: DOMRect;
  colorIndex: number;
  lit: boolean;
  lightRef: Ref<HTMLDivElement>;
};

/** 店の灯りを受けて、グラスの液が内から明るみ、足もとのカウンターに色の光だまりが落ちる。 */
export function FinaleGlassLight({
  rect,
  colorIndex,
  lit,
  lightRef,
}: FinaleGlassLightProps) {
  const { color, core } = getBarLiquid(colorIndex);
  const liquidLeft = rect.left + rect.width * BAR_GLASS.wallInset;
  const liquidWidth = rect.width * (1 - BAR_GLASS.wallInset * 2);
  const liquidTop = rect.top + rect.height * BAR_GLASS.liquidTop;
  const liquidHeight = rect.height * (BAR_GLASS.baseTop - BAR_GLASS.liquidTop);

  return (
    <div
      ref={lightRef}
      className="absolute inset-0 mix-blend-screen"
      style={{ opacity: lit ? 1 : 0 }}
    >
      {/* グラスの上にともる小さな灯りと、そこからグラスへ落ちる光。 */}
      <div
        className="absolute bg-[linear-gradient(180deg,rgba(255,206,150,0.22)_0%,rgba(255,206,150,0.1)_55%,rgba(255,214,166,0)_100%)]"
        style={{
          left: rect.left - rect.width * 0.3,
          top: rect.top - rect.height * 0.32,
          width: rect.width * 1.6,
          height: rect.height * 1.25,
          clipPath: "polygon(44% 0, 56% 0, 100% 100%, 0 100%)",
        }}
      />
      <div
        className="absolute rounded-full bg-[radial-gradient(closest-side,rgba(255,236,200,0.95),rgba(255,190,120,0.35)_45%,transparent)]"
        style={{
          left: rect.left + rect.width * 0.3,
          top: rect.top - rect.height * 0.32 - rect.width * 0.2,
          width: rect.width * 0.4,
          height: rect.width * 0.4,
        }}
      />
      <div
        className="absolute rounded-[50%]"
        style={{
          left: rect.left - rect.width * 0.55,
          top: rect.bottom - rect.height * 0.1,
          width: rect.width * 2.1,
          height: rect.height * 0.26,
          background: `radial-gradient(closest-side, ${core}cc, ${color}55 50%, transparent)`,
        }}
      />
      <div
        className="absolute"
        style={{
          left: liquidLeft,
          top: liquidTop,
          width: liquidWidth,
          height: liquidHeight,
          background: `radial-gradient(ellipse 80% 70% at 50% 100%, ${core}88, ${core}22 60%, transparent), linear-gradient(90deg, transparent, ${core}33 45%, transparent)`,
          boxShadow: `0 0 ${Math.round(rect.width * 0.4)}px ${color}66`,
        }}
      />
      <div
        className="absolute rounded-full bg-[radial-gradient(closest-side,rgba(255,250,235,0.95),rgba(255,220,170,0.35)_45%,transparent)]"
        style={{
          left: rect.left + rect.width * 0.08,
          top: rect.top - rect.width * 0.18,
          width: rect.width * 0.36,
          height: rect.width * 0.36,
        }}
      />
    </div>
  );
}
