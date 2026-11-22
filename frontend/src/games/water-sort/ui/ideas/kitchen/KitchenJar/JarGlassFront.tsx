import { useId } from "react";

import {
  JAR_INNER_PATH,
  JAR_OUTLINE_PATH,
  JAR_VIEW_BOX,
} from "@/games/water-sort/ui/ideas/kitchen/jar-geometry";

type JarGlassFrontProps = {
  held: boolean;
};

/** 液の手前に重なる厚いガラス。左の窓から入る朝の光を、縦の照りと窓の映り込みで返す。 */
export function JarGlassFront({ held }: JarGlassFrontProps) {
  const id = useId();
  const shineId = `${id}-shine`;

  return (
    <svg
      viewBox={JAR_VIEW_BOX}
      preserveAspectRatio="none"
      className="absolute inset-0 size-full overflow-visible"
    >
      <defs>
        <linearGradient id={shineId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.18" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="0.7" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* 厚い底。光が集まる縁と、木に接する影の線。 */}
      <path
        d="M5.2 92.2 Q18 94.8 30.8 92.2"
        fill="none"
        strokeWidth="0.9"
        className="stroke-white/70 dark:stroke-[#ffe2b0]/35"
      />
      <path
        d="M6.4 95.6 Q18 96.8 29.6 95.6"
        fill="none"
        strokeWidth="0.7"
        className="stroke-[#3d4f49]/25 dark:stroke-black/40"
      />

      {/* 照り。左が窓の側。 */}
      <rect
        x="4.7"
        y="22.5"
        width="1.9"
        height="66"
        rx="0.95"
        fill={`url(#${shineId})`}
        className="opacity-80 dark:opacity-35"
      />
      <rect
        x="7.7"
        y="27"
        width="0.6"
        height="50"
        rx="0.3"
        fill={`url(#${shineId})`}
        className="opacity-35 dark:opacity-15"
      />
      <rect
        x="30.3"
        y="25"
        width="0.9"
        height="60"
        rx="0.45"
        fill={`url(#${shineId})`}
        className="opacity-45 dark:opacity-30"
      />
      {/* 朝は窓が、夜は電球が、胴の丸みに柔らかく映る。 */}
      <rect
        x="9.6"
        y="25.5"
        width="3.6"
        height="11"
        rx="1.8"
        fill={`url(#${shineId})`}
        className="opacity-30 dark:hidden"
      />
      <ellipse
        cx="11.5"
        cy="28"
        rx="1.6"
        ry="2.1"
        className="hidden fill-[#ffe9bf]/45 dark:block"
      />
      {/* 肩の照り。 */}
      <path
        d="M3.6 20.2 Q4.6 17.9 7.1 16.9"
        fill="none"
        strokeWidth="0.8"
        strokeLinecap="round"
        className="stroke-white/80 dark:stroke-[#ffe2b0]/40"
      />

      {/* 口のねじ山。 */}
      <g fill="none" strokeLinecap="round">
        <path
          d="M6.6 9.6 Q18 11.2 29.4 9.6"
          strokeWidth="0.9"
          className="stroke-white/75 dark:stroke-[#ffe2b0]/35"
        />
        <path
          d="M6.6 10.5 Q18 12.1 29.4 10.5"
          strokeWidth="0.6"
          className="stroke-[#55706a]/45 dark:stroke-black/45"
        />
        <path
          d="M6.6 12.4 Q18 14 29.4 12.4"
          strokeWidth="0.9"
          className="stroke-white/70 dark:stroke-[#ffe2b0]/30"
        />
        <path
          d="M6.6 13.3 Q18 14.9 29.4 13.3"
          strokeWidth="0.6"
          className="stroke-[#55706a]/40 dark:stroke-black/40"
        />
      </g>

      <path
        d={JAR_INNER_PATH}
        fill="none"
        strokeWidth="0.55"
        className="stroke-white/55 dark:stroke-[#ffe2b0]/20"
      />
      <path
        d={JAR_OUTLINE_PATH}
        fill="none"
        strokeWidth="0.8"
        strokeLinejoin="round"
        className={`transition-[stroke] duration-(--duration-normal) ${
          held
            ? "stroke-[#5a4630] dark:stroke-[#f3d9a6]"
            : "stroke-[#7b918a]/70 dark:stroke-[#d8c4a0]/55"
        }`}
      />
      {/* 口の縁の厚み。手前の半分を前に重ねる。 */}
      <rect
        x="5.4"
        y="3.7"
        width="25.2"
        height="3.1"
        rx="1.3"
        strokeWidth="0.7"
        className={`fill-white/45 transition-[stroke] duration-(--duration-normal) dark:fill-[#ffe2b0]/10 ${
          held
            ? "stroke-[#5a4630] dark:stroke-[#f3d9a6]"
            : "stroke-[#7b918a]/70 dark:stroke-[#d8c4a0]/55"
        }`}
      />
      <path
        d="M6.4 5.6 C 8 7.1, 28 7.1, 29.6 5.6"
        fill="none"
        strokeWidth="0.6"
        className="stroke-white/80 dark:stroke-[#ffe2b0]/35"
      />
    </svg>
  );
}
