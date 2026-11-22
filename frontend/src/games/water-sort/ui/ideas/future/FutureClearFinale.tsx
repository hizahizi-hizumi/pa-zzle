import { useEffectEvent, useLayoutEffect, useRef } from "react";

import {
  CELL_FLUID,
  CELL_VIEW_HEIGHT,
  CELL_VIEW_WIDTH,
} from "@/games/water-sort/ui/ideas/future/future-cell-geometry";
import {
  FINALE_DURATION_MS,
  FINALE_SURGE_DURATION_MS,
  FINALE_SURGE_START_MS,
  getCellIgnitions,
  getIgnitionStepMs,
} from "@/games/water-sort/ui/ideas/future/future-finale-timing";
import { getFutureFluidView } from "@/games/water-sort/ui/ideas/future/future-palette";
import { getInstrumentScaleStyle } from "@/games/water-sort/ui/ideas/future/instrument-scale";
import { useCellDocks } from "@/games/water-sort/ui/ideas/future/use-cell-docks";
import type { ClearFinaleProps } from "@/games/water-sort/ui/ideas/overrides";
import { playAnimations } from "@/lib/motion";

const FINALE_LAYER = 6;
const roomScaleStyle = getInstrumentScaleStyle("rgba(190,236,250,0.75)");
const REDUCED_MOTION_HOLD_MS = 500;

/** 全部の管がロックすると装置が起動し、レールを伝って光が管を順に灯し、制御室の全体へ広がる。 */
export function FutureClearFinale({
  state,
  getBottleElements,
  onDone,
}: ClearFinaleProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const rows = useCellDocks(rootRef, getBottleElements, state.length);
  const doneRef = useRef(false);
  const ignitions = getCellIgnitions(state);
  const step = getIgnitionStepMs(state);
  const ready = rows.length > 0;

  function finish() {
    if (doneRef.current) {
      return;
    }
    doneRef.current = true;
    onDone();
  }
  const finishFromAnimation = useEffectEvent(finish);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!ready || !root) {
      return;
    }
    return playAnimations({
      animate() {
        if (typeof root.animate !== "function") {
          return [];
        }
        const animations: Animation[] = [];
        for (const element of root.querySelectorAll<HTMLElement>(
          "[data-finale]",
        )) {
          const delay = Number(element.dataset.delay ?? 0);
          const span = Number(element.dataset.span ?? 0);
          animations.push(
            ...animateFinaleElement(
              element,
              element.dataset.finale,
              delay,
              span,
            ),
          );
        }
        return animations;
      },
      completion: { type: "after-duration", durationMs: FINALE_DURATION_MS },
      reducedMotionHoldMs: REDUCED_MOTION_HOLD_MS,
      unanimatedHoldMs: REDUCED_MOTION_HOLD_MS,
      onFinished: finishFromAnimation,
    });
  }, [ready]);

  return (
    // 起動を見届けずに結果へ進みたいときは、どこを押しても飛ばせる。
    <div
      ref={rootRef}
      aria-hidden="true"
      className="fixed inset-0 cursor-pointer overflow-hidden"
      style={{ zIndex: FINALE_LAYER }}
      onClick={finish}
    >
      <div
        data-finale="glow"
        className="absolute inset-0 opacity-0"
        style={{
          background:
            "radial-gradient(90% 60% at 50% 50%, rgba(150,214,236,0.16), rgba(150,214,236,0) 70%)",
        }}
      />
      <div
        data-finale="surge"
        className="absolute inset-x-0 top-0 h-[34vh] opacity-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(170,226,245,0), rgba(170,226,245,0.2) 50%, rgba(170,226,245,0))",
        }}
      />
      <div
        data-finale="room"
        className="absolute top-[20%] left-[9px] h-[60%] w-[9px] border-l border-[rgba(190,236,250,0.6)] opacity-0"
        style={roomScaleStyle}
      />
      <div
        data-finale="room"
        className="absolute top-[20%] right-[9px] h-[60%] w-[9px] -scale-x-100 border-l border-[rgba(190,236,250,0.6)] opacity-0"
        style={roomScaleStyle}
      />
      <div
        data-finale="console"
        className="absolute inset-x-[6%] bottom-[118px] h-px bg-[#cdf0fb] shadow-[0_0_6px_rgba(170,226,245,0.8)]"
        style={{ transform: "scaleX(0)" }}
      />
      {rows.map((row) => {
        const firstIgnition = ignitions[row.cells[0]?.bottleIndex ?? 0];
        const lastIgnition =
          ignitions[row.cells[row.cells.length - 1]?.bottleIndex ?? 0];
        const railHeight = Math.max(7, row.cellHeight * 0.075);
        const padding = Math.max(8, row.cells[0]?.width ?? 0) * 0.32;
        const delay = (firstIgnition?.delayMs ?? 0) - step * 0.5;
        const span = (lastIgnition?.delayMs ?? 0) - delay + step;
        return (
          <div
            key={`${row.left}-${row.bottom}`}
            className="absolute overflow-hidden rounded-[2px]"
            style={{
              left: row.left - padding,
              width: row.right - row.left + padding * 2,
              top: row.bottom - railHeight * 0.42,
              height: railHeight,
            }}
          >
            <div
              data-finale="rail-line"
              data-delay={delay}
              data-span={span}
              className="absolute inset-x-0 top-0 h-[2px] origin-left bg-[#cdf0fb] shadow-[0_0_6px_rgba(170,226,245,0.9)]"
              style={{ transform: "scaleX(0)" }}
            />
            <div
              data-finale="rail-sweep"
              data-delay={delay}
              data-span={span}
              className="absolute inset-y-0 left-0 w-[30%] opacity-0"
              style={{
                background:
                  "linear-gradient(90deg, rgba(200,240,255,0), rgba(220,246,255,0.85), rgba(200,240,255,0))",
              }}
            />
          </div>
        );
      })}
      {rows.flatMap((row) =>
        row.cells.map((cell) => {
          const ignition = ignitions[cell.bottleIndex];
          if (!ignition || ignition.colorIndex === null) {
            return null;
          }
          const color = getFutureFluidView(ignition.colorIndex).base;
          const fluidLeft = (cell.width * CELL_FLUID.left) / CELL_VIEW_WIDTH;
          const fluidWidth =
            (cell.width * (CELL_FLUID.right - CELL_FLUID.left)) /
            CELL_VIEW_WIDTH;
          const fluidTop = (cell.height * CELL_FLUID.top) / CELL_VIEW_HEIGHT;
          const fluidHeight =
            (cell.height * (CELL_FLUID.bottom - CELL_FLUID.top)) /
            CELL_VIEW_HEIGHT;
          return (
            <div key={cell.bottleIndex}>
              <div
                data-finale="cell"
                data-delay={ignition.delayMs}
                className="absolute rounded-[3px] opacity-0"
                style={{
                  left: cell.left + fluidLeft,
                  top: cell.top + fluidTop,
                  width: fluidWidth,
                  height: fluidHeight,
                  mixBlendMode: "screen",
                  background: `linear-gradient(90deg, transparent, color-mix(in oklab, ${color} 40%, #ffffff) 50%, transparent)`,
                  boxShadow: `0 0 14px 3px color-mix(in oklab, ${color} 60%, transparent), 0 0 34px 8px color-mix(in oklab, ${color} 22%, transparent)`,
                }}
              />
              <div
                data-finale="beam"
                data-delay={ignition.delayMs}
                className="absolute origin-bottom opacity-0"
                style={{
                  left: cell.left + cell.width * 0.5 - cell.width * 0.06,
                  width: cell.width * 0.12,
                  top: cell.top - cell.height * 0.42,
                  height: cell.height * 0.42,
                  mixBlendMode: "screen",
                  background: `linear-gradient(0deg, color-mix(in oklab, ${color} 55%, #ffffff), transparent)`,
                  filter: "blur(1.5px)",
                }}
              />
            </div>
          );
        }),
      )}
    </div>
  );
}

