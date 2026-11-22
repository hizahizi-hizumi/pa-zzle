import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import type { ClearFinaleProps } from "@/games/water-sort/ui/ideas/overrides";
import { getSummerWaterColor } from "@/games/water-sort/ui/ideas/summer/summer-palette";
import { playAnimations } from "@/lib/motion";

type LitBottle = {
  bottleIndex: number;
  colorIndex: number;
  rect: DOMRect;
};

/** 瓶を次々に陽にかざす間合いの上限と、全体でかける長さ。 */
const MAX_STAGGER_MS = 90;
const STAGGER_SPAN_MS = 720;
const RAISE_DURATION_MS = 820;
const FINALE_HOLD_MS = 520;
const REDUCED_MOTION_HOLD_MS = 1400;

const raiseKeyframes: Keyframe[] = [
  { transform: "translateY(0) rotate(0deg)", offset: 0, easing: "ease-out" },
  {
    transform: "translateY(-11%) rotate(-5deg)",
    offset: 0.35,
    easing: "ease-in-out",
  },
  {
    transform: "translateY(-12%) rotate(-3deg)",
    offset: 0.6,
    easing: "ease-in-out",
  },
  { transform: "translateY(0) rotate(0deg)", offset: 1 },
];

const poolKeyframes: Keyframe[] = [
  { opacity: 0, transform: "skewX(-30deg) scale(0.6, 0.3)", offset: 0 },
  {
    opacity: 1,
    transform: "skewX(-30deg) scale(1.08, 1.12)",
    offset: 0.45,
    easing: "ease-out",
  },
  { opacity: 0.92, transform: "skewX(-30deg) scale(1, 1)", offset: 1 },
];

const sparkleKeyframes: Keyframe[] = [
  { opacity: 0, transform: "scale(0) rotate(0deg)", offset: 0 },
  { opacity: 0, transform: "scale(0) rotate(0deg)", offset: 0.25 },
  { opacity: 1, transform: "scale(1) rotate(45deg)", offset: 0.45 },
  { opacity: 0, transform: "scale(0.2) rotate(90deg)", offset: 0.8 },
  { opacity: 0, transform: "scale(0.2) rotate(90deg)", offset: 1 },
];

const washKeyframes: Keyframe[] = [
  { opacity: 0, offset: 0 },
  { opacity: 1, offset: 0.4, easing: "ease-out" },
  { opacity: 0.85, offset: 1 },
];

function getStaggerMs(count: number): number {
  return count <= 1
    ? 0
    : Math.min(MAX_STAGGER_MS, STAGGER_SPAN_MS / (count - 1));
}

/** そろった瓶を、子どもが次々に陽にかざし、板の上に色の影が並ぶ。 */
export function SummerClearFinale({
  state,
  getBottleElements,
  onDone,
}: ClearFinaleProps) {
  const [litBottles, setLitBottles] = useState<readonly LitBottle[]>([]);
  const poolRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const sparkleRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const washRef = useRef<HTMLDivElement>(null);
  const finish = useEffectEvent(onDone);

  useLayoutEffect(() => {
    const elements = getBottleElements();
    setLitBottles(
      state.flatMap((bottle, bottleIndex) => {
        const colorIndex = bottle[0];
        const element = elements[bottleIndex];
        if (colorIndex === undefined || !element) {
          return [];
        }
        return [
          { bottleIndex, colorIndex, rect: element.getBoundingClientRect() },
        ];
      }),
    );
  }, [getBottleElements, state]);

  useEffect(() => {
    if (litBottles.length === 0) {
      return;
    }
    const elements = getBottleElements();
    const stagger = getStaggerMs(litBottles.length);
    const totalMs = stagger * (litBottles.length - 1) + RAISE_DURATION_MS;

    return playAnimations({
      animate() {
        const played: Animation[] = [];
        litBottles.forEach(({ bottleIndex }, order) => {
          const timing = {
            duration: RAISE_DURATION_MS,
            delay: stagger * order,
            fill: "backwards" as const,
          };
          const glass = elements[bottleIndex]?.querySelector<HTMLElement>(
            "[data-summer-glass]",
          );
          const raise = glass?.animate?.(raiseKeyframes, timing);
          const pool = poolRefs.current[order]?.animate?.(poolKeyframes, {
            ...timing,
            fill: "both",
          });
          const sparkle = sparkleRefs.current[order]?.animate?.(
            sparkleKeyframes,
            timing,
          );
          for (const animation of [raise, pool, sparkle]) {
            if (animation) {
              played.push(animation);
            }
          }
        });
        const wash = washRef.current?.animate?.(washKeyframes, {
          duration: totalMs,
          fill: "both",
        });
        if (wash) {
          played.push(wash);
        }
        return played;
      },
      completion: { type: "after-animations", holdMs: FINALE_HOLD_MS },
      reducedMotionHoldMs: REDUCED_MOTION_HOLD_MS,
      unanimatedHoldMs: REDUCED_MOTION_HOLD_MS,
      onFinished() {
        finish();
      },
    });
  }, [getBottleElements, litBottles]);

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        <div
          ref={washRef}
          className="absolute inset-0 motion-reduce:opacity-80"
          style={{
            background:
              "radial-gradient(ellipse 90% 70% at 15% 10%, rgba(255,236,176,0.45), rgba(255,226,150,0.12) 60%, transparent 85%)",
          }}
        />
        {litBottles.map(({ bottleIndex, colorIndex, rect }, order) => {
          const color = getSummerWaterColor(colorIndex);
          return (
            <span
              key={bottleIndex}
              ref={(element) => {
                poolRefs.current[order] = element;
              }}
              className="absolute origin-top rounded-[50%] blur-[3px] motion-reduce:opacity-90"
              style={{
                left: rect.left - rect.width * 0.1,
                top: rect.bottom - rect.height * 0.04,
                width: rect.width * 1.2,
                height: rect.height * 0.4,
                transform: "skewX(-30deg)",
                background: `radial-gradient(ellipse 34% 40% at 50% 38%, #fffbe8 0%, ${color.light} 40%, ${color.water}99 75%, transparent 100%)`,
              }}
            />
          );
        })}
      </div>
      <div
        role="presentation"
        className="fixed inset-0 z-10 overflow-hidden"
        onClick={onDone}
      >
        {litBottles.map(({ bottleIndex, rect }, order) => (
          <span
            key={bottleIndex}
            ref={(element) => {
              sparkleRefs.current[order] = element;
            }}
            aria-hidden="true"
            className="pointer-events-none absolute opacity-0"
            style={{
              left: rect.left + rect.width * 0.12,
              top: rect.top + rect.height * 0.2,
              width: rect.width * 0.42,
              height: rect.width * 0.42,
              background:
                "radial-gradient(circle, #ffffff 0 8%, rgba(255,250,220,0.9) 12%, transparent 30%), conic-gradient(from 0deg, transparent 0 20deg, rgba(255,255,255,0.95) 0 25deg, transparent 0 110deg, rgba(255,255,255,0.95) 0 115deg, transparent 0 200deg, rgba(255,255,255,0.95) 0 205deg, transparent 0 290deg, rgba(255,255,255,0.95) 0 295deg, transparent 0)",
              maskImage: "radial-gradient(circle, #000 20%, transparent 70%)",
              WebkitMaskImage:
                "radial-gradient(circle, #000 20%, transparent 70%)",
            }}
          />
        ))}
      </div>
    </>
  );
}
