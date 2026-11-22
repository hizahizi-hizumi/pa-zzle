import { useRef } from "react";
import {
  getFutureFluidView,
  getLockedColorIndex,
} from "@/games/water-sort/ui/ideas/future/future-palette";
import { useCellDocks } from "@/games/water-sort/ui/ideas/future/use-cell-docks";
import type { BoardBackdropProps } from "@/games/water-sort/ui/ideas/overrides";

/** 管の端子を受ける、削り出しの収容レール。ロックした管の下には、その液の光が金属に落ちる。 */
export function FutureBackdrop({
  state,
  getBottleElements,
}: BoardBackdropProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const rows = useCellDocks(rootRef, getBottleElements, state.length);

  return (
    <div ref={rootRef} className="absolute inset-0">
      {rows.map((row) => {
        const railHeight = Math.max(7, row.cellHeight * 0.075);
        const padding = Math.max(8, row.cells[0]?.width ?? 0) * 0.32;
        const railTop = row.bottom - railHeight * 0.42;
        return (
          <div key={`${row.left}-${row.bottom}`}>
            <div
              className="absolute rounded-[2px]"
              style={{
                left: row.left - padding,
                width: row.right - row.left + padding * 2,
                top: railTop,
                height: railHeight,
                background:
                  "linear-gradient(180deg, #56616c 0%, #2c353d 16%, #1a2027 52%, #0d1115 100%)",
                boxShadow:
                  "0 6px 14px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.14)",
              }}
            >
              <div className="absolute inset-x-[3px] top-[64%] h-px bg-black/55" />
              <div className="absolute inset-x-[3px] top-[calc(64%+1px)] h-px bg-white/[0.06]" />
              <div className="absolute top-1/2 left-[3px] size-[3px] -translate-y-1/2 rounded-full bg-[#6c7782] shadow-[inset_0_-1px_0_rgba(0,0,0,0.6)]" />
              <div className="absolute top-1/2 right-[3px] size-[3px] -translate-y-1/2 rounded-full bg-[#6c7782] shadow-[inset_0_-1px_0_rgba(0,0,0,0.6)]" />
            </div>
            {row.cells.map((cell) => {
              const bottle = state[cell.bottleIndex] ?? [];
              const lockedColorIndex = getLockedColorIndex(bottle);
              const spill =
                lockedColorIndex === null
                  ? undefined
                  : getFutureFluidView(lockedColorIndex).base;
              return (
                <div
                  key={cell.bottleIndex}
                  className="absolute"
                  style={{
                    left: cell.left + cell.width * 0.08,
                    width: cell.width * 0.84,
                    top: railTop,
                    height: railHeight,
                  }}
                >
                  <div
                    className="absolute inset-x-0 top-0 h-[46%] rounded-b-[2px] bg-[#05080b]"
                    style={{
                      boxShadow: "inset 0 -1px 0 rgba(255,255,255,0.08)",
                    }}
                  />
                  <div
                    className="absolute -inset-x-[30%] -top-[160%] h-[260%] transition-opacity duration-700"
                    style={{
                      opacity: spill ? 1 : 0,
                      background: spill
                        ? `radial-gradient(50% 50% at 50% 62%, color-mix(in oklab, ${spill} 34%, transparent), transparent)`
                        : undefined,
                    }}
                  />
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
