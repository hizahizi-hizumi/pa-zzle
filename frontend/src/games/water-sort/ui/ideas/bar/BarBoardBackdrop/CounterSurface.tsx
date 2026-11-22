type CounterSurfaceProps = {
  width: number;
  height: number;
  /** 灯りが落ちる、奥の列のグラスの足もとの高さ（px）。 */
  lightY: number;
};

/** 暗い木目のカウンターの天板。奥の縁が酒棚の灯りを映し、手前ほど暗く沈む。 */
export function CounterSurface({ width, height, lightY }: CounterSurfaceProps) {
  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      <defs>
        <linearGradient id="bar-counter-top" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a2d1b" />
          <stop offset={Math.min(0.2, 40 / height)} stopColor="#2c1a10" />
          <stop offset="0.55" stopColor="#1b100a" />
          <stop offset="1" stopColor="#0f0906" />
        </linearGradient>
        <radialGradient id="bar-counter-light" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffb56b" stopOpacity="0.16" />
          <stop offset="1" stopColor="#ffb56b" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="bar-counter-sheen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffbf80" stopOpacity="0.22" />
          <stop offset="1" stopColor="#ffbf80" stopOpacity="0" />
        </linearGradient>
        <filter id="bar-counter-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.0035 0.11"
            numOctaves="3"
            seed="11"
          />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0.42  0 0 0 0 0.25  0 0 0 0 0.14  1.7 0 0 0 -0.72"
          />
        </filter>
        <filter
          id="bar-counter-grain-dark"
          x="0"
          y="0"
          width="100%"
          height="100%"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.006 0.2"
            numOctaves="2"
            seed="3"
          />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0.03  0 0 0 0 0.015  0 0 0 0 0.01  -1.8 0 0 0 1.05"
          />
        </filter>
      </defs>
      <rect width={width} height={height} fill="url(#bar-counter-top)" />
      <rect
        width={width}
        height={height}
        filter="url(#bar-counter-grain)"
        opacity="0.36"
      />
      <rect
        width={width}
        height={height}
        filter="url(#bar-counter-grain-dark)"
        opacity="0.45"
      />
      <rect
        width={width}
        height={Math.min(46, height)}
        fill="url(#bar-counter-sheen)"
      />
      <ellipse
        cx={width / 2}
        cy={lightY + 24}
        rx={width * 0.55}
        ry={Math.max(80, height * 0.35)}
        fill="url(#bar-counter-light)"
      />
      {/* 奥の縁。 */}
      <rect width={width} height="1" fill="#0a0604" />
      <rect y="1" width={width} height="1" fill="#a77450" opacity="0.45" />
      {/* 手前の角。 */}
      <rect
        y={height - 13}
        width={width}
        height="1"
        fill="#8a5a3a"
        opacity="0.5"
      />
      <rect
        y={height - 12}
        width={width}
        height="12"
        fill="#0a0604"
        opacity="0.85"
      />
    </svg>
  );
}
