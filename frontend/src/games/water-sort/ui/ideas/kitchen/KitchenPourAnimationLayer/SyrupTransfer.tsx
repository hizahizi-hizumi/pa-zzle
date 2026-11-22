import { useEffect, useRef } from "react";

import {
  KITCHEN_POUR_DURATION_MS,
  KITCHEN_POUR_TRANSFER_END,
  KITCHEN_POUR_TRANSFER_START,
} from "@/games/water-sort/ui/ideas/kitchen/kitchen-pour-timing";
import {
  getKitchenSyrup,
  getSyrupStyle,
} from "@/games/water-sort/ui/ideas/kitchen/kitchen-syrups";

/** とろみのある液は、注ぎ始めはゆっくり、落ちきる前にまたゆっくり動く。 */
const SYRUP_FLOW_EASING = "cubic-bezier(.45,.05,.4,1)";

type SyrupTransferProps = {
  colorIndex: number;
  startSlot: number;
  slotCount: number;
  /** `drain` は注ぎ元から減る液、`fill` は注ぎ先にたまる液。 */
  flow: "drain" | "fill";
};

export function SyrupTransfer({
  colorIndex,
  startSlot,
  slotCount,
  flow,
}: SyrupTransferProps) {
  const liquidRef = useRef<HTMLSpanElement>(null);
  const moundRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const timing = {
      duration: KITCHEN_POUR_DURATION_MS,
      fill: "forwards" as const,
    };
    const full = "inset(0% 0 0 0)";
    const empty = "inset(100% 0 0 0)";
    const [before, after] = flow === "drain" ? [full, empty] : [empty, full];
    const liquidAnimation = liquidRef.current?.animate?.(
      [
        { clipPath: before, offset: 0 },
        {
          clipPath: before,
          offset: KITCHEN_POUR_TRANSFER_START,
          easing: SYRUP_FLOW_EASING,
        },
        { clipPath: after, offset: KITCHEN_POUR_TRANSFER_END },
        { clipPath: after, offset: 1 },
      ],
      timing,
    );
    // 落ちた液は筋の当たる所に盛り上がり、瓶の幅へゆっくり広がって平らになる。
    const startBottom = `${startSlot * 25}%`;
    const endBottom = `${(startSlot + slotCount) * 25}%`;
    const moundAnimation = moundRef.current?.animate?.(
      [
        {
          bottom: startBottom,
          width: "24%",
          height: "0%",
          opacity: 0,
          offset: 0,
        },
        {
          bottom: startBottom,
          width: "24%",
          height: "0%",
          opacity: 0,
          offset: KITCHEN_POUR_TRANSFER_START - 0.02,
        },
        {
          bottom: startBottom,
          width: "46%",
          height: "9%",
          opacity: 1,
          offset: KITCHEN_POUR_TRANSFER_START + 0.06,
          easing: SYRUP_FLOW_EASING,
        },
        {
          bottom: endBottom,
          width: "92%",
          height: "7%",
          opacity: 1,
          offset: KITCHEN_POUR_TRANSFER_END,
        },
        {
          bottom: endBottom,
          width: "130%",
          height: "1%",
          opacity: 0,
          offset: Math.min(1, KITCHEN_POUR_TRANSFER_END + 0.12),
        },
        {
          bottom: endBottom,
          width: "130%",
          height: "1%",
          opacity: 0,
          offset: 1,
        },
      ],
      timing,
    );

    return () => {
      liquidAnimation?.cancel();
      moundAnimation?.cancel();
    };
  }, [flow, startSlot, slotCount]);

  const { light, base } = getKitchenSyrup(colorIndex);

  return (
    <>
      <span
        ref={liquidRef}
        className="absolute inset-x-0"
        style={{
          bottom: `${startSlot * 25}%`,
          height: `calc(${slotCount * 25}% + 1px)`,
          ...getSyrupStyle(colorIndex),
          clipPath: flow === "drain" ? "inset(0% 0 0 0)" : "inset(100% 0 0 0)",
        }}
      />
      {flow === "fill" && (
        <span
          ref={moundRef}
          className="absolute left-1/2 -translate-x-1/2 translate-y-1/2 rounded-[50%] opacity-0"
          style={{
            bottom: `${startSlot * 25}%`,
            background: `radial-gradient(ellipse at 45% 40%, ${light} 0%, ${base} 60%, ${base} 100%)`,
          }}
        />
      )}
    </>
  );
}
