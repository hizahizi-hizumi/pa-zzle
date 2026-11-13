// 試作 bench の地: 窓のある古い理科室。白いタイルの壁と、使い込んだ木の実験台の天板。光は左上の窓から。
import { memo, type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { useBenchScene } from "@/games/water-sort/ui/prototypes/bench/scene-store";

type Size = { w: number; h: number };

export function BenchBackground() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size | null>(null);
  const scene = useBenchScene();

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      const rect = element.getBoundingClientRect();
      setSize({ w: rect.width, h: rect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const horizon =
    scene.horizonY ?? (size ? Math.round(size.h * 0.74) : 480);

  return (
    <div ref={ref} className="relative size-full overflow-hidden bg-[#e9ebe8]">
      {size && (
        <Room
          w={size.w}
          h={size.h}
          horizon={Math.round(horizon)}
          windowBottom={Math.round(scene.windowBottomY ?? horizon - 90)}
        />
      )}
      {/* 窓から差す光。手詰まりで陰り、完成で満ちる。 */}
      {size && (
        <div
          className="absolute inset-0"
          style={{
            opacity: scene.dimmed ? 0.08 : scene.cleared ? 0.95 : 0.42,
            transition: "opacity 1100ms ease",
            mixBlendMode: "screen",
          }}
        >
          <Beams w={size.w} h={size.h} horizon={Math.round(horizon)} />
        </div>
      )}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(28,38,56,.34) 0%, rgba(28,38,56,.2) 55%, rgba(28,38,56,.06) 100%)",
          opacity: scene.dimmed ? 1 : 0,
          transition: "opacity 1100ms ease",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(70% 45% at 50% ${horizon - 120}px, rgba(255,214,140,.6), rgba(255,214,140,0) 72%), linear-gradient(180deg, rgba(255,226,170,.42), rgba(255,200,130,.26))`,
          opacity: scene.cleared ? 1 : 0,
          transition: "opacity 1400ms ease",
          mixBlendMode: "soft-light",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(60% 40% at 50% ${horizon - 110}px, rgba(255,238,198,.62), rgba(255,238,198,0) 72%)`,
          opacity: scene.cleared ? 1 : 0,
          transition: "opacity 1600ms ease",
          mixBlendMode: "screen",
        }}
      />
    </div>
  );
}

type RoomProps = { w: number; h: number; horizon: number; windowBottom: number };

const TILE = 46;

