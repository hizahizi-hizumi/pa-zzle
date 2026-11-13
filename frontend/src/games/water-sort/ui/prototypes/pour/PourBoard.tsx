import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { WaterSortBoardProps } from "@/games/water-sort/ui/board/WaterSortBoard";
import { getWaterColorView } from "@/games/water-sort/ui/board/water-bottle/get-water-color-view";
import { PourEngine } from "@/games/water-sort/ui/prototypes/pour/PourBoard/engine";
import { computeBoardLayout } from "@/games/water-sort/ui/prototypes/pour/PourBoard/layout";

/** 地の作業台の奥の縁を、盤面の床の位置に合わせるための CSS 変数。 */
export const POUR_FLOOR_VARIABLE = "--pour-floor-y";

export function PourBoard({
  state,
  sourceBottleIndex,
  operation,
  onSelectBottle,
  interactionDisabled,
  onPourAnimationActivityChange,
  onClearAnimationComplete,
}: WaterSortBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<PourEngine | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(
    null,
  );

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () => {
      const rect = container.getBoundingClientRect();
      setSize((current) =>
        current &&
        Math.abs(current.width - rect.width) < 0.5 &&
        Math.abs(current.height - rect.height) < 0.5
          ? current
          : { width: rect.width, height: rect.height },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const layout = size
    ? computeBoardLayout(state.length, size.width, size.height)
    : null;

  const callbacks = {
    onActivityChange: (active: boolean) =>
      onPourAnimationActivityChange?.(active),
    onClearAnimationComplete: () => onClearAnimationComplete?.(),
    onFloorChange: (floorY: number | null) => {
      const root = document.documentElement;
      if (floorY === null) root.style.removeProperty(POUR_FLOOR_VARIABLE);
      else root.style.setProperty(POUR_FLOOR_VARIABLE, `${floorY}px`);
    },
  };
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const hasLayout = layout !== null;
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const box = boxRef.current;
    if (!hasLayout || !canvas || !box) return;
    const engine = new PourEngine(canvas, box, {
      onActivityChange: (active) =>
        callbacksRef.current.onActivityChange(active),
      onClearAnimationComplete: () =>
        callbacksRef.current.onClearAnimationComplete(),
      onFloorChange: (floorY) => callbacksRef.current.onFloorChange(floorY),
    });
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [hasLayout]);

  const layoutKey = layout?.key;
  // biome-ignore lint/correctness/useExhaustiveDependencies: layout は key が変わったときだけ渡し直す
  useLayoutEffect(() => {
    if (layout) engineRef.current?.setLayout(layout);
  }, [layoutKey, hasLayout]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 作り直した engine にも今の盤面を渡す
  useLayoutEffect(() => {
    engineRef.current?.sync({ state, sourceBottleIndex, operation });
  }, [state, sourceBottleIndex, operation, hasLayout, layoutKey]);

  useEffect(() => {
    return () => {
      document.documentElement.style.removeProperty(POUR_FLOOR_VARIABLE);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative size-full">
      {layout && (
        <div
          ref={boxRef}
          className="absolute"
          style={{
            left: layout.left,
            top: layout.top,
            width: layout.rack.width * layout.scale,
            height: layout.rack.height * layout.scale,
          }}
        >
          {state.map((bottle, bottleIndex) => {
            const slot = layout.slots[bottleIndex];
            if (!slot) return null;
            const bottleLabel = `ボトル ${bottleIndex + 1}`;
            const contents =
              bottle.length === 0
                ? "空"
                : bottle
                    .map((colorIndex) => getWaterColorView(colorIndex).name)
                    .join("、");
            const s = layout.scale;
            return (
              <button
                key={bottleLabel}
                type="button"
                aria-label={`${bottleLabel}: ${contents}`}
                aria-pressed={bottleIndex === sourceBottleIndex}
                onClick={() => {
                  if (!interactionDisabled) onSelectBottle(bottleIndex);
                }}
                disabled={interactionDisabled}
                className="absolute cursor-pointer touch-manipulation rounded-2xl bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                style={{
                  left: (slot.cx - layout.slotWidth / 2) * s,
                  top: (slot.yt - 38) * s,
                  width: layout.slotWidth * s,
                  height: 234 * s,
                  WebkitTapHighlightColor: "transparent",
                }}
              />
            );
          })}
        </div>
      )}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 size-full"
      />
    </div>
  );
}
