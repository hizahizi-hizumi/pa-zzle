import { useLayoutEffect, useRef, useState } from "react";

import type { WaterBottleProps } from "@/games/water-sort/ui/ideas/overrides";
import { getSummerBottleShape } from "@/games/water-sort/ui/ideas/summer/bottle-shapes";
import { SummerBottle } from "@/games/water-sort/ui/ideas/summer/SummerBottle";

export function SummerWaterBottle({
  contents,
  selected = false,
  waterOverlay,
  role = "board",
  concealed = false,
}: WaterBottleProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [bottleIndex, setBottleIndex] = useState(0);

  // 瓶ごとに形を変えたいが、ボトルの番号は渡されないので、盤面のボタンの並びから読む。
  useLayoutEffect(() => {
    const button = anchorRef.current?.closest("button");
    const siblings = button?.parentElement?.children;
    if (!button || !siblings) {
      return;
    }
    const index = Array.prototype.indexOf.call(siblings, button);
    if (index >= 0) {
      setBottleIndex(index);
    }
  }, []);

  return (
    <span ref={anchorRef} className="absolute inset-0">
      <SummerBottle
        contents={contents}
        shape={getSummerBottleShape(bottleIndex)}
        role={role}
        selected={selected}
        concealed={concealed}
        overlay={waterOverlay}
      />
    </span>
  );
}
