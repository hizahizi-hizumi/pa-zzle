// 試作 glass: 木の試験管立て。動かない部分なので、試験管の後ろと前の2枚に分けて描く。
import { memo } from "react";

import { OUTER_BOT, RO } from "./geometry";

/** 下の板の天面の上端（試験管の口からの距離）。 */
export const BASE = Math.round(OUTER_BOT - 16);

export type RackLayout = {
  columns: number;
  rows: number;
  width: number;
  height: number;
  tierTops: readonly number[];
  tubeX: (column: number) => number;
};

export const PITCH = 86;
export const SIDE = 25;
export const HEAD = 36;
export const TIER = BASE + 56;
const TIER_BOTTOM = BASE + 36;

export function createRackLayout(bottleCount: number): RackLayout {
  const columns = Math.max(3, Math.ceil(bottleCount / 2));
  const rows = Math.ceil(bottleCount / columns);
  const width = SIDE * 2 + columns * PITCH;
  const height = HEAD + (rows - 1) * TIER + TIER_BOTTOM;
  return {
    columns,
    rows,
    width,
    height,
    tierTops: Array.from({ length: rows }, (_, r) => HEAD + r * TIER),
    tubeX: (column) => SIDE + PITCH * (column + 0.5),
  };
}

type RackPartProps = { p: string; layout: RackLayout };

function RackDefs({ p }: { p: string }) {
  return (
    <defs>
      <linearGradient id={`${p}woodTop`} x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#e2c28c" />
        <stop offset="1" stopColor="#f0d8aa" />
      </linearGradient>
      <linearGradient id={`${p}woodFront`} x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#d6a668" />
        <stop offset="0.55" stopColor="#c58f55" />
        <stop offset="1" stopColor="#a8723c" />
      </linearGradient>
      <linearGradient id={`${p}postL`} x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#e6c089" />
        <stop offset="0.7" stopColor="#d1a265" />
        <stop offset="1" stopColor="#b07e45" />
      </linearGradient>
      <linearGradient id={`${p}postR`} x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#cf9f62" />
        <stop offset="0.5" stopColor="#bd8a50" />
        <stop offset="1" stopColor="#9c6c38" />
      </linearGradient>
      <linearGradient id={`${p}dowel`} x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#ecd09e" />
        <stop offset="0.5" stopColor="#cf9f68" />
        <stop offset="1" stopColor="#a47542" />
      </linearGradient>
      <filter id={`${p}grain`} x="0" y="0" width="100%" height="100%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.008 0.42"
          numOctaves="3"
          seed="7"
          result="n"
        />
        <feColorMatrix
          in="n"
          type="matrix"
          values="0 0 0 0 0.42  0 0 0 0 0.25  0 0 0 0 0.10  0 0 0 2.2 -0.85"
          result="c"
        />
        <feComposite in="c" in2="SourceAlpha" operator="in" />
      </filter>
      <filter id={`${p}rblur1`}>
        <feGaussianBlur stdDeviation="1" />
      </filter>
      <filter id={`${p}rblur6`} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="6" />
      </filter>
    </defs>
  );
}

