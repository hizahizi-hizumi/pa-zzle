import { useLayoutEffect, useRef } from "react";
import type { WaterSortBottle } from "@/games/water-sort/puzzle/state";
import { paintGlassBottle } from "@/games/water-sort/ui/board/water-bottle/glass-bottle-renderer";

type GlassBottleProps = {
  contents: WaterSortBottle;
  selected: boolean;
};

export function GlassBottle({ contents, selected }: GlassBottleProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previousSelectedRef = useRef(selected);
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof CanvasRenderingContext2D === "undefined") return;
    let frameRequest = 0;
    const shouldSlosh =
      previousSelectedRef.current !== selected &&
      contents.length > 0 &&
      !window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    previousSelectedRef.current = selected;

    function redraw(ripples = 0) {
      if (canvas) paintGlassBottle(canvas, { contents, selected, ripples });
    }
    redraw();
    if (shouldSlosh) {
      const startedAt = performance.now();
      function settle(time: number) {
        const progress = Math.min(1, (time - startedAt) / 420);
        redraw(progress);
        if (progress < 1) frameRequest = requestAnimationFrame(settle);
      }
      frameRequest = requestAnimationFrame(settle);
    }
    const observer = new ResizeObserver(() => redraw());
    observer.observe(canvas);
    return () => {
      cancelAnimationFrame(frameRequest);
      observer.disconnect();
    };
  }, [contents, selected]);

  return (
    <canvas
      ref={canvasRef}
      data-water-sort-glass="true"
      aria-hidden="true"
      className="absolute inset-0 size-full"
    />
  );
}