const Room = memo(function Room({ w, h, horizon, windowBottom }: RoomProps) {
  const winW = Math.min(196, Math.round(w * 0.42));
  const winX = -14;
  // 窓は見出しの下から始め、戻るボタンが窓枠の桟に重ならないようにする。
  // 窓の下枠と窓台は、上の段の下の板の裏に隠す。空の管に横の帯が透けて液の境に見えないように。
  const winY = 96;
  const winH = Math.max(60, windowBottom - winY);
  const sillY = winY + winH;
  const benchH = h - horizon;
  // 板の継ぎ目: 手前ほど間が広い（見下ろした天板）。
  const seams: number[] = [];
  let y = horizon + 10;
  let gap = 22;
  while (y < h + 40) {
    y += gap;
    seams.push(y);
    gap *= 1.42;
  }
  const tileRowsTop = (horizon - 14) % TILE;

  return (
    <svg
      width={w}
      height={h}
      className="absolute inset-0"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="bg-tile" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".6" stopColor="#f3f4f1" />
          <stop offset="1" stopColor="#e7e9e5" />
        </linearGradient>
        <linearGradient id="bg-tile-b" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#fbfbf8" />
          <stop offset=".6" stopColor="#eef0ec" />
          <stop offset="1" stopColor="#e3e5e0" />
        </linearGradient>
        <pattern
          id="bg-tiles"
          width={TILE * 2}
          height={TILE * 2}
          patternUnits="userSpaceOnUse"
          y={tileRowsTop}
          x={(w / 2) % TILE}
        >
          <rect width={TILE * 2} height={TILE * 2} fill="#c9cecb" />
          {[0, 1].map((r) =>
            [0, 1].map((c) => (
              <g key={`${r}${c}`}>
                <rect
                  x={c * TILE + 1}
                  y={r * TILE + 1}
                  width={TILE - 2}
                  height={TILE - 2}
                  rx={2.5}
                  fill={(r + c) % 2 ? "url(#bg-tile-b)" : "url(#bg-tile)"}
                />
                <path
                  d={`M${c * TILE + 3},${r * TILE + TILE - 4} L${c * TILE + 3},${r * TILE + 3} L${c * TILE + TILE - 4},${r * TILE + 3}`}
                  stroke="#fff"
                  strokeWidth={1.4}
                  fill="none"
                  opacity={0.9}
                />
                <path
                  d={`M${c * TILE + 4},${r * TILE + TILE - 1.6} L${c * TILE + TILE - 1.6},${r * TILE + TILE - 1.6} L${c * TILE + TILE - 1.6},${r * TILE + 4}`}
                  stroke="#b9bfbb"
                  strokeWidth={1}
                  fill="none"
                  opacity={0.7}
                />
                <ellipse
                  cx={c * TILE + TILE * 0.32}
                  cy={r * TILE + TILE * 0.28}
                  rx={TILE * 0.18}
                  ry={TILE * 0.08}
                  fill="#fff"
                  opacity={0.5}
                  transform={`rotate(-30 ${c * TILE + TILE * 0.32} ${r * TILE + TILE * 0.28})`}
                />
              </g>
            )),
          )}
        </pattern>
        <linearGradient id="bg-wall-shade" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fff8e8" stopOpacity=".28" />
          <stop offset=".45" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="1" stopColor="#5b6670" stopOpacity=".16" />
        </linearGradient>
        <linearGradient id="bg-wall-floor" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#5b6670" stopOpacity="0" />
          <stop offset=".75" stopColor="#5b6670" stopOpacity=".05" />
          <stop offset="1" stopColor="#3a2a1a" stopOpacity=".2" />
        </linearGradient>
        <linearGradient id="bg-sky" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#9fcbe6" />
          <stop offset=".55" stopColor="#d6e8ee" />
          <stop offset="1" stopColor="#f6efd9" />
        </linearGradient>
        <filter id="bg-soft" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <filter id="bg-soft2" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
        <linearGradient id="bg-frame" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#f1ede1" />
          <stop offset="1" stopColor="#d9d3c3" />
        </linearGradient>
        <linearGradient id="bg-bench" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#6f4626" />
          <stop offset=".2" stopColor="#8f6138" />
          <stop offset=".6" stopColor="#a8784a" />
          <stop offset="1" stopColor="#b88857" />
        </linearGradient>
        <linearGradient id="bg-bench-light" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fff0cc" stopOpacity=".22" />
          <stop offset=".5" stopColor="#fff0cc" stopOpacity=".05" />
          <stop offset="1" stopColor="#2a1606" stopOpacity=".18" />
        </linearGradient>
        <filter id="bg-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.0035 0.11"
            numOctaves="4"
            seed="21"
            result="n"
          />
          <feColorMatrix
            in="n"
            type="matrix"
            values="0 0 0 0 0.24  0 0 0 0 0.13  0 0 0 0 0.04  0 0 0 2.6 -1.05"
            result="c"
          />
          <feComposite in="c" in2="SourceAlpha" operator="in" />
        </filter>
        <filter id="bg-grain-fine" x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.02 0.6"
            numOctaves="2"
            seed="5"
            result="n"
          />
          <feColorMatrix
            in="n"
            type="matrix"
            values="0 0 0 0 1  0 0 0 0 0.9  0 0 0 0 0.75  0 0 0 1.6 -0.9"
            result="c"
          />
          <feComposite in="c" in2="SourceAlpha" operator="in" />
        </filter>
        <clipPath id="bg-bench-clip">
          <rect x={0} y={horizon} width={w} height={benchH} />
        </clipPath>
      </defs>

      {/* 壁 */}
      <rect width={w} height={horizon} fill="url(#bg-tiles)" />
      {/* 古いタイル: 欠けと染み */}
      <g opacity={0.9}>
        <rect
          x={Math.round(w * 0.78 / TILE) * TILE + ((w / 2) % TILE) + 1 - TILE}
          y={tileRowsTop + TILE * 2 + 1}
          width={TILE - 2}
          height={TILE - 2}
          rx={2.5}
          fill="#e9e6da"
        />

        <ellipse
          cx={w * 0.62}
          cy={horizon - 10}
          rx={30}
          ry={8}
          fill="#c9b89a"
          opacity={0.25}
          filter="url(#bg-soft2)"
        />
      </g>
      <rect width={w} height={horizon} fill="url(#bg-wall-shade)" />
      <rect width={w} height={horizon} fill="url(#bg-wall-floor)" />

      {/* 窓 */}
      <g>
        {/* 壁の厚み（窓の右の側面） */}
        <path
          d={`M${winX + winW},${winY} L${winX + winW + 12},${winY + 10} L${winX + winW + 12},${sillY - 2} L${winX + winW},${sillY}`}
          fill="#d8d6cc"
        />
        <rect
          x={winX - 6}
          y={winY - 6}
          width={winW + 12}
          height={winH + 12}
          fill="#bfbcb0"
          opacity={0.5}
        />
        <rect x={winX} y={winY} width={winW} height={winH} fill="url(#bg-sky)" />
        {/* 外の木立 */}
        <g filter="url(#bg-soft)">
          <ellipse
            cx={winX + winW * 0.25}
            cy={winY + winH * 0.86}
            rx={winW * 0.36}
            ry={winH * 0.2}
            fill="#93b97e"
            opacity={0.85}
          />
          <ellipse
            cx={winX + winW * 0.7}
            cy={winY + winH * 0.94}
            rx={winW * 0.42}
            ry={winH * 0.18}
            fill="#7ea66c"
            opacity={0.8}
          />
          <ellipse
            cx={winX + winW * 0.55}
            cy={winY + winH * 0.6}
            rx={winW * 0.2}
            ry={winH * 0.14}
            fill="#a9c995"
            opacity={0.55}
          />
          <ellipse
            cx={winX + winW * 0.18}
            cy={winY + winH * 0.25}
            rx={winW * 0.3}
            ry={winH * 0.12}
            fill="#ffffff"
            opacity={0.6}
          />
        </g>
        {/* ガラスの映り込み */}
        <path
          d={`M${winX + winW * 0.15},${winY + winH} L${winX + winW * 0.55},${winY} L${winX + winW * 0.68},${winY} L${winX + winW * 0.28},${winY + winH} Z`}
          fill="#fff"
          opacity={0.16}
        />
        {/* 窓枠 */}
        {(() => {
          const f = 9;
          const cols = 1;
          const rows = 1;
          const parts: ReactNode[] = [];
          parts.push(
            <path
              key="outer"
              fillRule="evenodd"
              d={`M${winX - f},${winY - f} h${winW + f * 2} v${winH + f * 2} h${-(winW + f * 2)} Z M${winX},${winY} v${winH} h${winW} v${-winH} Z`}
              fill="url(#bg-frame)"
              stroke="#b3ad9c"
              strokeWidth={1}
            />,
          );
          for (let c = 1; c < cols; c++) {
            const x = winX + (winW * c) / cols;
            parts.push(
              <rect
                key={`mc${c}`}
                x={x - 3.5}
                y={winY}
                width={7}
                height={winH}
                fill="url(#bg-frame)"
                stroke="#b3ad9c"
                strokeWidth={0.8}
              />,
            );
          }
          for (let r = 1; r < rows; r++) {
            const yy = winY + (winH * r) / rows;
            parts.push(
              <rect
                key={`mr${r}`}
                x={winX}
                y={yy - 3}
                width={winW}
                height={6}
                fill="#e6e1d3"
              />,
              <rect
                key={`ms${r}`}
                x={winX}
                y={yy + 3}
                width={winW}
                height={1.5}
                fill="#000"
                opacity={0.08}
              />,
            );
          }
          parts.push(
            <rect
              key="inner-shadow"
              x={winX}
              y={winY}
              width={winW}
              height={4}
              fill="#000"
              opacity={0.08}
            />,
          );
          return parts;
        })()}
        {/* 窓台 */}
        <rect
          x={winX - 18}
          y={sillY + 5}
          width={winW + 40}
          height={9}
          rx={2}
          fill="#efeadc"
        />
        <rect
          x={winX - 18}
          y={sillY + 14}
          width={winW + 40}
          height={5}
          fill="#cfc8b6"
        />
        <rect
          x={winX - 14}
          y={sillY + 19}
          width={winW + 34}
          height={8}
          fill="#5b6670"
          opacity={0.16}
          filter="url(#bg-soft2)"
        />
      </g>

      {/* 壁と台の境: 台の奥の立ち上がり */}
      <rect x={0} y={horizon - 16} width={w} height={16} fill="#7d5532" />
      <rect
        x={0}
        y={horizon - 16}
        width={w}
        height={16}
        fill="#000"
        filter="url(#bg-grain)"
        opacity={0.5}
      />
      <rect x={0} y={horizon - 16} width={w} height={1.5} fill="#c79d6c" />
      <rect
        x={0}
        y={horizon - 26}
        width={w}
        height={10}
        fill="#3a2a1a"
        opacity={0.1}
        filter="url(#bg-soft2)"
      />

      {/* 台の天板 */}
      <g clipPath="url(#bg-bench-clip)">
        <rect x={0} y={horizon} width={w} height={benchH} fill="url(#bg-bench)" />
        <rect
          x={0}
          y={horizon}
          width={w}
          height={benchH}
          fill="#000"
          filter="url(#bg-grain)"
          opacity={0.75}
        />
        <rect
          x={0}
          y={horizon}
          width={w}
          height={benchH}
          fill="#000"
          filter="url(#bg-grain-fine)"
          opacity={0.25}
        />
        {seams.map((sy, i) => (
          <g key={sy}>
            <rect
              x={0}
              y={sy}
              width={w}
              height={1.2 + i * 0.3}
              fill="#4a2c12"
              opacity={0.55}
            />
            <rect
              x={0}
              y={sy + 1.2 + i * 0.3}
              width={w}
              height={1}
              fill="#e8c393"
              opacity={0.35}
            />
            {/* 継ぎ目をずらした板の端 */}
            <rect
              x={((i * 0.37 + 0.21) % 1) * w}
              y={seams[i - 1] ?? horizon}
              width={1.2}
              height={sy - (seams[i - 1] ?? horizon)}
              fill="#4a2c12"
              opacity={0.4}
            />
          </g>
        ))}
        <rect
          x={0}
          y={horizon}
          width={w}
          height={benchH}
          fill="url(#bg-bench-light)"
        />
        {/* 使い込んだ跡: 輪じみ・薬品の染み・擦り傷 */}
        <ellipse
          cx={w * 0.82}
          cy={horizon + benchH * 0.62}
          rx={22}
          ry={6}
          fill="none"
          stroke="#4a2c12"
          strokeWidth={1.6}
          opacity={0.22}
        />
        <ellipse
          cx={w * 0.8}
          cy={horizon + benchH * 0.66}
          rx={19}
          ry={5}
          fill="none"
          stroke="#4a2c12"
          strokeWidth={1}
          opacity={0.14}
        />
        <ellipse
          cx={w * 0.14}
          cy={horizon + benchH * 0.8}
          rx={14}
          ry={4}
          fill="#2a1a2e"
          opacity={0.18}
          filter="url(#bg-soft2)"
        />
        <ellipse
          cx={w * 0.4}
          cy={horizon + benchH * 0.92}
          rx={30}
          ry={5}
          fill="#3a5a3a"
          opacity={0.08}
          filter="url(#bg-soft2)"
        />
        {[
          [0.06, 0.4, 60, -3],
          [0.55, 0.5, 44, 2],
          [0.68, 0.84, 70, -1],
          [0.22, 0.6, 30, 4],
          [0.9, 0.3, 36, -2],
        ].map(([x, yy, len, rot]) => (
          <path
            key={`${x}${yy}`}
            d={`M${(x as number) * w},${horizon + (yy as number) * benchH} l${len},${rot}`}
            stroke="#f6dcb4"
            strokeWidth={0.8}
            opacity={0.3}
          />
        ))}
        {/* 窓の光が天板に落ちた所 */}
        <path
          d={`M${w * 0.02},${horizon + benchH * 0.18} L${w * 0.32},${horizon + benchH * 0.14} L${w * 0.44},${horizon + benchH * 0.62} L${w * 0.06},${horizon + benchH * 0.72} Z`}
          fill="#fff3cf"
          opacity={0.16}
          filter="url(#bg-soft)"
        />
        {/* 天板の奥の陰 */}
        <rect
          x={0}
          y={horizon}
          width={w}
          height={14}
          fill="#2a1606"
          opacity={0.3}
          filter="url(#bg-soft2)"
        />
      </g>
    </svg>
  );
});

