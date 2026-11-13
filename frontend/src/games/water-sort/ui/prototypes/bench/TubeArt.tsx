// 試作 bench の試験管1本（立てた姿、局所座標）。液・ガラス・コルク。
import { liquidFill } from "@/games/water-sort/ui/prototypes/bench/BenchDefs";
import {
  BOTTOM,
  CAVITY_D,
  levelY,
  OUTER_D,
} from "@/games/water-sort/ui/prototypes/bench/geometry";
import { liquidPaint } from "@/games/water-sort/ui/prototypes/bench/paint";

export type LiquidSegment = { color: number; units: number };

export type TubeArtProps = {
  segments: readonly LiquidSegment[];
  /** 液面の揺れの大きさ。 */
  wave?: number;
  /** 揺れの位相（ミリ秒）。 */
  time?: number;
  /** 同じ色が重なった所の、消えていく境の線。高さは単位、強さは 0〜1。 */
  fadingBoundary?: { units: number; strength: number } | null;
  /** 注がれる筋が液面に当たる輪。 */
  splash?: number;
  /** 口から液面へ落ちる筋。 */
  inflow?: { x: number; width: number; color: number } | null;
  /** コルク。dy は栓が座る所からの上へのずれ（単位）、squash は押し込みのつぶれ。 */
  cork?: { dy: number; squash: number; opacity: number } | null;
  /** 済んだ試験管として、ガラスに色をにじませる。 */
  done?: boolean;
  /** きらめき 0〜1。 */
  glint?: number;
  /** 光が当たっている強さ 0〜1（完成の光の帯）。 */
  shine?: number;
};

function wavyPath(
  cx: number,
  y: number,
  rx: number,
  ry: number,
  amp: number,
  phase: number,
  front: boolean,
) {
  let d = "";
  for (let x = -rx; x <= rx + 0.01; x += 2) {
    const e = Math.sqrt(Math.max(0, 1 - (x / rx) ** 2)) * ry;
    const yy = y + (front ? e : -e) + Math.sin(x * 0.45 + phase) * amp;
    d += `${d ? " L" : "M"}${(cx + x).toFixed(2)},${yy.toFixed(2)}`;
  }
  return d;
}

