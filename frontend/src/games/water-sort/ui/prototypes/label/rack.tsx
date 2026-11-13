// 試作 label: 木の試験管立て。光は左上から。
import { memo } from "react";
import { CAVITY_PATH, SIDE, type RackLayout } from "./geometry";

export type WoodRect = { x: number; y: number; w: number; h: number; kind: "front" | "post" | "top" };

function rackExtent(layout: RackLayout) {
  const boardWidth = layout.columns * layout.spacing;
  const firstTy = layout.slots[0]?.ty ?? 40;
  const lastTy = firstTy + (layout.rows - 1) * 240;
  return { bx: SIDE, boardWidth, firstTy, lastTy };
}

/** 艶を乗せる木の面。 */
export function woodSurfaces(layout: RackLayout): WoodRect[] {
  const { bx, boardWidth, firstTy, lastTy } = rackExtent(layout);
  const rects: WoodRect[] = [];
  for (let row = 0; row < layout.rows; row += 1) {
    const ty = firstTy + row * 240;
    rects.push({ x: bx, y: ty + 20, w: boardWidth, h: 10, kind: "top" });
    rects.push({ x: bx - 2, y: ty + 30, w: boardWidth + 4, h: 12, kind: "front" });
    rects.push({ x: bx, y: ty + 188, w: boardWidth, h: 14, kind: "top" });
    rects.push({ x: bx - 2, y: ty + 202, w: boardWidth + 4, h: 14, kind: "front" });
  }
  const postHeight = lastTy - firstTy + 206;
  rects.push({ x: bx - 12, y: firstTy + 14, w: 12, h: postHeight, kind: "post" });
  rects.push({ x: bx + boardWidth, y: firstTy + 14, w: 12, h: postHeight, kind: "post" });
  return rects;
}