type BeamsProps = { w: number; h: number; horizon: number };

const Beams = memo(function Beams({ w, h, horizon }: BeamsProps) {
  const winW = Math.min(196, Math.round(w * 0.42));
  return (
    <svg width={w} height={h} className="absolute inset-0" aria-hidden="true">
      <defs>
        <linearGradient id="bg-beam" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#fff2cc" stopOpacity=".55" />
          <stop offset=".6" stopColor="#fff2cc" stopOpacity=".14" />
          <stop offset="1" stopColor="#fff2cc" stopOpacity="0" />
        </linearGradient>
        <filter id="bg-beam-soft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="10" />
        </filter>
      </defs>
      <g filter="url(#bg-beam-soft)">
        <path
          d={`M${winW * 0.1},96 L${winW * 0.75},96 L${w * 0.95},${horizon + 40} L${w * 0.45},${horizon + 90} Z`}
          fill="url(#bg-beam)"
          opacity={0.55}
        />
        <path
          d={`M${winW * 0.55},96 L${winW * 0.85},96 L${w * 1.05},${horizon - 40} L${w * 0.8},${horizon} Z`}
          fill="url(#bg-beam)"
          opacity={0.45}
        />
        <path
          d={`M${winW * 0.9},${h * 0.2} L${winW * 1.05},96 L${w * 0.75},${h} L${w * 0.45},${h} Z`}
          fill="url(#bg-beam)"
          opacity={0.25}
        />
      </g>
    </svg>
  );
});