function animateFinaleElement(
  element: HTMLElement,
  kind: string | undefined,
  delay: number,
  span: number,
): Animation[] {
  const hold = { fill: "both" as const };
  switch (kind) {
    case "glow":
      return [
        element.animate(
          [{ opacity: 0 }, { opacity: 1, offset: 0.35 }, { opacity: 0.55 }],
          {
            delay: FINALE_SURGE_START_MS - 200,
            duration: FINALE_SURGE_DURATION_MS + 400,
            easing: "ease-out",
            ...hold,
          },
        ),
      ];
    case "surge":
      return [
        element.animate(
          [
            { opacity: 0, transform: "translateY(300%)" },
            { opacity: 1, transform: "translateY(160%)", offset: 0.25 },
            { opacity: 0.8, transform: "translateY(-40%)", offset: 0.85 },
            { opacity: 0, transform: "translateY(-100%)" },
          ],
          {
            delay: FINALE_SURGE_START_MS,
            duration: FINALE_SURGE_DURATION_MS,
            easing: "cubic-bezier(.4,0,.3,1)",
            ...hold,
          },
        ),
      ];
    case "room":
      return [
        element.animate(
          [{ opacity: 0 }, { opacity: 0.9, offset: 0.3 }, { opacity: 0.35 }],
          {
            delay: FINALE_SURGE_START_MS + 150,
            duration: FINALE_SURGE_DURATION_MS + 300,
            easing: "ease-out",
            ...hold,
          },
        ),
      ];
    case "console":
      return [
        element.animate(
          [
            { transform: "scaleX(0)", opacity: 1 },
            { transform: "scaleX(1)", opacity: 1, offset: 0.5 },
            { transform: "scaleX(1)", opacity: 0.45 },
          ],
          {
            delay: FINALE_SURGE_START_MS - 100,
            duration: FINALE_SURGE_DURATION_MS,
            easing: "cubic-bezier(.3,.6,.3,1)",
            ...hold,
          },
        ),
      ];
    case "rail-line":
      return [
        element.animate(
          [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }],
          { delay, duration: span, easing: "linear", ...hold },
        ),
      ];
    case "rail-sweep":
      return [
        element.animate(
          [
            { opacity: 0, transform: "translateX(-100%)" },
            { opacity: 1, transform: "translateX(0%)", offset: 0.15 },
            { opacity: 1, transform: "translateX(240%)", offset: 0.85 },
            { opacity: 0, transform: "translateX(333%)" },
          ],
          { delay, duration: span, easing: "linear", ...hold },
        ),
      ];
    case "cell":
      return [
        element.animate(
          [{ opacity: 0 }, { opacity: 1, offset: 0.18 }, { opacity: 0.5 }],
          { delay, duration: 700, easing: "ease-out", ...hold },
        ),
      ];
    case "beam":
      return [
        element.animate(
          [
            { opacity: 0, transform: "scaleY(0)" },
            { opacity: 1, transform: "scaleY(1)", offset: 0.3 },
            { opacity: 0, transform: "scaleY(1.1)" },
          ],
          { delay, duration: 620, easing: "ease-out", ...hold },
        ),
      ];
    default:
      return [];
  }
}