export function TubeArt({
  segments,
  wave = 0,
  time = 0,
  fadingBoundary = null,
  splash = 0,
  inflow = null,
  cork = null,
  done = false,
  glint = 0,
  shine = 0,
}: TubeArtProps) {
  let units = 0;
  const bands = segments
    .filter((s) => s.units > 0.001)
    .map((s) => {
      const from = units;
      units += s.units;
      return { ...s, from, to: units };
    });
  const top = bands[bands.length - 1];
  const phase = time / 140;
  const firstColor = bands[0]?.color;

  return (
    <g>
      {/* 液 */}
      <g clipPath="url(#bn-cavity)">
        {bands.map((b) => {
          const y1 = levelY(b.to);
          const y2 = b.from === 0 ? BOTTOM + 2 : levelY(b.from) + 0.6;
          return (
            <rect
              key={`${b.from}-${b.color}`}
              x={-24}
              y={y1}
              width={48}
              height={Math.max(0, y2 - y1)}
              fill={liquidFill(b.color)}
            />
          );
        })}
        {done && firstColor !== undefined && (
          <rect
            x={-24}
            y={levelY(4)}
            width={48}
            height={150}
            fill="#fff"
            opacity={0.1}
          />
        )}
        {/* 層の境: 細く光る液面の線 */}
        {bands.slice(0, -1).map((b) => {
          const y = levelY(b.to);
          const p = liquidPaint(b.color);
          return (
            <g key={`b${b.to}`}>
              <path
                d={`M-22,${y} A22,3 0 0 1 22,${y}`}
                stroke={p.rim}
                strokeWidth={0.8}
                fill="none"
                opacity={0.6}
              />
              <path
                d={`M-22,${y} A22,3 0 0 0 22,${y}`}
                stroke="#fff"
                strokeWidth={2.6}
                fill="none"
                opacity={0.22}
              />
              <path
                d={`M-22,${y} A22,3 0 0 0 22,${y}`}
                stroke="#fff"
                strokeWidth={1}
                fill="none"
                opacity={0.95}
              />
            </g>
          );
        })}
        {fadingBoundary && fadingBoundary.strength > 0.01 && (
          <path
            d={wavyPath(
              0,
              levelY(fadingBoundary.units),
              22,
              3,
              (1 - fadingBoundary.strength) * 2.6 + 0.4,
              phase * 1.4,
              true,
            )}
            stroke="#fff"
            strokeWidth={1}
            fill="none"
            opacity={fadingBoundary.strength}
          />
        )}
        {inflow && top && (
          <rect
            x={inflow.x - inflow.width / 2}
            y={0}
            width={inflow.width}
            height={Math.max(0, levelY(top.to) + 1)}
            fill={liquidPaint(inflow.color).base}
          />
        )}
        {inflow && !top && (
          <rect
            x={inflow.x - inflow.width / 2}
            y={0}
            width={inflow.width}
            height={BOTTOM}
            fill={liquidPaint(inflow.color).base}
          />
        )}
        {/* 円筒の陰影 */}
        <rect x={-22} y={0} width={44} height={200} fill="url(#bn-cyl)" />
        {/* 液面 */}
        {top &&
          (() => {
            const y = levelY(top.to);
            const p = liquidPaint(top.color);
            const surface = done ? p.rim : p.surface;
            if (wave > 0.05) {
              const back = wavyPath(0, y, 23, 3.4, wave, phase, false);
              const front = wavyPath(0, y, 23, 3.4, wave, phase + 1, true);
              return (
                <g>
                  <path
                    d={`${back} L${front
                      .slice(1)
                      .split(" L")
                      .reverse()
                      .join(" L")} Z`}
                    fill={surface}
                    opacity={0.95}
                  />
                  <path
                    d={front}
                    stroke="#fff"
                    strokeWidth={1}
                    fill="none"
                    opacity={0.85}
                  />
                </g>
              );
            }
            return (
              <g>
                <ellipse cx={0} cy={y} rx={23} ry={3.4} fill={surface} />
                <path
                  d={`M-22,${y} A22,3.4 0 0 0 22,${y}`}
                  stroke="#fff"
                  strokeWidth={1}
                  fill="none"
                  opacity={0.9}
                />
                <path
                  d={`M-15,${y - 1.2} A16,2 0 0 1 4,${y - 2.6}`}
                  stroke="#fff"
                  strokeWidth={0.8}
                  fill="none"
                  opacity={0.55}
                />
              </g>
            );
          })()}
        {splash > 0.02 && top && (
          <g opacity={splash}>
            <ellipse
              cx={(inflow?.x ?? 0) + 1}
              cy={levelY(top.to) + 0.5}
              rx={5 + 8 * splash}
              ry={1.4 + 1.4 * splash}
              fill="none"
              stroke="#fff"
              strokeWidth={0.9}
              opacity={0.8}
            />
            <ellipse
              cx={(inflow?.x ?? 0) + 1}
              cy={levelY(top.to) + 0.8}
              rx={9 + 12 * splash}
              ry={2 + 2 * splash}
              fill="none"
              stroke="#fff"
              strokeWidth={0.6}
              opacity={0.45}
            />
          </g>
        )}
      </g>

      {/* ガラス */}
      <path
        d={OUTER_D}
        fill="url(#bn-glass)"
        stroke="rgba(70,88,108,.5)"
        strokeWidth={1}
      />
      <path
        d={CAVITY_D}
        fill="none"
        stroke="rgba(255,255,255,.5)"
        strokeWidth={0.8}
      />
      <rect
        x={-19.6}
        y={14}
        width={4.4}
        height={160}
        rx={2.2}
        fill="url(#bn-hl)"
      />
      <path
        d="M-24.3,10 L-24.3,172 A24.3,24.3 0 0 0 -14,193"
        stroke="#fff"
        strokeWidth={0.9}
        fill="none"
        opacity={0.75}
      />
      <rect
        x={15.6}
        y={20}
        width={1.6}
        height={146}
        rx={0.8}
        fill="#fff"
        opacity={0.3}
      />
      <path
        d="M-12,188 A20,20 0 0 0 6,190"
        stroke="#fff"
        strokeWidth={1.4}
        fill="none"
        opacity={0.5}
      />
      {done && firstColor !== undefined && (
        <path
          d={OUTER_D}
          fill="none"
          stroke={liquidPaint(firstColor).base}
          strokeWidth={4}
          opacity={0.45}
        />
      )}
      {/* 口の縁 */}
      <ellipse
        cx={0}
        cy={4}
        rx={28.5}
        ry={5.2}
        fill="rgba(255,255,255,.38)"
        stroke="rgba(70,88,108,.55)"
        strokeWidth={1}
      />
      {cork && <CorkBody {...cork} seal={done ? firstColor : undefined} />}
      <path
        d="M-28.5,4 L-28.5,6.5 A28.5,5.2 0 0 0 28.5,6.5 L28.5,4 A28.5,5.2 0 0 1 -28.5,4"
        fill={`rgba(222,234,244,${cork ? 0.3 : 0.58})`}
        stroke="rgba(70,88,108,.48)"
        strokeWidth={0.8}
      />
      {cork ? (
        <CorkTop {...cork} seal={done ? firstColor : undefined} />
      ) : (
        <ellipse
          cx={0}
          cy={4}
          rx={23.5}
          ry={3.6}
          fill="rgba(60,80,104,.16)"
          stroke="rgba(255,255,255,.75)"
          strokeWidth={0.8}
        />
      )}
      <path
        d="M-25,2.2 A27,4.2 0 0 1 -4,-0.6"
        stroke="#fff"
        strokeWidth={1.2}
        fill="none"
        opacity={0.9}
      />
      {shine > 0.01 && (
        <g opacity={shine}>
          <path
            d={OUTER_D}
            fill="none"
            stroke="#fffbe8"
            strokeWidth={2.2}
            opacity={0.9}
          />
          <rect
            x={-20}
            y={10}
            width={9}
            height={170}
            rx={4.5}
            fill="#fff"
            opacity={0.55}
          />
        </g>
      )}
      {glint > 0.01 && (
        <g opacity={glint}>
          <circle cx={-17} cy={44} r={11} fill="url(#bn-sparkle)" />
          <path
            d="M-17,31 L-15.8,43 L-17,57 L-18.2,43 Z M-30,44 L-18,42.8 L-4,44 L-18,45.2 Z"
            fill="#fff"
          />
        </g>
      )}
    </g>
  );
}

