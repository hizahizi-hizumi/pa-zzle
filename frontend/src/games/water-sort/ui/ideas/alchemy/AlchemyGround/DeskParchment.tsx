import { useId } from "react";

/** 机に置いた羊皮紙。円を正方形と三角に分ける錬金術の図が、薄れたインクで描かれている。 */
export function DeskParchment() {
  const id = useId();
  const edgeId = `${id}-edge`;
  const paperId = `${id}-paper`;

  return (
    <svg
      className="absolute -left-6 bottom-3 h-[104px] w-[188px] -rotate-6 opacity-60"
      viewBox="0 0 188 104"
      aria-hidden="true"
    >
      <defs>
        <filter id={edgeId} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.08"
            numOctaves="2"
            seed="2"
            result="noise"
          />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="6" />
        </filter>
        <radialGradient id={paperId} cx="0.6" cy="0.45" r="0.7">
          <stop offset="0" stopColor="#a88b5c" />
          <stop offset="0.7" stopColor="#7d6340" />
          <stop offset="1" stopColor="#4a3520" />
        </radialGradient>
      </defs>
      <rect
        x="6"
        y="6"
        width="176"
        height="92"
        rx="3"
        fill={`url(#${paperId})`}
        filter={`url(#${edgeId})`}
      />
      <g fill="none" stroke="#2c1a0b" strokeOpacity="0.55" strokeWidth="0.9">
        <circle cx="126" cy="50" r="30" />
        <rect x="105" y="29" width="42" height="42" />
        <path d="M 126 20 L 152 65 L 100 65 Z" />
        <circle cx="126" cy="50" r="12" />
        <path
          d="M 30 30 q 6 -3 12 0 t 12 0 t 12 0 t 12 0 M 30 42 q 6 -3 12 0 t 12 0 t 12 0 M 30 54 q 6 -3 12 0 t 12 0 t 12 0 t 12 0 M 30 66 q 6 -3 12 0 t 12 0"
          strokeOpacity="0.4"
          strokeWidth="0.8"
        />
      </g>
    </svg>
  );
}
