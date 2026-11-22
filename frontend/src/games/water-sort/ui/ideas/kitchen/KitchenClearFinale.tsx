import { useEffect, useLayoutEffect, useRef, useState } from "react";

import {
  KITCHEN_FINALE_DURATION_MS,
  KITCHEN_SUNRISE_DELAY_MS,
  KITCHEN_SUNRISE_SWEEP_MS,
} from "@/games/water-sort/ui/ideas/kitchen/kitchen-finale-timing";
import type { ClearFinaleProps } from "@/games/water-sort/ui/ideas/overrides";
import { playAnimations, prefersReducedMotion } from "@/lib/motion";

/** 動きを減らす設定では、朝日の差した棚を動かさずに見せてから結果へ移る。 */
const REDUCED_MOTION_HOLD_MS = 1400;
const GLINT_EASING = "cubic-bezier(.2,.8,.2,1)";

type JarSpot = { left: number; top: number; width: number; height: number };

/** 全部の瓶に布をかぶせ終えると、窓から朝日が差し、棚に並んだ瓶を左から順に照らしていく。 */
export function KitchenClearFinale({
  getBottleElements,
  onDone,
}: ClearFinaleProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const washRef = useRef<HTMLDivElement>(null);
  const beamRef = useRef<HTMLDivElement>(null);
  const raysRef = useRef<HTMLDivElement>(null);
  const [jars, setJars] = useState<readonly JarSpot[]>([]);
  const onDoneRef = useRef(onDone);
  useLayoutEffect(() => {
    onDoneRef.current = onDone;
  });

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const base = container.getBoundingClientRect();
    setJars(
      getBottleElements().map(function measureJar(bottle) {
        const rect = bottle.getBoundingClientRect();
        return {
          left: rect.left - base.left,
          top: rect.top - base.top,
          width: rect.width,
          height: rect.height,
        };
      }),
    );
  }, [getBottleElements]);

  useEffect(() => {
    const container = containerRef.current;
    const wash = washRef.current;
    const beam = beamRef.current;
    const rays = raysRef.current;
    if (!container || jars.length === 0) {
      return;
    }
    const width = container.clientWidth;
    return playAnimations({
      animate() {
        if (typeof wash?.animate !== "function" || !beam || !rays) {
          return [];
        }
        const animations = [
          // 横切った光は、窓から差し込む筋になって棚に残る。
          rays.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration: KITCHEN_SUNRISE_SWEEP_MS * 0.8,
            delay: KITCHEN_SUNRISE_DELAY_MS + KITCHEN_SUNRISE_SWEEP_MS * 0.45,
            easing: "ease-out",
            fill: "both",
          }),
          wash.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration: KITCHEN_SUNRISE_SWEEP_MS,
            delay: KITCHEN_SUNRISE_DELAY_MS,
            easing: "ease-out",
            fill: "both",
          }),
          beam.animate(
            [
              {
                transform: `translateX(${-width * 0.9}px) rotate(22deg)`,
                opacity: 0,
              },
              { opacity: 1, offset: 0.2 },
              { opacity: 1, offset: 0.75 },
              {
                transform: `translateX(${width * 1.3}px) rotate(22deg)`,
                opacity: 0,
              },
            ],
            {
              duration: KITCHEN_SUNRISE_SWEEP_MS,
              delay: KITCHEN_SUNRISE_DELAY_MS,
              easing: "ease-in-out",
              fill: "both",
            },
          ),
        ];
        for (const glint of container.querySelectorAll<HTMLElement>(
          "[data-jar-glint]",
        )) {
          const reach = Number(glint.dataset.jarGlint);
          animations.push(
            glint.animate(
              [
                { opacity: 0, transform: "scale(0.4) rotate(-30deg)" },
                {
                  opacity: 1,
                  transform: "scale(1.15) rotate(10deg)",
                  offset: 0.35,
                },
                { opacity: 0.55, transform: "scale(0.8) rotate(20deg)" },
              ],
              {
                duration: 900,
                delay:
                  KITCHEN_SUNRISE_DELAY_MS + KITCHEN_SUNRISE_SWEEP_MS * reach,
                easing: GLINT_EASING,
                fill: "both",
              },
            ),
          );
        }
        for (const glow of container.querySelectorAll<HTMLElement>(
          "[data-jar-glow]",
        )) {
          const reach = Number(glow.dataset.jarGlow);
          animations.push(
            glow.animate(
              [{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 0.6 }],
              {
                duration: 1100,
                delay:
                  KITCHEN_SUNRISE_DELAY_MS + KITCHEN_SUNRISE_SWEEP_MS * reach,
                easing: "ease-out",
                fill: "both",
              },
            ),
          );
        }
        return animations;
      },
      completion: {
        type: "after-duration",
        durationMs: KITCHEN_FINALE_DURATION_MS,
      },
      reducedMotionHoldMs: REDUCED_MOTION_HOLD_MS,
      unanimatedHoldMs: REDUCED_MOTION_HOLD_MS,
      onFinished() {
        onDoneRef.current();
      },
    });
  }, [jars]);

  const width = containerRef.current?.clientWidth ?? 1;
  // 動きを減らす設定では、朝日の差した姿を初めから見せる。
  const restingOpacity = prefersReducedMotion() ? 1 : 0;

  return (
    // 触れば朝日を待たずに結果へ進める。
    <div
      ref={containerRef}
      className="fixed inset-0 z-[4] cursor-pointer overflow-hidden"
      onClick={() => onDoneRef.current()}
    >
      <div
        ref={washRef}
        className="absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_15%_10%,rgba(255,214,140,0.34)_0%,rgba(255,214,140,0.12)_55%,rgba(255,214,140,0)_100%)] mix-blend-soft-light dark:bg-[radial-gradient(ellipse_80%_70%_at_50%_0%,rgba(255,190,110,0.32)_0%,rgba(255,190,110,0.1)_60%,rgba(255,190,110,0)_100%)] dark:mix-blend-screen"
        style={{ opacity: restingOpacity }}
      />
      <div
        ref={raysRef}
        className="absolute inset-0 bg-[linear-gradient(118deg,rgba(255,236,190,0)_8%,rgba(255,214,140,0.55)_16%,rgba(255,236,190,0)_26%,rgba(255,236,190,0)_34%,rgba(255,214,140,0.45)_42%,rgba(255,236,190,0)_52%,rgba(255,236,190,0)_60%,rgba(255,214,140,0.35)_68%,rgba(255,236,190,0)_78%)] mix-blend-soft-light dark:bg-[linear-gradient(118deg,rgba(255,190,110,0)_10%,rgba(255,190,110,0.16)_22%,rgba(255,190,110,0)_36%,rgba(255,190,110,0)_50%,rgba(255,190,110,0.12)_62%,rgba(255,190,110,0)_76%)]"
        style={{ opacity: restingOpacity }}
      />
      <div
        ref={beamRef}
        className="absolute top-[-50%] left-0 h-[200%] w-[38%] bg-[linear-gradient(90deg,rgba(255,232,180,0)_0%,rgba(255,232,180,0.38)_45%,rgba(255,244,215,0.55)_52%,rgba(255,232,180,0)_100%)] mix-blend-screen motion-reduce:hidden dark:bg-[linear-gradient(90deg,rgba(255,190,110,0)_0%,rgba(255,190,110,0.4)_50%,rgba(255,190,110,0)_100%)]"
        style={{ opacity: 0 }}
      />
      {jars.map((jar) => {
        const reach = Math.min(
          1,
          Math.max(0, (jar.left + jar.width / 2) / width),
        );
        return (
          <span key={`${jar.left}-${jar.top}`}>
            {/* 液を通った光が、瓶の中を明るく灯す。 */}
            <span
              data-jar-glow={reach.toFixed(3)}
              className="absolute rounded-b-[30%] bg-[radial-gradient(ellipse_60%_55%_at_40%_50%,rgba(255,226,160,0.4)_0%,rgba(255,226,160,0)_100%)] mix-blend-overlay dark:mix-blend-screen"
              style={{
                left: jar.left + jar.width * 0.1,
                top: jar.top + jar.height * 0.23,
                width: jar.width * 0.8,
                height: jar.height * 0.68,
                opacity: restingOpacity * 0.7,
              }}
            />
            <svg
              data-jar-glint={reach.toFixed(3)}
              viewBox="-10 -10 20 20"
              aria-hidden="true"
              className="absolute motion-reduce:hidden"
              style={{
                left: jar.left + jar.width * 0.12,
                top: jar.top + jar.height * 0.16,
                width: jar.width * 0.42,
                height: jar.width * 0.42,
                opacity: 0,
              }}
            >
              <path
                d="M0 -9 C0.8 -2 2 -0.8 9 0 C2 0.8 0.8 2 0 9 C-0.8 2 -2 0.8 -9 0 C-2 -0.8 -0.8 -2 0 -9 Z"
                className="fill-[#fffbea] dark:fill-[#ffe2a8]"
              />
              <circle r="2.2" className="fill-white/90" />
            </svg>
          </span>
        );
      })}
    </div>
  );
}