type CorkProps = {
  dy: number;
  squash: number;
  opacity: number;
  /** 済んだ管の栓にかぶせる封蝋の色。木の色の立てと台の中で、済んだ管を一目で分けるため。 */
  seal?: number;
};

function CorkBody({ dy, squash, opacity, seal }: CorkProps) {
  const top = -13 - dy + squash * 2;
  const bottom = 14 - dy;
  const d = `M-21.5,${top} L-19.6,${bottom} Q0,${bottom + 3.5} 19.6,${bottom} L21.5,${top} Z`;
  return (
    <g opacity={opacity}>
      <path d={d} fill="url(#bn-cork)" />
      <path d={d} fill="url(#bn-cork-pores)" />
      <path
        d={`M14,${top} L13.4,${bottom}`}
        stroke="#6b4320"
        strokeWidth={4.5}
        opacity={0.2}
      />
      <path
        d={`M-15,${top + 2} L-14.4,${bottom - 2}`}
        stroke="#f6dab0"
        strokeWidth={2.6}
        opacity={0.45}
      />
      {seal !== undefined && <SealDrips top={top} color={seal} />}
    </g>
  );
}

type SealDripsProps = { top: number; color: number };

function SealDrips({ top, color }: SealDripsProps) {
  const p = liquidPaint(color);
  const y = top;
  const d = `M-22.6,${y - 1} L-22.6,${y + 6} Q-20,${y + 8} -17.5,${y + 6.5} Q-16,${y + 12} -13,${y + 11} Q-11,${y + 6.5} -6,${y + 8} Q-2,${y + 9.5} 3,${y + 7} Q6,${y + 14} 9.5,${y + 12.5} Q11.5,${y + 7} 15,${y + 8} Q19,${y + 9} 22.6,${y + 6} L22.6,${y - 1} Z`;
  return (
    <g>
      <path d={d} fill={p.deep} />
      <path d={d} fill={p.base} transform="translate(0 -0.8)" />
      <path
        d={`M-19,${y + 1} L-19,${y + 5}`}
        stroke={p.rim}
        strokeWidth={2}
        strokeLinecap="round"
        opacity={0.7}
      />
    </g>
  );
}

function CorkTop({ dy, squash, opacity, seal }: CorkProps) {
  const y = -13 - dy + squash * 2;
  if (seal !== undefined) {
    const p = liquidPaint(seal);
    return (
      <g opacity={opacity}>
        <ellipse cx={0} cy={y - 0.4} rx={23} ry={4.6} fill={p.deep} />
        <ellipse cx={0} cy={y - 1.4} rx={22.6} ry={4.3} fill={p.base} />
        <ellipse cx={0} cy={y - 1.8} rx={10} ry={2.2} fill={p.deep} opacity={0.35} />
        <ellipse cx={0} cy={y - 2.1} rx={7} ry={1.4} fill={p.light} opacity={0.8} />
        <path
          d={`M-16,${y - 3} A17,2.6 0 0 1 6,${y - 4.6}`}
          stroke="#fff"
          strokeWidth={1.2}
          fill="none"
          opacity={0.75}
        />
      </g>
    );
  }
  return (
    <g opacity={opacity}>
      <ellipse
        cx={0}
        cy={y}
        rx={21.5 + squash * 0.8}
        ry={3.8}
        fill="url(#bn-cork-top)"
        stroke="#9a6a3c"
        strokeWidth={0.8}
      />
      <ellipse
        cx={0}
        cy={y}
        rx={21.5}
        ry={3.8}
        fill="url(#bn-cork-pores)"
        opacity={0.8}
      />
      <path
        d={`M-15,${y - 1.4} A16,2.2 0 0 1 8,${y - 2.6}`}
        stroke="#fbe4c0"
        strokeWidth={1}
        fill="none"
        opacity={0.85}
      />
    </g>
  );
}
