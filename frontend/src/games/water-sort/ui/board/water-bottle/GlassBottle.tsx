import { useLayoutEffect, useRef } from "react";
import type { WaterSortBottle } from "@/games/water-sort/puzzle/state";
import { paintGlassBottle } from "@/games/water-sort/ui/board/water-bottle/glass-bottle-renderer";

type GlassBottleProps = {
  contents: WaterSortBottle;
  selected: boolean;
};

export function GlassBottle({ contents, selected }: GlassBottleProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof CanvasRenderingContext2D === "undefined") return;
    function redraw() {
      if (canvas) paintGlassBottle(canvas, { contents, selected });
    }
    redraw();
    const observer = new ResizeObserver(redraw);
    observer.observe(canvas);
    return () => observer.disconnect();
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
