import { useId } from "react";

/** 軒から下ろしたすだれ。外の光が、竹ひごの隙間から透ける。 */
export function Sudare() {
  const id = useId();
  const slatsId = `${id}-slats`;
  const knotsId = `${id}-knots`;
  const lightId = `${id}-light`;

  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 size-full [--gap:#fbf3d9] [--slat:#d8c28c] [--slat-dark:#c1a66d] [--cord:#7b5a32] [--sky:#fff6dc] dark:[--gap:#2c3047] dark:[--slat:#2b241e] dark:[--slat-dark:#221c17] dark:[--cord:#0f0b08] dark:[--sky:#3b4466]"
    >
      <defs>
        <pattern
          id={slatsId}
          width="240"
          height="4"
          patternUnits="userSpaceOnUse"
        >
          <rect width="240" height="4" style={{ fill: "var(--gap)" }} />
          <rect
            y="0.5"
            width="240"
            height="2.8"
            style={{ fill: "var(--slat)" }}
          />
          <rect
            x="40"
            y="0.5"
            width="70"
            height="2.8"
            style={{ fill: "var(--slat-dark)" }}
            opacity="0.5"
          />
          <rect
            x="170"
            y="0.5"
            width="46"
            height="2.8"
            style={{ fill: "var(--slat-dark)" }}
            opacity="0.35"
          />
        </pattern>
        <pattern
          id={knotsId}
          width="76"
          height="12"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M37 0 V12"
            style={{ stroke: "var(--cord)" }}
            strokeWidth="1.1"
            opacity="0.55"
          />
          <path
            d="M35.4 2 L38.6 5 M38.6 2 L35.4 5"
            style={{ stroke: "var(--cord)" }}
            strokeWidth="0.9"
            opacity="0.6"
          />
        </pattern>
        <radialGradient id={lightId} cx="0.2" cy="0.4" r="0.9">
          <stop
            offset="0"
            style={{ stopColor: "var(--sky)" }}
            stopOpacity="0.55"
          />
          <stop
            offset="1"
            style={{ stopColor: "var(--sky)" }}
            stopOpacity="0"
          />
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${slatsId})`} />
      <rect width="100%" height="100%" fill={`url(#${lightId})`} />
      <rect width="100%" height="100%" fill={`url(#${knotsId})`} />
    </svg>
  );
}
