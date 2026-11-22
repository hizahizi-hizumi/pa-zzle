import { useId } from "react";

/** 縁側の板。横に長い板を並べ、木目を重ねる。 */
export function Floor() {
  const id = useId();
  const planksId = `${id}-planks`;
  const grainId = `${id}-grain`;
  const shadeId = `${id}-shade`;

  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 size-full [--plank-a:#e2c8a0] [--plank-b:#d9bc91] [--plank-c:#dec39a] [--seam:#9a774b] [--seam-light:#f3e3c6] [--shade-near:#b38f63] [--shade-far:#ead6b3] dark:[--plank-a:#3b2d22] dark:[--plank-b:#35281e] dark:[--plank-c:#3e3025] dark:[--seam:#120d09] dark:[--seam-light:#4d3c2e] dark:[--shade-near:#16120f] dark:[--shade-far:#3e2f22]"
    >
      <defs>
        <pattern
          id={planksId}
          width="640"
          height="138"
          patternUnits="userSpaceOnUse"
        >
          <rect width="640" height="46" style={{ fill: "var(--plank-a)" }} />
          <rect
            y="46"
            width="640"
            height="46"
            style={{ fill: "var(--plank-b)" }}
          />
          <rect
            y="92"
            width="640"
            height="46"
            style={{ fill: "var(--plank-c)" }}
          />
          <g style={{ stroke: "var(--seam)" }} strokeWidth="1.4" opacity="0.8">
            <path d="M0 0.7 H640 M0 46.7 H640 M0 92.7 H640" />
            <path d="M152 0 V46 M468 46 V92 M286 92 V138 M610 92 V138" />
          </g>
          <g
            style={{ stroke: "var(--seam-light)" }}
            strokeWidth="1"
            opacity="0.55"
          >
            <path d="M0 2.2 H640 M0 48.2 H640 M0 94.2 H640" />
          </g>
        </pattern>
        <filter
          id={grainId}
          x="0"
          y="0"
          width="100%"
          height="100%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.0035 0.16"
            numOctaves="3"
            seed="11"
          />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0.33  0 0 0 0 0.2  0 0 0 0 0.08  1.9 0 0 0 -0.82"
          />
        </filter>
        <linearGradient id={shadeId} x1="0" x2="0" y1="0" y2="1">
          <stop
            offset="0"
            style={{ stopColor: "var(--shade-far)" }}
            stopOpacity="0.45"
          />
          <stop
            offset="0.45"
            style={{ stopColor: "var(--shade-far)" }}
            stopOpacity="0"
          />
          <stop
            offset="0.72"
            style={{ stopColor: "var(--shade-near)" }}
            stopOpacity="0.15"
          />
          <stop
            offset="1"
            style={{ stopColor: "var(--shade-near)" }}
            stopOpacity="1"
          />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${planksId})`} />
      <rect
        width="100%"
        height="100%"
        filter={`url(#${grainId})`}
        className="opacity-35 dark:opacity-60"
      />
      <rect width="100%" height="100%" fill={`url(#${shadeId})`} />
    </svg>
  );
}
