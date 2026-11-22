import {
  BACK_BAR_BOTTLES,
  BACK_BAR_SHELF_YS,
  type BackBarBottleTint,
} from "@/games/water-sort/ui/ideas/bar/back-bar-bottles";

const bottleTintColors: Record<
  BackBarBottleTint,
  { edge: string; core: string }
> = {
  amber: { edge: "#2a1406", core: "#c9761f" },
  green: { edge: "#0c1a0c", core: "#4f7d2e" },
  clear: { edge: "#2a2420", core: "#b9a68c" },
  ruby: { edge: "#200608", core: "#8c2a26" },
  smoke: { edge: "#141010", core: "#5a4a40" },
};

/** 背後の木漏れのような灯りのぼけ（地の SVG の座標）。 */
const bokehLights = [
  { x: 140, y: 120, r: 26, color: "#ffb560", opacity: 0.22 },
  { x: 330, y: 270, r: 18, color: "#ffd08a", opacity: 0.18 },
  { x: 520, y: 90, r: 30, color: "#ff9e4a", opacity: 0.16 },
  { x: 700, y: 300, r: 22, color: "#ffc070", opacity: 0.2 },
  { x: 860, y: 150, r: 34, color: "#ffa955", opacity: 0.14 },
  { x: 1040, y: 280, r: 20, color: "#9fd6d0", opacity: 0.1 },
  { x: 960, y: 460, r: 26, color: "#ffb867", opacity: 0.14 },
  { x: 240, y: 470, r: 24, color: "#ffb867", opacity: 0.12 },
  { x: 610, y: 450, r: 16, color: "#ffe0a8", opacity: 0.16 },
] as const;

/**
 * 開店前のバーの奥。逆光の酒棚を地の奥にぼかして置き、盤面より目立たせない。
 * カウンターは盤面のグラスの位置に合わせて `BarBoardBackdrop` が描く。
 */
export function BarGround() {
  return (
    <div className="relative size-full overflow-hidden bg-[#0c0705]">
      <svg
        aria-hidden="true"
        className="absolute inset-0 size-full"
        viewBox="0 0 1200 900"
        preserveAspectRatio="xMidYMin slice"
      >
        <defs>
          <linearGradient id="bar-ground-wall" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#120a07" />
            <stop offset="0.35" stopColor="#1d120c" />
            <stop offset="0.62" stopColor="#140c08" />
            <stop offset="1" stopColor="#0c0705" />
          </linearGradient>
          <linearGradient id="bar-ground-wash" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ff9d4a" stopOpacity="0" />
            <stop offset="1" stopColor="#ff9d4a" stopOpacity="0.26" />
          </linearGradient>
          {Object.entries(bottleTintColors).map(([tint, { edge, core }]) => (
            <linearGradient
              key={tint}
              id={`bar-ground-bottle-${tint}`}
              x1="0"
              y1="0"
              x2="1"
              y2="0"
            >
              <stop offset="0" stopColor={edge} />
              <stop offset="0.45" stopColor={core} />
              <stop offset="0.6" stopColor={core} />
              <stop offset="1" stopColor={edge} />
            </linearGradient>
          ))}
          <radialGradient id="bar-ground-vignette" cx="0.5" cy="0.38" r="0.75">
            <stop offset="0.4" stopColor="#000000" stopOpacity="0" />
            <stop offset="1" stopColor="#000000" stopOpacity="0.7" />
          </radialGradient>
          <linearGradient id="bar-ground-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0c0705" stopOpacity="0.92" />
            <stop offset="0.1" stopColor="#0c0705" stopOpacity="0.7" />
            <stop offset="0.2" stopColor="#0c0705" stopOpacity="0" />
            <stop offset="0.6" stopColor="#0c0705" stopOpacity="0" />
            <stop offset="0.82" stopColor="#0c0705" stopOpacity="0.9" />
            <stop offset="1" stopColor="#0c0705" stopOpacity="1" />
          </linearGradient>
          <filter
            id="bar-ground-soft"
            x="-5%"
            y="-5%"
            width="110%"
            height="110%"
          >
            <feGaussianBlur stdDeviation="4.5" />
          </filter>
          <filter
            id="bar-ground-glow"
            x="-20%"
            y="-200%"
            width="140%"
            height="500%"
          >
            <feGaussianBlur stdDeviation="9" />
          </filter>
          <filter
            id="bar-ground-bokeh-blur"
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
          >
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>
        <rect width="1200" height="900" fill="url(#bar-ground-wall)" />
        <g opacity="0.5" filter="url(#bar-ground-soft)">
          {BACK_BAR_SHELF_YS.map((shelfY) => (
            <rect
              key={`wash-${shelfY}`}
              x="0"
              y={shelfY - 175}
              width="1200"
              height="175"
              fill="url(#bar-ground-wash)"
            />
          ))}
          {BACK_BAR_BOTTLES.map((bottle) => (
            <path
              key={bottle.path}
              d={bottle.path}
              fill={`url(#bar-ground-bottle-${bottle.tint})`}
              stroke="#ffc583"
              strokeOpacity="0.28"
              strokeWidth="1.5"
            />
          ))}
          {BACK_BAR_SHELF_YS.map((shelfY) => (
            <g key={`shelf-${shelfY}`}>
              <rect
                x="0"
                y={shelfY - 3}
                width="1200"
                height="8"
                fill="#2c1b11"
              />
              <rect
                x="0"
                y={shelfY - 3}
                width="1200"
                height="1.5"
                fill="#6b4630"
              />
            </g>
          ))}
        </g>
        <g filter="url(#bar-ground-glow)">
          {BACK_BAR_SHELF_YS.map((shelfY) => (
            <rect
              key={`led-${shelfY}`}
              x="0"
              y={shelfY + 5}
              width="1200"
              height="5"
              fill="#ffb366"
              opacity="0.42"
            />
          ))}
        </g>
        <g filter="url(#bar-ground-bokeh-blur)">
          {bokehLights.map((light) => (
            <circle
              key={`${light.x}-${light.y}`}
              cx={light.x}
              cy={light.y}
              r={light.r}
              fill={light.color}
              opacity={light.opacity}
            />
          ))}
        </g>
        <rect width="1200" height="900" fill="url(#bar-ground-vignette)" />
        <rect width="1200" height="900" fill="url(#bar-ground-fade)" />
      </svg>
    </div>
  );
}
