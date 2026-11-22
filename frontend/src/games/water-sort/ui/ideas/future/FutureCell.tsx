import { useLayoutEffect, useRef } from "react";
import { CellFluid } from "@/games/water-sort/ui/ideas/future/FutureCell/CellFluid";
import { CellHousing } from "@/games/water-sort/ui/ideas/future/FutureCell/CellHousing";
import {
  CELL_FLUID,
  CELL_TUBE,
  toBoxPercent,
} from "@/games/water-sort/ui/ideas/future/future-cell-geometry";
import {
  getFutureFluidView,
  getLockedColorIndex,
} from "@/games/water-sort/ui/ideas/future/future-palette";
import type { WaterBottleProps } from "@/games/water-sort/ui/ideas/overrides";
import { prefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

const LOCK_PULSE_MS = 900;

/** 端子のついた透明な収容管。1本そろうと口が閉じてロックし、液が安定した光を放つ。 */
export function FutureCell({
  contents,
  selected = false,
  waterOverlay,
  role = "board",
  concealed = false,
}: WaterBottleProps) {
  const lockedColorIndex = getLockedColorIndex(contents);
  const locked = lockedColorIndex !== null;
  const lockGlow =
    lockedColorIndex === null
      ? undefined
      : getFutureFluidView(lockedColorIndex).base;
  const scanRef = useRef<HTMLSpanElement>(null);
  const haloRef = useRef<HTMLSpanElement>(null);
  const wasLockedRef = useRef(locked);
  const lockPendingRef = useRef(false);

  // ロックした瞬間は、注ぐ演出が盤面の管を隠している間に来るので、姿を戻したときに光らせる。
  useLayoutEffect(() => {
    if (locked && !wasLockedRef.current && role === "board") {
      lockPendingRef.current = true;
    }
    if (!locked) {
      lockPendingRef.current = false;
    }
    wasLockedRef.current = locked;
    if (!lockPendingRef.current || concealed) {
      return;
    }
    lockPendingRef.current = false;
    if (prefersReducedMotion()) {
      return;
    }
    scanRef.current?.animate?.(
      [
        { transform: "translateY(0%)", opacity: 0 },
        { transform: "translateY(-30%)", opacity: 1, offset: 0.15 },
        { transform: "translateY(-330%)", opacity: 0.9, offset: 0.6 },
        { transform: "translateY(-400%)", opacity: 0 },
      ],
      { duration: LOCK_PULSE_MS * 0.7, easing: "cubic-bezier(.3,.1,.3,1)" },
    );
    haloRef.current?.animate?.(
      [
        { opacity: 0.35, transform: "scale(0.96)" },
        { opacity: 1, transform: "scale(1.06)", offset: 0.45 },
        { opacity: 0.75, transform: "scale(1)" },
      ],
      { duration: LOCK_PULSE_MS, easing: "cubic-bezier(.2,.7,.3,1)" },
    );
  }, [locked, concealed, role]);

  return (
    <span aria-hidden="true" className="absolute inset-0">
      <span
        ref={haloRef}
        className={cn(
          "absolute rounded-[3px] transition-opacity duration-500",
          locked ? "opacity-75" : "opacity-0",
        )}
        style={{
          left: toBoxPercent(CELL_FLUID.left, "x"),
          right: toBoxPercent(CELL_FLUID.right, "x", "end"),
          top: toBoxPercent(CELL_FLUID.top, "y"),
          bottom: toBoxPercent(CELL_FLUID.bottom, "y", "end"),
          boxShadow: lockGlow
            ? `0 0 10px 1px color-mix(in oklab, ${lockGlow} 55%, transparent), 0 0 26px 4px color-mix(in oklab, ${lockGlow} 22%, transparent)`
            : undefined,
        }}
      />
      <span
        className="absolute rounded-b-[4px] rounded-t-[1px]"
        style={{
          left: toBoxPercent(CELL_TUBE.left, "x"),
          right: toBoxPercent(CELL_TUBE.right, "x", "end"),
          top: toBoxPercent(CELL_TUBE.top, "y"),
          bottom: toBoxPercent(CELL_TUBE.bottom, "y", "end"),
          background:
            "linear-gradient(90deg, rgba(150,196,214,0.13), rgba(150,196,214,0.035) 26%, rgba(150,196,214,0.02) 70%, rgba(150,196,214,0.11)), rgba(3,8,12,0.62)",
        }}
      />
      <span
        className="absolute overflow-hidden rounded-b-[2px]"
        style={{
          left: toBoxPercent(CELL_FLUID.left, "x"),
          right: toBoxPercent(CELL_FLUID.right, "x", "end"),
          top: toBoxPercent(CELL_FLUID.top, "y"),
          bottom: toBoxPercent(CELL_FLUID.bottom, "y", "end"),
        }}
      >
        <CellFluid
          contents={contents}
          locked={locked}
          showsSurface={waterOverlay === undefined}
        />
        {waterOverlay}
        <span
          className={cn(
            "absolute inset-y-0 left-0 w-px bg-[#c9f1ff] shadow-[0_0_4px_1px_rgba(170,230,255,0.55)] transition-opacity duration-200",
            selected ? "opacity-70" : "opacity-0",
          )}
        />
        <span
          className={cn(
            "absolute inset-y-0 right-0 w-px bg-[#c9f1ff] shadow-[0_0_4px_1px_rgba(170,230,255,0.55)] transition-opacity duration-200",
            selected ? "opacity-70" : "opacity-0",
          )}
        />
        <span
          ref={scanRef}
          className="absolute inset-x-0 bottom-0 h-1/4 opacity-0"
          style={{
            background: lockGlow
              ? `linear-gradient(180deg, transparent, color-mix(in oklab, ${lockGlow} 30%, #ffffff) 55%, transparent)`
              : undefined,
            mixBlendMode: "screen",
          }}
        />
      </span>
      <CellHousing selected={selected} lockGlow={lockGlow} />
    </span>
  );
}