export function RackDefs() {
  return (
    <defs>
      <clipPath id="lbl-cavity">
        <path d={CAVITY_PATH} />
      </clipPath>
      <linearGradient id="lbl-cyl" x1="-22" x2="22" y1="0" y2="0" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#000" stopOpacity=".12" />
        <stop offset=".1" stopColor="#fff" stopOpacity=".3" />
        <stop offset=".24" stopColor="#fff" stopOpacity=".08" />
        <stop offset=".45" stopColor="#fff" stopOpacity="0" />
        <stop offset=".76" stopColor="#000" stopOpacity=".08" />
        <stop offset="1" stopColor="#000" stopOpacity=".26" />
      </linearGradient>
      <linearGradient id="lbl-glass" x1="-26" x2="26" y1="0" y2="0" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#fff" stopOpacity=".34" />
        <stop offset=".22" stopColor="#fff" stopOpacity=".06" />
        <stop offset=".7" stopColor="#dfe9f2" stopOpacity=".03" />
        <stop offset="1" stopColor="#b5c7d9" stopOpacity=".32" />
      </linearGradient>
      <linearGradient id="lbl-hl" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0" />
        <stop offset=".08" stopColor="#fff" stopOpacity=".88" />
        <stop offset=".7" stopColor="#fff" stopOpacity=".55" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="lbl-wood-top" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#e3c28b" />
        <stop offset="1" stopColor="#efd5a6" />
      </linearGradient>
      <linearGradient id="lbl-wood-front" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#d6a668" />
        <stop offset=".55" stopColor="#c6925a" />
        <stop offset="1" stopColor="#ad7942" />
      </linearGradient>
      <linearGradient id="lbl-post-l" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#e4bd84" />
        <stop offset=".7" stopColor="#d0a064" />
        <stop offset="1" stopColor="#b38146" />
      </linearGradient>
      <linearGradient id="lbl-post-r" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#cf9f62" />
        <stop offset=".5" stopColor="#bd8a50" />
        <stop offset="1" stopColor="#a1703a" />
      </linearGradient>
      <linearGradient id="lbl-dowel" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#eacd9b" />
        <stop offset=".5" stopColor="#cfa16a" />
        <stop offset="1" stopColor="#a67744" />
      </linearGradient>
      <radialGradient id="lbl-cork" cx=".32" cy=".3" r=".9">
        <stop offset="0" stopColor="#e6bb86" />
        <stop offset=".6" stopColor="#c8955e" />
        <stop offset="1" stopColor="#a47040" />
      </radialGradient>
      <linearGradient id="lbl-tag" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stopColor="#fffdf6" />
        <stop offset=".65" stopColor="#f7efdc" />
        <stop offset="1" stopColor="#ead9b6" />
      </linearGradient>
      <radialGradient id="lbl-sparkle" cx=".5" cy=".5" r=".5">
        <stop offset="0" stopColor="#fff" />
        <stop offset=".3" stopColor="#fff" stopOpacity=".7" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="lbl-glint" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0" />
        <stop offset=".5" stopColor="#fff" stopOpacity=".85" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <radialGradient id="lbl-aura" cx=".5" cy=".5" r=".5">
        <stop offset="0" stopColor="#fff6e2" stopOpacity=".95" />
        <stop offset=".55" stopColor="#ffeccc" stopOpacity=".4" />
        <stop offset="1" stopColor="#ffeccc" stopOpacity="0" />
      </radialGradient>
      <pattern id="lbl-frost" width="9" height="8" patternUnits="userSpaceOnUse">
        <circle cx="1.5" cy="1.5" r=".42" fill="#fff" opacity=".7" />
        <circle cx="6" cy="2.8" r=".3" fill="#fff" opacity=".55" />
        <circle cx="3.6" cy="5.8" r=".5" fill="#fff" opacity=".45" />
        <circle cx="7.8" cy="6.9" r=".34" fill="#fff" opacity=".6" />
        <circle cx="0.6" cy="4.6" r=".26" fill="#fff" opacity=".6" />
      </pattern>
      <pattern id="lbl-cork-dots" width="7" height="6" patternUnits="userSpaceOnUse">
        <circle cx="1.2" cy="1.4" r=".7" fill="#7a4d24" opacity=".45" />
        <circle cx="4.6" cy="2.2" r=".45" fill="#5e3a19" opacity=".5" />
        <circle cx="2.8" cy="4.6" r=".55" fill="#8d5c2e" opacity=".4" />
        <circle cx="6.2" cy="5.1" r=".35" fill="#f2d3a6" opacity=".55" />
        <circle cx="5.4" cy="0.5" r=".3" fill="#f2d3a6" opacity=".5" />
      </pattern>
      <pattern id="lbl-fiber" width="6" height="5" patternUnits="userSpaceOnUse">
        <path d="M0.4,1 L2.6,1.6 M3.4,3.6 L5.6,3.1 M1,4.2 L2,4.6" stroke="#a78757" strokeWidth=".3" opacity=".45" />
        <circle cx="4.6" cy="0.9" r=".3" fill="#a78757" opacity=".4" />
      </pattern>
      <filter id="lbl-grain" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.008 0.42" numOctaves="3" seed="7" result="n" />
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.42  0 0 0 0 0.25  0 0 0 0 0.10  0 0 0 2.2 -0.85" result="c" />
        <feComposite in="c" in2="SourceAlpha" operator="in" />
      </filter>
      <filter id="lbl-grain-v" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.42 0.006" numOctaves="3" seed="11" result="n" />
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.42  0 0 0 0 0.25  0 0 0 0 0.10  0 0 0 2.2 -0.85" result="c" />
        <feComposite in="c" in2="SourceAlpha" operator="in" />
      </filter>
      <filter id="lbl-cork-tex" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="n" />
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.35  0 0 0 0 0.2  0 0 0 0 0.08  0 0 0 2.4 -1.25" result="c" />
        <feComposite in="c" in2="SourceAlpha" operator="in" />
      </filter>
      <filter id="lbl-paper" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="5" result="n" />
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.32  0 0 0 0 0.15  0 0 0 1.6 -0.95" result="c" />
        <feComposite in="c" in2="SourceAlpha" operator="in" />
      </filter>
      <filter id="lbl-blur06"><feGaussianBlur stdDeviation="0.6" /></filter>
      <filter id="lbl-blur1"><feGaussianBlur stdDeviation="1" /></filter>
      <filter id="lbl-blur3" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" /></filter>
      <filter id="lbl-blur6" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" /></filter>
      <filter id="lbl-blur14" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14" /></filter>
    </defs>
  );
}

function BoardTop({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <>
      <rect x={x} y={y} width={w} height={h} rx="1.5" fill="url(#lbl-wood-top)" />
      <rect x={x} y={y} width={w} height={h} fill="#000" filter="url(#lbl-grain)" opacity=".55" />
      <rect x={x} y={y} width={w} height=".8" fill="#fff4dc" opacity=".6" />
    </>
  );
}

function BoardFront({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <>
      <rect x={x} y={y} width={w} height={h} rx="1.5" fill="url(#lbl-wood-front)" />
      <rect x={x} y={y} width={w} height={h} fill="#000" filter="url(#lbl-grain)" opacity=".8" />
      <rect x={x + 1} y={y} width={w - 2} height="1" fill="#f8e4bc" opacity=".9" />
      <rect x={x} y={y + h - 1} width={w} height="1" fill="#80532a" opacity=".6" />
    </>
  );
}

