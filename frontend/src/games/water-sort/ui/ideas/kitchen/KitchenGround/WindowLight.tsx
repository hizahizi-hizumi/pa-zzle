import { useEffect, useId, useRef } from "react";

import { prefersReducedMotion } from "@/lib/motion";

/** 窓の外の若葉がわずかに揺れる。盤面から目を奪わないよう、小さく遅くする。 */
const LEAF_SWAY_MS = 7400;

const LEAF_PATHS = [
  "M210 30 C222 22 238 26 244 38 C232 44 216 42 210 30 Z",
  "M232 62 C246 58 258 66 260 80 C246 82 236 76 232 62 Z",
  "M188 70 C196 58 212 58 218 68 C210 78 196 80 188 70 Z",
  "M250 112 C262 104 276 110 280 122 C268 128 254 124 250 112 Z",
  "M214 118 C222 108 236 110 240 120 C232 130 220 130 214 118 Z",
  "M150 30 C160 22 174 26 178 36 C168 42 156 40 150 30 Z",
] as const;

export function WindowLight() {
  const id = useId();
  const blurId = `${id}-blur`;
  const leafBlurId = `${id}-leaf-blur`;
  const panesClipId = `${id}-panes`;
  const leavesRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const leaves = leavesRef.current;
    if (typeof leaves?.animate !== "function" || prefersReducedMotion()) {
      return;
    }
    const sway = leaves.animate(
      [
        { transform: "rotate(-1.4deg) translateX(-2px)" },
        { transform: "rotate(1.4deg) translateX(2px)" },
      ],
      {
        duration: LEAF_SWAY_MS,
        direction: "alternate",
        iterations: Number.POSITIVE_INFINITY,
        easing: "ease-in-out",
      },
    );
    return () => sway.cancel();
  }, []);

  const panes = (
    <>
      <rect x="0" y="0" width="92" height="104" rx="3" />
      <rect x="102" y="0" width="92" height="104" rx="3" />
      <rect x="0" y="114" width="92" height="104" rx="3" />
      <rect x="102" y="114" width="92" height="104" rx="3" />
    </>
  );

  return (
    <>
      <svg
        aria-hidden="true"
        viewBox="0 0 300 260"
        className="absolute top-[2%] right-[-14%] w-[88%] max-w-[620px] dark:hidden"
      >
        <defs>
          <filter id={blurId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="7" />
          </filter>
          <filter id={leafBlurId} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3.2" />
          </filter>
          <clipPath id={panesClipId}>
            <g transform="translate(70 18) skewX(-17)">{panes}</g>
          </clipPath>
        </defs>
        <g
          transform="translate(70 18) skewX(-17)"
          fill="#fff6dc"
          fillOpacity="0.82"
          filter={`url(#${blurId})`}
        >
          {panes}
        </g>
        <g clipPath={`url(#${panesClipId})`}>
          <g
            ref={leavesRef}
            fill="#7d8656"
            fillOpacity="0.16"
            filter={`url(#${leafBlurId})`}
            style={{ transformBox: "view-box", transformOrigin: "100% 0%" }}
          >
            {LEAF_PATHS.map((path) => (
              <path key={path} d={path} />
            ))}
            <path
              d="M300 10 Q240 40 196 74 M262 40 Q250 90 246 118"
              fill="none"
              stroke="#7d8656"
              strokeOpacity="0.7"
              strokeWidth="2"
            />
          </g>
        </g>
      </svg>
      {/* 夜は、上から吊るした電球の暖かい明かりが壁に丸く広がる。 */}
      <div className="absolute inset-x-0 top-0 hidden h-[70%] bg-[radial-gradient(ellipse_60%_60%_at_50%_8%,rgba(255,196,120,0.22)_0%,rgba(255,196,120,0.06)_55%,rgba(255,196,120,0)_80%)] dark:block" />
    </>
  );
}