export const RackBack = memo(function RackBack({ p, layout }: RackPartProps) {
  const { width, tierTops, columns, tubeX } = layout;
  const x0 = SIDE - 10;
  const w = width - 2 * x0;
  const lastTop = tierTops[tierTops.length - 1] ?? HEAD;
  return (
    <>
      <RackDefs p={p} />
      {/* 台に落ちる影 */}
      <ellipse
        cx={width / 2 + 6}
        cy={lastTop + BASE + 32}
        rx={width / 2 - 4}
        ry={8}
        fill="#2c3a48"
        opacity={0.24}
        filter={`url(#${p}rblur6)`}
      />
      {tierTops.map((y) => (
        <g key={y}>
          <rect x={x0} y={y + Math.round(BASE * 0.53)} width={w} height={7} rx={3.5} fill={`url(#${p}dowel)`} />
          <rect
            x={x0}
            y={y + Math.round(BASE * 0.53) + 8}
            width={w}
            height={3}
            fill="#7a5a3a"
            opacity={0.1}
            filter={`url(#${p}rblur1)`}
          />
          <rect x={x0} y={y + 19} width={w} height={10} rx={1.5} fill={`url(#${p}woodTop)`} />
          <rect
            x={x0}
            y={y + 19}
            width={w}
            height={10}
            fill="#000"
            filter={`url(#${p}grain)`}
            opacity={0.55}
          />
          {Array.from({ length: columns }, (_, c) => {
            const x = tubeX(c);
            return (
              <g key={c}>
                <ellipse cx={x} cy={y + 24} rx={RO + 5} ry={4.8} fill="#7a5229" />
                <ellipse cx={x} cy={y + 24.6} rx={RO + 3.5} ry={3.9} fill="#3e2510" opacity={0.8} />
                <path
                  d={`M${x - RO - 5},${y + 24} A${RO + 5},4.8 0 0 0 ${x + RO + 5},${y + 24}`}
                  stroke="#f4dcae"
                  strokeWidth={0.8}
                  fill="none"
                  opacity={0.8}
                />
              </g>
            );
          })}
          <rect x={x0} y={y + BASE} width={w} height={14} rx={1.5} fill={`url(#${p}woodTop)`} />
          <rect
            x={x0}
            y={y + BASE}
            width={w}
            height={14}
            fill="#000"
            filter={`url(#${p}grain)`}
            opacity={0.55}
          />
          {Array.from({ length: columns }, (_, c) => {
            const x = tubeX(c);
            return (
              <g key={c}>
                <ellipse cx={x} cy={y + BASE + 9} rx={RO + 3} ry={4.8} fill="#b8874f" opacity={0.55} />
                <path
                  d={`M${x - RO - 3},${y + BASE + 9} A${RO + 3},4.8 0 0 1 ${x + RO + 3},${y + BASE + 9}`}
                  stroke="#8e6034"
                  strokeWidth={0.8}
                  fill="none"
                  opacity={0.6}
                />
              </g>
            );
          })}
        </g>
      ))}
    </>
  );
});

export const RackFront = memo(function RackFront({ p, layout }: RackPartProps) {
  const { width, tierTops } = layout;
  const x0 = SIDE - 12;
  const w = width - 2 * x0;
  const firstTop = tierTops[0] ?? HEAD;
  const lastTop = tierTops[tierTops.length - 1] ?? HEAD;
  const postTop = firstTop + 14;
  const postHeight = lastTop - firstTop + BASE + 16;
  return (
    <>
      {tierTops.map((y) => (
        <g key={y}>
          {[
            [y + 29, 12],
            [y + BASE + 14, 14],
          ].map(([top = 0, h = 0]) => (
            <g key={top}>
              <rect x={x0} y={top} width={w} height={h} rx={1.5} fill={`url(#${p}woodFront)`} />
              <rect
                x={x0}
                y={top}
                width={w}
                height={h}
                fill="#000"
                filter={`url(#${p}grain)`}
                opacity={0.8}
              />
              <rect x={x0 + 1} y={top} width={w - 2} height={1} fill="#f8e4bc" opacity={0.9} />
              <rect x={x0} y={top + h - 1} width={w} height={1} fill="#8a5c2c" opacity={0.55} />
            </g>
          ))}
          <rect
            x={x0 + 2}
            y={y + 41}
            width={w - 4}
            height={4}
            fill="#3a2610"
            opacity={0.12}
            filter={`url(#${p}rblur1)`}
          />
        </g>
      ))}
      {[
        [SIDE - 20, "postL", "#f0d6a6"],
        [width - SIDE + 8, "postR", "#e5c793"],
      ].map(([x = 0, fill, cap]) => (
        <g key={String(fill)}>
          <rect x={x} y={postTop} width={12} height={postHeight} rx={2} fill={`url(#${p}${fill})`} />
          <rect
            x={x}
            y={postTop}
            width={12}
            height={postHeight}
            fill="#000"
            filter={`url(#${p}grain)`}
            opacity={0.5}
          />
          <rect x={x} y={postTop - 2} width={12} height={4} rx={2} fill={String(cap)} />
        </g>
      ))}
    </>
  );
});
