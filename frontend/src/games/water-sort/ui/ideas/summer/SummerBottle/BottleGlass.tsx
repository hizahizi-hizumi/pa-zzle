import { type Ref, useId } from "react";

import {
  SUMMER_BOTTLE_VIEW_BOX,
  SUMMER_LIQUID_BOX,
  type SummerBottleShape,
} from "@/games/water-sort/ui/ideas/summer/bottle-shapes";

type BottleGlassProps = {
  shape: SummerBottleShape;
  /**
   * - `back`: 色水の奥に見えるガラスの面。
   * - `front`: 色水の手前の縁・光の筋・ビー玉など。
   */
  layer: "back" | "front";
  selected?: boolean;
  /** 陽にかざしたときに、ガラスの上を走らせる光。 */
  glintRef?: Ref<SVGRectElement>;
};

const viewBox = `0 0 ${SUMMER_BOTTLE_VIEW_BOX.width} ${SUMMER_BOTTLE_VIEW_BOX.height}`;

export function BottleGlass({
  shape,
  layer,
  selected = false,
  glintRef,
}: BottleGlassProps) {
  const id = useId();
  const clipId = `${id}-clip`;
  const sheenId = `${id}-sheen`;

  if (layer === "back") {
    return (
      <svg
        viewBox={viewBox}
        className="absolute inset-0 size-full overflow-visible"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={sheenId} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
            <stop offset="0.3" stopColor={shape.glass} stopOpacity="0.4" />
            <stop offset="0.75" stopColor={shape.glass} stopOpacity="0.5" />
            <stop offset="1" stopColor={shape.edge} stopOpacity="0.55" />
          </linearGradient>
        </defs>
        <path
          d={shape.outline}
          fill={`url(#${sheenId})`}
          className="opacity-75 dark:opacity-30"
        />
      </svg>
    );
  }

  const { left, right, bottom } = SUMMER_LIQUID_BOX;

  return (
    <svg
      viewBox={viewBox}
      className="absolute inset-0 size-full overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <clipPath id={clipId}>
          <path d={shape.outline} />
        </clipPath>
      </defs>
      {/* 厚い底ガラス */}
      <path
        d={`M ${left + 1} ${bottom + 0.4} Q 18 ${bottom - 1.2} ${right - 1} ${bottom + 0.4} L ${right - 1.4} 98.4 Q 18 99.4 ${left + 1.4} 98.4 Z`}
        fill={shape.glass}
        className="opacity-70 dark:opacity-40"
      />
      <path
        d={`M ${left + 2} ${bottom + 0.6} Q 18 ${bottom - 0.6} ${right - 2} ${bottom + 0.6}`}
        fill="none"
        stroke="#ffffff"
        strokeWidth="0.7"
        strokeLinecap="round"
        className="opacity-70 dark:opacity-35"
      />
      {shape.id === "ramune" && (
        <g>
          <circle cx="18" cy="11.4" r="3.3" fill="#e9fbfa" opacity="0.55" />
          <circle
            cx="18"
            cy="11.4"
            r="3.3"
            fill="none"
            stroke={shape.edge}
            strokeWidth="0.6"
            opacity="0.8"
          />
          <circle cx="16.8" cy="10.2" r="1" fill="#ffffff" opacity="0.95" />
        </g>
      )}
      {shape.id === "jam" && (
        <g
          fill="none"
          stroke={shape.edge}
          strokeWidth="0.75"
          strokeLinecap="round"
          opacity="0.75"
        >
          <path d="M 7 5.2 Q 18 4.2 29 4.6" />
          <path d="M 7 8 Q 18 7 29 7.4" />
        </g>
      )}
      {shape.id === "milk" && (
        <path
          d="M 6.8 3.4 L 29.2 3.4"
          fill="none"
          stroke="#ffffff"
          strokeWidth="1.1"
          strokeLinecap="round"
          opacity="0.75"
        />
      )}
      {/* 陽の当たる左の光の筋と、右の照り返し */}
      <path
        d="M 6.2 31 L 6.2 90"
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinecap="round"
        className={selected ? "opacity-95" : "opacity-70 dark:opacity-40"}
      />
      <path
        d="M 9.4 34 L 9.4 58"
        stroke="#ffffff"
        strokeWidth="0.7"
        strokeLinecap="round"
        className="opacity-55 dark:opacity-30"
      />
      <path
        d="M 30.6 36 L 30.6 86"
        stroke="#ffffff"
        strokeWidth="0.6"
        strokeLinecap="round"
        className="opacity-45 dark:opacity-25"
      />
      <path
        d={shape.shoulderGlint}
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.1"
        strokeLinecap="round"
        className="opacity-80 dark:opacity-45"
      />
      <g clipPath={`url(#${clipId})`}>
        <g transform="rotate(18 18 50)">
          <rect
            ref={glintRef}
            x="-14"
            y="-10"
            width="7"
            height="130"
            fill="#fffbe8"
            opacity="0"
          />
        </g>
      </g>
      <path
        d={shape.outline}
        fill="none"
        stroke={selected ? "#ffffff" : shape.edge}
        strokeWidth={selected ? 1.5 : 1.2}
        strokeLinejoin="round"
        className={
          selected
            ? "opacity-100"
            : "opacity-85 dark:stroke-[#e9dcc0] dark:opacity-60"
        }
      />
    </svg>
  );
}
