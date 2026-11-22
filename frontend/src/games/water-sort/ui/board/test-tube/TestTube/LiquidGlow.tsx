import type { WaterSortBottle } from "@/games/water-sort/puzzle/state";
import { getLiquidRuns } from "@/games/water-sort/ui/board/test-tube/liquid-runs";
import { getReagentGlowColor } from "@/games/water-sort/ui/board/test-tube/reagent";
import { LIQUID_BOX_STYLE } from "@/games/water-sort/ui/board/test-tube/test-tube-geometry";

type LiquidGlowProps = {
  contents: WaterSortBottle;
};

/** 蛍光の液が、ガラスの向こうの地ににじませる光。液の段の高さに合わせ、管の外へ広げる。 */
export function LiquidGlow({ contents }: LiquidGlowProps) {
  const glows = getLiquidRuns(contents).flatMap((run) => {
    const color = getReagentGlowColor(run.colorIndex);
    return color ? [{ ...run, color }] : [];
  });
  if (glows.length === 0) {
    return null;
  }
  return (
    <span
      data-liquid-glow=""
      className="pointer-events-none absolute"
      style={LIQUID_BOX_STYLE}
    >
      {glows.map((glow) => (
        <span
          key={`${glow.startSlot}-${glow.colorIndex}`}
          className="absolute -inset-x-[38%] rounded-[40%] opacity-80 blur-[6px] dark:opacity-95"
          style={{
            bottom: `${glow.startSlot * 25 - 2}%`,
            height: `${glow.slotCount * 25 + 4}%`,
            backgroundColor: glow.color,
          }}
        />
      ))}
    </span>
  );
}
