import { useLightMood } from "./light-mood";

const MOTES = [
  { x: 64, y: 140, r: 1.3, d: 14, delay: 0 },
  { x: 120, y: 92, r: 0.9, d: 18, delay: -4 },
  { x: 168, y: 210, r: 1.1, d: 16, delay: -9 },
  { x: 92, y: 300, r: 0.8, d: 20, delay: -2 },
  { x: 210, y: 150, r: 1.0, d: 15, delay: -7 },
  { x: 44, y: 250, r: 1.2, d: 19, delay: -12 },
  { x: 250, y: 260, r: 0.8, d: 17, delay: -5 },
  { x: 140, y: 380, r: 1.0, d: 21, delay: -14 },
];

/** 窓の光の落ちる4枚のガラス（左上・右上・左下・右下）。壁に斜めに映る。 */
const PANES = [
  "M-30,96 L118,58 L150,250 L-6,300 Z",
  "M134,54 L258,22 L296,196 L166,246 Z",
  "M-2,318 L154,266 L184,440 L22,506 Z",
  "M170,262 L300,212 L340,372 L200,434 Z",
];

export function LightBackground() {
  const mood = useLightMood();
  const dim = mood.kind === "dim";
  const clear = mood.kind === "clear";
  const paneOpacity = dim ? 0.3 : clear ? 0.95 : 0.78;
  return (
    <div className="relative size-full overflow-hidden bg-[#e2d1b4]">
      <style>{`
        @keyframes lightMote { 0% { transform: translate(0,0); opacity: 0 } 15% { opacity: .9 } 85% { opacity: .9 } 100% { transform: translate(46px, 60px); opacity: 0 } }
        @keyframes lightLeaf { 0%,100% { transform: rotate(0deg) } 50% { transform: rotate(2.4deg) } }
        @keyframes lightShimmer { 0%,100% { opacity: .9 } 50% { opacity: .65 } }
      `}</style>
      <svg
        aria-hidden="true"
        className="absolute inset-0 size-full"
        viewBox="0 0 390 664"
        preserveAspectRatio="xMinYMin slice"
      >
        <defs>
          <linearGradient id="lightWall" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ecdcc0" />
            <stop offset=".55" stopColor="#e2d1b4" />
            <stop offset="1" stopColor="#cdb994" />
          </linearGradient>
          <linearGradient id="lightPane" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fffaf0" />
            <stop offset="1" stopColor="#fff1d2" />
          </linearGradient>
          <linearGradient id="lightBeam" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff8e6" stopOpacity=".75" />
            <stop offset=".6" stopColor="#fff8e6" stopOpacity=".18" />
            <stop offset="1" stopColor="#fff8e6" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="lightCorner" cx="0" cy="0" r="1">
            <stop offset="0" stopColor="#fffbea" stopOpacity=".9" />
            <stop offset="1" stopColor="#fffbea" stopOpacity="0" />
          </radialGradient>
          <filter id="lightSoft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.6" />
          </filter>
          <filter id="lightSofter" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="12" />
          </filter>
        </defs>
        <rect width="390" height="664" fill="url(#lightWall)" />
        <rect width="390" height="664" fill="url(#lightCorner)" opacity=".8" />
        {/* 壁に映る窓の光。手詰まりでは光がわずかに傾いて弱まる */}
        <g
          style={{
            transformOrigin: "0px 0px",
            transform: dim ? "rotate(5deg) translate(10px, 6px)" : "none",
            transition: "transform 1.4s ease, opacity 1.4s ease",
          }}
        >
          <g filter="url(#lightSoft)">
            {PANES.map((d, i) => (
              <path
                key={d}
                d={d}
                style={{
                  fill: clear
                    ? (mood.colors[i % Math.max(1, mood.colors.length)] ??
                      "#fff6dc")
                    : "#fff6dc",
                  opacity: clear ? 0.38 : paneOpacity,
                  transition: "fill 1.2s ease, opacity 1.4s ease",
                }}
              />
            ))}
            {clear &&
              PANES.map((d) => (
                <path key={`w${d}`} d={d} fill="url(#lightPane)" opacity={0.55} />
              ))}
          </g>
          {/* 窓の外の葉の影 */}
          <g
            filter="url(#lightSofter)"
            opacity={dim ? 0.05 : 0.1}
            style={{
              transformOrigin: "260px 40px",
              animation: "lightLeaf 7s ease-in-out infinite",
            }}
          >
            <ellipse cx="236" cy="70" rx="26" ry="12" transform="rotate(-30 236 70)" fill="#4f5b3a" />
            <ellipse cx="270" cy="112" rx="22" ry="10" transform="rotate(20 270 112)" fill="#4f5b3a" />
            <ellipse cx="214" cy="120" rx="18" ry="9" transform="rotate(-60 214 120)" fill="#4f5b3a" />
          </g>
          {/* 斜めの光の筋 */}
          <g
            style={{
              opacity: dim ? 0.35 : clear ? 1 : 0.8,
              transition: "opacity 1.4s ease",
              animation: "lightShimmer 9s ease-in-out infinite",
            }}
          >
            <path d="M-40,-20 L60,-40 L420,560 L300,620 Z" fill="url(#lightBeam)" opacity=".35" filter="url(#lightSofter)" />
            <path d="M80,-40 L130,-40 L470,470 L420,500 Z" fill="url(#lightBeam)" opacity=".28" filter="url(#lightSofter)" />
          </g>
          {MOTES.map((m) => (
            <circle
              key={`${m.x}-${m.y}`}
              cx={m.x}
              cy={m.y}
              r={m.r}
              fill="#fffdf2"
              style={{
                animation: `lightMote ${m.d}s linear ${m.delay}s infinite`,
              }}
            />
          ))}
        </g>
        <rect
          width="390"
          height="664"
          fill="#2e3a4c"
          style={{ opacity: dim ? 0.08 : 0, transition: "opacity 1.4s ease" }}
        />
      </svg>
    </div>
  );
}
