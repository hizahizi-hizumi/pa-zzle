import { type ReactNode, useLayoutEffect, useRef } from "react";

import type { WaterSortBottle } from "@/games/water-sort/puzzle/state";
import type { WaterBottleRole } from "@/games/water-sort/ui/ideas/overrides";
import type { SummerBottleShape } from "@/games/water-sort/ui/ideas/summer/bottle-shapes";
import { BottleGlass } from "@/games/water-sort/ui/ideas/summer/SummerBottle/BottleGlass";
import { BottleLiquid } from "@/games/water-sort/ui/ideas/summer/SummerBottle/BottleLiquid";
import { FloorShadow } from "@/games/water-sort/ui/ideas/summer/SummerBottle/FloorShadow";
import {
  HOLD_TO_SUN_DURATION_MS,
  holdToSunGlintKeyframes,
  holdToSunKeyframes,
} from "@/games/water-sort/ui/ideas/summer/summer-motion";
import { prefersReducedMotion } from "@/lib/motion";

type SummerBottleProps = {
  contents: WaterSortBottle;
  shape: SummerBottleShape;
  role: WaterBottleRole;
  selected?: boolean;
  concealed?: boolean;
  overlay?: ReactNode;
  continuingColorIndex?: number;
};

const BOTTLE_CAPACITY = 4;

function getCompletedColorIndex(contents: WaterSortBottle): number | null {
  const first = contents[0];
  if (
    first === undefined ||
    contents.length !== BOTTLE_CAPACITY ||
    contents.some((colorIndex) => colorIndex !== first)
  ) {
    return null;
  }
  return first;
}

export function SummerBottle({
  contents,
  shape,
  role,
  selected = false,
  concealed = false,
  overlay,
  continuingColorIndex,
}: SummerBottleProps) {
  const glassRef = useRef<HTMLSpanElement>(null);
  const glintRef = useRef<SVGRectElement>(null);
  const completedColorIndex = getCompletedColorIndex(contents);
  const showsCompletion =
    role === "board" && completedColorIndex !== null && !concealed;
  const previousShowsCompletionRef = useRef(showsCompletion);

  // そろった瓶が盤面に姿を見せた時（注ぐ演出から戻った時）に、陽にかざす。
  useLayoutEffect(() => {
    const appeared = showsCompletion && !previousShowsCompletionRef.current;
    previousShowsCompletionRef.current = showsCompletion;
    const glass = glassRef.current;
    if (!appeared || !glass?.animate || prefersReducedMotion()) {
      return;
    }
    const timing = {
      duration: HOLD_TO_SUN_DURATION_MS,
      easing: "linear",
    };
    const lift = glass.animate(holdToSunKeyframes, timing);
    const glint = glintRef.current?.animate?.(holdToSunGlintKeyframes, timing);
    return () => {
      lift.cancel();
      glint?.cancel();
    };
  }, [showsCompletion]);

  return (
    <span aria-hidden="true" className="absolute inset-0">
      {role !== "pour-source" && (
        <FloorShadow
          completedColorIndex={completedColorIndex}
          lifted={selected}
        />
      )}
      <span
        ref={glassRef}
        data-summer-glass=""
        className="absolute inset-0 origin-bottom"
      >
        <BottleGlass shape={shape} layer="back" />
        <BottleLiquid
          contents={contents}
          overlay={overlay}
          continuingColorIndex={continuingColorIndex}
        />
        <BottleGlass
          shape={shape}
          layer="front"
          selected={selected}
          glintRef={glintRef}
        />
      </span>
    </span>
  );
}
