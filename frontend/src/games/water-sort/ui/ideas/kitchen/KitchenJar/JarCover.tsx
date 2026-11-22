import { type RefObject, useId, useLayoutEffect, useRef } from "react";

import { JAR_VIEW_BOX } from "@/games/water-sort/ui/ideas/kitchen/jar-geometry";
import { prefersReducedMotion } from "@/lib/motion";

/** 布が落ちてかぶさり、紐が回って、蝶結びが結ばれるまで。 */
const CLOTH_DROP_MS = 420;
const TWINE_WRAP_DELAY_MS = 330;
const TWINE_WRAP_MS = 260;
const BOW_TIE_DELAY_MS = 520;
const BOW_TIE_MS = 240;
const COVER_EASING = "cubic-bezier(.2,.9,.25,1.15)";

type JarCoverProps = {
  /** `true` のときは結ぶ動きを見せない。見せずに出したら `false` にする。 */
  skipTyingRef: RefObject<boolean>;
};

// 裾は鋏で波に切った布の端。中ほどが上がり、両端が垂れる。
const HEM_PATH = createHemPath();

function createHemPath() {
  const points: string[] = [];
  const left = -1;
  const right = 37;
  const steps = 26;
  for (let step = 0; step <= steps; step += 1) {
    const ratio = step / steps;
    const x = left + (right - left) * ratio;
    const sag = 19.2 + 2.4 * (2 * ratio - 1) ** 2;
    const y = sag + (step % 2 === 0 ? 0.55 : -0.25);
    points.push(`${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return points.join(" L");
}

const CLOTH_PATH = `M5.3 12.4 C3.6 13.8 0.4 16.4 -1 20.4 L${HEM_PATH} C35.6 16.4 32.4 13.8 30.7 12.4 Z`;
const DOME_PATH =
  "M4.3 12.2 C2.6 4.6 5.4 -0.2 18 -0.4 C30.6 -0.2 33.4 4.6 31.7 12.2 Q18 13.8 4.3 12.2 Z";

export function JarCover({ skipTyingRef }: JarCoverProps) {
  const id = useId();
  const ginghamId = `${id}-gingham`;
  const lightId = `${id}-light`;
  const clothRef = useRef<SVGGElement>(null);
  const twineRef = useRef<SVGGElement>(null);
  const bowRef = useRef<SVGGElement>(null);

  useLayoutEffect(() => {
    if (skipTyingRef.current) {
      skipTyingRef.current = false;
      return;
    }
    const cloth = clothRef.current;
    if (typeof cloth?.animate !== "function" || prefersReducedMotion()) {
      return;
    }
    const animations = [
      cloth.animate(
        [
          { opacity: 0, transform: "translateY(-9px) scaleY(0.7)" },
          { opacity: 1, transform: "translateY(0) scaleY(1)" },
        ],
        { duration: CLOTH_DROP_MS, easing: COVER_EASING, fill: "backwards" },
      ),
      ...Array.from(
        twineRef.current?.querySelectorAll("path") ?? [],
        function wrapTwine(strand) {
          return strand.animate(
            [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }],
            {
              duration: TWINE_WRAP_MS,
              delay: TWINE_WRAP_DELAY_MS,
              easing: "ease-out",
              fill: "backwards",
            },
          );
        },
      ),
    ];
    const bowAnimation = bowRef.current?.animate(
      [
        { opacity: 0, transform: "scale(0.2)" },
        { opacity: 1, transform: "scale(1)" },
      ],
      {
        duration: BOW_TIE_MS,
        delay: BOW_TIE_DELAY_MS,
        easing: COVER_EASING,
        fill: "backwards",
      },
    );
    return () => {
      for (const animation of animations) {
        animation.cancel();
      }
      bowAnimation?.cancel();
    };
  }, [skipTyingRef]);

  return (
    <svg
      viewBox={JAR_VIEW_BOX}
      preserveAspectRatio="none"
      className="absolute inset-0 size-full overflow-visible"
    >
      <defs>
        <pattern
          id={ginghamId}
          width="3.2"
          height="3.2"
          patternUnits="userSpaceOnUse"
        >
          <rect width="3.2" height="3.2" fill="#f7f0e3" />
          <rect width="1.6" height="3.2" fill="#c8564b" fillOpacity="0.42" />
          <rect width="3.2" height="1.6" fill="#c8564b" fillOpacity="0.42" />
        </pattern>
        <linearGradient id={lightId} x1="0" x2="1" y1="0" y2="0.4">
          <stop offset="0" stopColor="#fffaf0" stopOpacity="0.45" />
          <stop offset="0.45" stopColor="#fffaf0" stopOpacity="0" />
          <stop offset="1" stopColor="#5a2a1a" stopOpacity="0.28" />
        </linearGradient>
      </defs>

      <g
        ref={clothRef}
        style={{ transformBox: "fill-box", transformOrigin: "50% 0%" }}
      >
        <path
          d={CLOTH_PATH}
          fill={`url(#${ginghamId})`}
          className="dark:brightness-75"
        />
        <path d={CLOTH_PATH} fill={`url(#${lightId})`} />
        {/* 肩に掛かって寄るひだ。 */}
        <g
          fill="none"
          strokeLinecap="round"
          strokeWidth="0.7"
          className="stroke-[#6b2a1e]/30"
        >
          <path d="M8 13.6 Q6.4 16.4 5.6 20.6" />
          <path d="M14 14.2 Q13.6 17 13.4 19.6" />
          <path d="M22.4 14.2 Q22.8 17 23 19.6" />
          <path d="M28.4 13.6 Q30 16.4 30.8 20.6" />
        </g>
        <path d={DOME_PATH} fill={`url(#${ginghamId})`} />
        <path d={DOME_PATH} fill={`url(#${lightId})`} />
        <path
          d="M8.2 4.6 Q12 2.2 18 2"
          fill="none"
          strokeWidth="0.8"
          strokeLinecap="round"
          className="stroke-white/60 dark:stroke-[#ffe2b0]/30"
        />
      </g>

      <g
        ref={twineRef}
        fill="none"
        strokeLinecap="round"
        className="stroke-[#a8783f] dark:stroke-[#c49660]"
      >
        <path
          d="M4.8 11.7 Q18 14.1 31.2 11.7"
          strokeWidth="1.15"
          pathLength={1}
          strokeDasharray="1"
        />
        <path
          d="M4.8 12.9 Q18 15.3 31.2 12.9"
          strokeWidth="0.9"
          pathLength={1}
          strokeDasharray="1"
          className="stroke-[#8c6030] dark:stroke-[#a57a48]"
        />
      </g>

      <g
        ref={bowRef}
        fill="none"
        strokeLinecap="round"
        style={{ transformBox: "fill-box", transformOrigin: "50% 30%" }}
        className="stroke-[#a8783f] dark:stroke-[#c49660]"
      >
        <path
          d="M18 13.5 C15.4 10.6 12.2 11.2 12.6 12.8 C13 14.4 16 14.4 18 13.5 Z"
          strokeWidth="0.95"
        />
        <path
          d="M18 13.5 C20.6 10.6 23.8 11.2 23.4 12.8 C23 14.4 20 14.4 18 13.5 Z"
          strokeWidth="0.95"
        />
        <path d="M17.6 13.8 Q16.4 16.4 15.2 18.6" strokeWidth="0.85" />
        <path d="M18.4 13.8 Q19.8 16 21.4 18" strokeWidth="0.85" />
        <circle
          cx="18"
          cy="13.5"
          r="0.95"
          className="fill-[#94652f] stroke-none dark:fill-[#b0844f]"
        />
      </g>
    </svg>
  );
}
