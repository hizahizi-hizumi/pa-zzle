import { useEffect, useMemo, useRef } from "react";

import { getOverlayStyle } from "@/games/water-sort/ui/board/pour/PourAnimationLayer/animation-view";
import type { PourAnimation } from "@/games/water-sort/ui/board/pour/pour-animation";
import { BarGlass } from "@/games/water-sort/ui/ideas/bar/BarGlass";
import { TiltedLiquid } from "@/games/water-sort/ui/ideas/bar/BarPourAnimationLayer/BarPourSource/TiltedLiquid";
import { BAR_POUR_LAYER_ORDER } from "@/games/water-sort/ui/ideas/bar/BarPourAnimationLayer/bar-pour-layer-order";
import { getLiquidRuns } from "@/games/water-sort/ui/ideas/bar/bar-glass-geometry";
import {
  BAR_POUR_DURATION_MS,
  type BarPourPlan,
  getBarPourPlan,
  getSourceAmount,
  getSourcePose,
} from "@/games/water-sort/ui/ideas/bar/bar-pour-timeline";
import {
  getTiltedLiquidShape,
  type TiltedLiquidRun,
} from "@/games/water-sort/ui/ideas/bar/tilted-glass";
import { playAnimations } from "@/lib/motion";

type BarPourSourceProps = {
  animation: PourAnimation;
  onFinish: (animationId: number) => void;
};

/** 注ぎ元のグラス。傾きと液面は、残っている液の量から毎フレーム求めて描く。 */
export function BarPourSource({ animation, onFinish }: BarPourSourceProps) {
  const glassRef = useRef<HTMLDivElement>(null);
  const polygonRefs = useRef<Array<SVGPolygonElement | null>>([]);
  const surfaceRef = useRef<SVGPolylineElement>(null);
  const { source } = animation;
  const runs = useMemo(
    (): readonly TiltedLiquidRun[] =>
      getLiquidRuns(source.before).map((run) => ({
        colorIndex: run.colorIndex,
        fromSlot: run.startSlot,
        toSlot: run.startSlot + run.slotCount,
      })),
    [source.before],
  );

  useEffect(() => {
    const glassElement = glassRef.current;
    if (!glassElement?.animate) {
      onFinish(animation.id);
      return;
    }
    const plan = getBarPourPlan(animation);
    let frame = 0;
    let clock: Animation | undefined;

    function draw(progress: number, currentPlan: BarPourPlan) {
      if (!glassElement) {
        return;
      }
      const pose = getSourcePose(currentPlan, progress);
      const { restPivot } = currentPlan;
      glassElement.style.transform = `translate(${pose.pivot.x - restPivot.x}px, ${pose.pivot.y - restPivot.y}px) rotate(${pose.angleDeg}deg)`;
      const shape = getTiltedLiquidShape(
        currentPlan.box,
        runs,
        getSourceAmount(currentPlan, progress),
        pose.angleDeg,
      );
      shape.polygons.forEach((points, index) => {
        polygonRefs.current[index]?.setAttribute("points", points);
      });
      surfaceRef.current?.setAttribute("points", shape.surface);
    }

    function tick() {
      const time = Number(clock?.currentTime ?? 0);
      draw(Math.min(1, time / BAR_POUR_DURATION_MS), plan);
      frame = requestAnimationFrame(tick);
    }

    draw(0, plan);
    const cancel = playAnimations({
      animate() {
        // 進み具合を測る時計。見た目は毎フレーム、時計の時刻から描く。
        clock = glassElement.animate([{ opacity: 1 }, { opacity: 1 }], {
          duration: BAR_POUR_DURATION_MS,
        });
        frame = requestAnimationFrame(tick);
        return [clock];
      },
      completion: { type: "after-animations", holdMs: 0 },
      reducedMotionHoldMs: 0,
      unanimatedHoldMs: 0,
      onFinished() {
        onFinish(animation.id);
      },
    });

    return () => {
      cancel();
      cancelAnimationFrame(frame);
    };
  }, [animation, onFinish, runs]);

  return (
    <div
      ref={glassRef}
      aria-hidden="true"
      className="pointer-events-none fixed origin-top will-change-transform"
      style={getOverlayStyle(source.rect, BAR_POUR_LAYER_ORDER.source)}
    >
      <TiltedLiquid
        width={source.rect.width}
        height={source.rect.height}
        runs={runs}
        polygonRefs={(index) => (element) => {
          polygonRefs.current[index] = element;
        }}
        surfaceRef={surfaceRef}
      />
      <BarGlass contents={[]} role="pour-source" selected />
    </div>
  );
}