export const RackBack = memo(function RackBack({ layout }: { layout: RackLayout }) {
  const { bx, boardWidth, firstTy, lastTy } = rackExtent(layout);
  const rows = Array.from({ length: layout.rows }, (_, row) => firstTy + row * 240);
  const columns = Array.from({ length: layout.columns }, (_, column) => bx + layout.spacing * (column + 0.5));
  return (
    <>
      <RackDefs />
      <ellipse cx={bx + boardWidth / 2 + 6} cy={lastTy + 222} rx={boardWidth / 2 + 26} ry="10" fill="#2a3846" opacity=".24" filter="url(#lbl-blur6)" />
      <ellipse cx={bx + boardWidth / 2 + 4} cy={lastTy + 218} rx={boardWidth / 2 + 12} ry="3" fill="#2a3846" opacity=".22" filter="url(#lbl-blur1)" />
      {rows.map((ty) => (
        <g key={ty}>
          <rect x={bx} y={ty + 104} width={boardWidth} height="7" rx="3.5" fill="url(#lbl-dowel)" />
          <rect x={bx} y={ty + 112} width={boardWidth} height="3" fill="#7a5a3a" opacity=".1" filter="url(#lbl-blur1)" />
          <BoardTop x={bx} y={ty + 20} w={boardWidth} h={10} />
          {columns.map((cx) => (
            <g key={cx}>
              <ellipse cx={cx} cy={ty + 25} rx="29.5" ry="4.2" fill="#7a5229" />
              <ellipse cx={cx} cy={ty + 25.6} rx="28" ry="3.4" fill="#45290f" opacity=".78" />
              <path d={`M${cx - 29.5},${ty + 25} A29.5,4.2 0 0 0 ${cx + 29.5},${ty + 25}`} stroke="#f4dcae" strokeWidth=".8" fill="none" opacity=".8" />
            </g>
          ))}
          <BoardTop x={bx} y={ty + 188} w={boardWidth} h={14} />
          {columns.map((cx) => (
            <g key={cx}>
              <ellipse cx={cx} cy={ty + 196} rx="27" ry="4.4" fill="#b4834c" opacity=".6" />
              <path d={`M${cx - 27},${ty + 196} A27,4.4 0 0 1 ${cx + 27},${ty + 196}`} stroke="#8a5c31" strokeWidth=".8" fill="none" opacity=".6" />
            </g>
          ))}
        </g>
      ))}
    </>
  );
});

export const RackFront = memo(function RackFront({ layout }: { layout: RackLayout }) {
  const { bx, boardWidth, firstTy, lastTy } = rackExtent(layout);
  const rows = Array.from({ length: layout.rows }, (_, row) => firstTy + row * 240);
  const postHeight = lastTy - firstTy + 206;
  const right = bx + boardWidth;
  return (
    <>
      {rows.map((ty) => (
        <g key={ty}>
          <BoardFront x={bx - 2} y={ty + 30} w={boardWidth + 4} h={12} />
          <rect x={bx} y={ty + 42} width={boardWidth} height="4" fill="#3a2610" opacity=".14" filter="url(#lbl-blur1)" />
          <BoardFront x={bx - 2} y={ty + 202} w={boardWidth + 4} h={14} />
          <rect x={bx} y={ty + 216} width={boardWidth} height="3" fill="#3a2610" opacity=".12" filter="url(#lbl-blur1)" />
        </g>
      ))}
      <rect x={bx - 12} y={firstTy + 14} width="12" height={postHeight} rx="2" fill="url(#lbl-post-l)" />
      <rect x={bx - 12} y={firstTy + 14} width="12" height={postHeight} fill="#000" filter="url(#lbl-grain-v)" opacity=".55" />
      <rect x={right} y={firstTy + 14} width="12" height={postHeight} rx="2" fill="url(#lbl-post-r)" />
      <rect x={right} y={firstTy + 14} width="12" height={postHeight} fill="#000" filter="url(#lbl-grain-v)" opacity=".55" />
      <rect x={bx - 12} y={firstTy + 12} width="12" height="4" rx="2" fill="#f0d6a6" />
      <rect x={right} y={firstTy + 12} width="12" height="4" rx="2" fill="#e3c590" />
      <rect x={bx - 1} y={firstTy + 16} width="1" height={postHeight - 2} fill="#7a5129" opacity=".35" />
      <rect x={right} y={firstTy + 16} width="1" height={postHeight - 2} fill="#fff3d8" opacity=".25" />
    </>
  );
});
