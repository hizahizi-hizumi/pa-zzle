import { BAR_GLASS } from "@/games/water-sort/ui/ideas/bar/bar-glass-geometry";
import { getBarLiquid } from "@/games/water-sort/ui/ideas/bar/bar-liquids";

type BarGlassBaseProps = {
  bottomColorIndex: number | undefined;
};

/** 厚いガラスの底。いちばん下の層の色が、屈折してうっすら映り込む。 */
export function BarGlassBase({ bottomColorIndex }: BarGlassBaseProps) {
  const tint =
    bottomColorIndex === undefined
      ? null
      : getBarLiquid(bottomColorIndex).color;

  return (
    <span
      className="absolute inset-x-0 bottom-0 overflow-hidden"
      style={{
        top: `${BAR_GLASS.baseTop * 100}%`,
        borderRadius: "0 0 16% 16% / 0 0 40% 40%",
      }}
    >
      {tint && (
        <span
          className="absolute inset-x-[8%] top-0 h-full opacity-45"
          style={{
            background: `linear-gradient(180deg, ${tint}, transparent 85%)`,
          }}
        />
      )}
      <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,244,230,0.26)_0%,rgba(255,244,230,0.06)_30%,rgba(255,244,230,0.08)_75%,rgba(255,244,230,0.36)_100%)]" />
      <span className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,244,230,0.16),transparent_25%,transparent_75%,rgba(255,244,230,0.12))]" />
      <span className="absolute inset-x-[7%] top-0 h-px bg-[#fff3e2]/55" />
    </span>
  );
}
