import { useEffect, useId, useRef } from "react";

import { prefersReducedMotion } from "@/lib/motion";

const coilCenter = { x: 54, y: 80 } as const;
// 板の上に寝かせた渦巻きを、斜め上から見る。
const COIL_TILT = 0.42;
const COIL_TURNS_START = Math.PI * 1.4;
const COIL_TURNS_END = Math.PI * 8.6;
const COIL_GROWTH = 3.6 / Math.PI;

function getCoilPoint(angle: number) {
  const radius = COIL_GROWTH * angle;
  return {
    x: coilCenter.x + Math.cos(angle) * radius,
    y: coilCenter.y + Math.sin(angle) * radius * COIL_TILT,
  };
}

const coilPath = Array.from({ length: 160 }, (_, index) => {
  const angle =
    COIL_TURNS_START + ((COIL_TURNS_END - COIL_TURNS_START) * index) / 159;
  const { x, y } = getCoilPoint(angle);
  return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
}).join(" ");

const ember = getCoilPoint(COIL_TURNS_END);

const smokeKeyframes: Keyframe[] = [
  { transform: "translate(0, 0) scaleY(1)", opacity: 0.5 },
  { transform: "translate(-2px, -3px) scaleY(1.05)", opacity: 0.35 },
  { transform: "translate(1.5px, -5px) scaleY(1.1)", opacity: 0.5 },
];

const emberKeyframes: Keyframe[] = [
  { opacity: 0.75 },
  { opacity: 1 },
  { opacity: 0.8 },
];

/** 夜の縁側に置いた蚊取り線香。煙がごくゆっくり立ちのぼる。 */
export function MosquitoCoil() {
  const id = useId();
  const glowId = `${id}-glow`;
  const smokeRef = useRef<SVGGElement>(null);
  const emberRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) {
      return;
    }
    const smoke = smokeRef.current?.animate?.(smokeKeyframes, {
      duration: 9000,
      direction: "alternate",
      iterations: Number.POSITIVE_INFINITY,
      easing: "ease-in-out",
    });
    const glow = emberRef.current?.animate?.(emberKeyframes, {
      duration: 5200,
      direction: "alternate",
      iterations: Number.POSITIVE_INFINITY,
      easing: "ease-in-out",
    });
    return () => {
      smoke?.cancel();
      glow?.cancel();
    };
  }, []);

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      className="absolute right-1 bottom-[calc(env(safe-area-inset-bottom)+--spacing(3))] hidden size-24 overflow-visible will-change-transform dark:block"
    >
      <defs>
        <radialGradient id={glowId}>
          <stop offset="0" stopColor="#ffb25e" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffb25e" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* 線香立ての皿 */}
      <ellipse
        cx={coilCenter.x}
        cy={coilCenter.y + 3}
        rx="40"
        ry="15"
        fill="#0b0907"
        opacity="0.55"
      />
      <ellipse
        cx={coilCenter.x}
        cy={coilCenter.y + 1}
        rx="38"
        ry="14"
        fill="#3a3530"
        stroke="#5c554c"
        strokeWidth="0.8"
      />
      <path
        d={coilPath}
        fill="none"
        stroke="#1d2a17"
        strokeWidth="4.4"
        strokeLinecap="round"
        transform="translate(0 1.2)"
      />
      <path
        d={coilPath}
        fill="none"
        stroke="#4d6a3a"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      <path
        d={coilPath}
        fill="none"
        stroke="#7c9a5e"
        strokeWidth="0.8"
        strokeLinecap="round"
        transform="translate(-0.4 -0.9)"
        opacity="0.55"
      />
      <circle cx={ember.x} cy={ember.y} r="9" fill={`url(#${glowId})`} />
      <circle ref={emberRef} cx={ember.x} cy={ember.y} r="2" fill="#ff8a3a" />
      <g ref={smokeRef} opacity="0.5">
        <path
          d={`M ${ember.x} ${ember.y - 2} C ${ember.x - 6} ${ember.y - 18} ${ember.x + 7} ${ember.y - 30} ${ember.x - 2} ${ember.y - 48} C ${ember.x - 8} ${ember.y - 60} ${ember.x + 4} ${ember.y - 70} ${ember.x + 1} ${ember.y - 82}`}
          fill="none"
          stroke="#c9c4d6"
          strokeWidth="1.3"
          strokeLinecap="round"
          opacity="0.6"
        />
      </g>
    </svg>
  );
}
