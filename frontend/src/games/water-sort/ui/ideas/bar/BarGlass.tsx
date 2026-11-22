import { BarGlassBase } from "@/games/water-sort/ui/ideas/bar/BarGlass/BarGlassBase";
import { BarLiquid } from "@/games/water-sort/ui/ideas/bar/BarGlass/BarLiquid";
import {
  BAR_GLASS,
  isCompletedGlass,
} from "@/games/water-sort/ui/ideas/bar/bar-glass-geometry";
import { IceCube } from "@/games/water-sort/ui/ideas/bar/IceCube";
import type { WaterBottleProps } from "@/games/water-sort/ui/ideas/overrides";
import { cn } from "@/lib/utils";

/** 細長いコリンズグラスの角の丸み。横は幅に、縦は高さに対する割合。 */
export const BAR_GLASS_RADIUS = "0 0 16% 16% / 0 0 4.5% 4.5%";

/** 厚い底の細長いグラス。そろうと氷がひとつ浮かぶ。 */
export function BarGlass({
  contents,
  selected = false,
  waterOverlay,
}: WaterBottleProps) {
  const completed = isCompletedGlass(contents);

  return (
    <span
      aria-hidden="true"
      className={cn(
        "absolute inset-0 transition-[filter] duration-(--duration-normal)",
        selected && "drop-shadow-[0_0_7px_rgba(255,186,112,0.45)]",
      )}
    >
      {/* グラスの奥の面。暗い店の中でわずかに光を拾う。 */}
      <span
        className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,236,214,0.1),rgba(255,236,214,0.025)_30%,rgba(255,236,214,0.02)_70%,rgba(255,236,214,0.08))]"
        style={{ borderRadius: BAR_GLASS_RADIUS }}
      />
      <span
        className="absolute overflow-hidden"
        style={{
          left: `${BAR_GLASS.wallInset * 100}%`,
          right: `${BAR_GLASS.wallInset * 100}%`,
          top: `${BAR_GLASS.liquidTop * 100}%`,
          bottom: `${(1 - BAR_GLASS.baseTop) * 100}%`,
        }}
      >
        <BarLiquid contents={contents} />
        {waterOverlay}
      </span>
      {completed && contents[0] !== undefined && <IceCube />}
      <BarGlassBase bottomColorIndex={contents[0]} />
      {/* 側面のガラス。持つと店の灯りを受けて縁が明るむ。 */}
      <span
        className={cn(
          "absolute inset-0 border border-t-0 transition-[border-color] duration-(--duration-normal)",
          selected ? "border-[#ffd7a6]/85" : "border-[#ffe9d0]/30",
        )}
        style={{ borderRadius: BAR_GLASS_RADIUS }}
      />
      <span className="absolute top-[3%] bottom-[13%] left-[14%] w-[7%] rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0),rgba(255,250,240,0.34)_18%,rgba(255,250,240,0.12)_70%,rgba(255,255,255,0))]" />
      <span className="absolute top-[5%] right-[10%] bottom-[16%] w-[2.5%] rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0),rgba(255,240,220,0.2)_30%,rgba(255,255,255,0))]" />
      {/* 口の縁。 */}
      <span
        className={cn(
          "absolute inset-x-0 top-[-1.6%] h-[3.2%] rounded-[50%] border transition-[border-color] duration-(--duration-normal)",
          selected ? "border-[#ffe2bd]/90" : "border-[#ffeedd]/45",
        )}
      />
    </span>
  );
}
