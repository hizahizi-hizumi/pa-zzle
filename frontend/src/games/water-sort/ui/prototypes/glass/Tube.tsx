// 試作 glass: 厚手ガラスの試験管1本と、その中の色水を描く。
// すべて試験管の局所座標で描き、液面と層の境だけを世界で水平な線として局所座標へ写す。
import type { ReactNode } from "react";

import {
  BOT,
  CAVITY_PATH,
  CAVITY_TOP,
  heightOfUnits,
  levelsAt,
  OUTER_BOT,
  OUTER_PATH,
  R,
  RO,
  STRAIGHT_BOTTOM,
  volumeOfUnits,
  WALL_PATH,
} from "./geometry";
import { getLiquidColor, LIQUID_COLOR_COUNT, mixHex } from "./liquid-colors";

export type Xf = {
  /** 回転の中心の世界座標。 */
  wx: number;
  wy: number;
  /** 回転の中心の局所座標。 */
  pvx: number;
  pvy: number;
  /** 傾き（度、時計回りが正）。 */
  a: number;
};

export type Run = { color: number; units: number };

export type Joint =
  | { kind: "mix"; width: number; amp: number; phase: number }
  | { kind: "seam"; opacity: number; amp: number; phase: number };

export type TubeView = {
  xf: Xf;
  runs: readonly Run[];
  /** joints[i] は runs[i-1] と runs[i] の境。 */
  joints: readonly (Joint | undefined)[];
  /** 液面の揺れ（度）。 */
  slosh: number;
  /** 古い液面の光の線（同じ色が重なるときに揺れて消える）。 */
  ghost?: { units: number; amp: number; opacity: number; phase: number };
  /** 注がれたばかりの泡立った部分。 */
  fresh?: { fromUnits: number; opacity: number; t: number };
  /** つながった柱を下から上へ走る光。 */
  glint?: { fromUnits: number; toUnits: number; p: number };
  /** 液面に落ちる筋の輪。 */
  splash?: { x: number; p: number };
  cork?: { y: number } | null;
  /** 空になった管の底に残る薄い膜。 */
  film?: { color: number; opacity: number };
  droplets: number;
  /** クリアのときにガラスを走る光（0〜1）。 */
  sheen?: number;
  /** 済んだ管の色が縁ににじむ。 */
  glow?: number | null;
  /** 通らなかった操作で、ガラスの縁が鈍く曇る強さ（0〜1）。 */
  reject?: number;
};

const L = 420;

function f(n: number) {
  return Math.round(n * 100) / 100;
}

type Vec = readonly [number, number];

function pt([x, y]: Vec) {
  return `${f(x)},${f(y)}`;
}

/** 局所座標で、世界の水平線 k = x·sin a + y·cos a を表す道具。 */
function frame(aDeg: number) {
  const a = (aDeg * Math.PI) / 180;
  const s = Math.sin(a);
  const c = Math.cos(a);
  const n: Vec = [s, c];
  const d: Vec = [c, -s];
  function on(k: number, t: number): Vec {
    return [n[0] * k + d[0] * t, n[1] * k + d[1] * t];
  }
  function band(k1: number, k2: number) {
    return `M${pt(on(k1, -L))} L${pt(on(k1, L))} L${pt(on(k2, L))} L${pt(on(k2, -L))} Z`;
  }
  function wavy(k: number, amp: number, phase: number, freq = 0.32, sag = 0) {
    const pts: string[] = [pt(on(k, -L))];
    for (let t = -R - 6; t <= R + 6; t += 1.5) {
      const arc = sag * Math.sqrt(Math.max(0, 1 - (t / R) ** 2));
      pts.push(pt(on(k + Math.sin(t * freq + phase) * amp + arc, t)));
    }
    pts.push(pt(on(k, L)));
    return pts;
  }
  /** 上の端が波打つ帯。 */
  function wavyBand(kTop: number, kBottom: number, amp: number, phase: number) {
    const top = wavy(kTop, amp, phase);
    return `M${top.join(" L")} L${pt(on(kBottom, L))} L${pt(on(kBottom, -L))} Z`;
  }
  /** 上下とも波打つ帯。 */
  function wavyStrip(k1: number, k2: number, amp: number, phase: number) {
    const top = wavy(k1, amp, phase);
    const bottom = wavy(k2, amp * 0.8, phase + 1.7).reverse();
    return `M${top.join(" L")} L${bottom.join(" L")} Z`;
  }
  /** 液面の中心（管の軸と液面の交点）。 */
  function axisPoint(k: number): Vec {
    return Math.abs(c) > 0.25 ? [0, k / c] : on(k, 0);
  }
  return { s, c, n, d, on, band, wavy, wavyBand, wavyStrip, axisPoint };
}

export function xfTransform({ wx, wy, pvx, pvy, a }: Xf) {
  return `translate(${f(wx)} ${f(wy)}) rotate(${f(a)}) translate(${f(-pvx)} ${f(-pvy)})`;
}

export function xfApply({ wx, wy, pvx, pvy, a }: Xf, x: number, y: number): Vec {
  const r = (a * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const dx = x - pvx;
  const dy = y - pvy;
  return [wx + dx * c - dy * s, wy + dx * s + dy * c];
}

/** 液の層ごとの k（世界で下ほど大きい）の位置。boundaries[i] は runs[i] の上端。 */
function runBoundaries(aDeg: number, runs: readonly Run[]) {
  const cumulative: number[] = [];
  let acc = 0;
  for (const run of runs) {
    acc += run.units;
    cumulative.push(acc);
  }
  if (Math.abs(aDeg) < 0.01) {
    return cumulative.map((u) => heightOfUnits(u));
  }
  return levelsAt(
    aDeg,
    cumulative.map((u) => volumeOfUnits(u)),
  );
}

export function TubeDefs({ p }: { p: string }) {
  const colors = Array.from({ length: LIQUID_COLOR_COUNT }, (_, i) => i);
  return (
    <defs>
      <clipPath id={`${p}cav`}>
        <path d={CAVITY_PATH} />
      </clipPath>
      <clipPath id={`${p}outer`}>
        <path d={OUTER_PATH} />
      </clipPath>
      {colors.map((i) => {
        const col = getLiquidColor(i);
        return (
          <linearGradient
            key={`lq${i}`}
            id={`${p}lq${i}`}
            gradientUnits="userSpaceOnUse"
            x1={-R}
            x2={R}
            y1={0}
            y2={0}
          >
            <stop offset="0" stopColor={col.deep} />
            <stop offset="0.07" stopColor={mixHex(col.deep, col.base, 0.5)} />
            <stop offset="0.17" stopColor={col.base} />
            <stop offset="0.3" stopColor={col.light} />
            <stop offset="0.42" stopColor={mixHex(col.light, col.base, 0.6)} />
            <stop offset="0.6" stopColor={col.base} />
            <stop offset="0.8" stopColor={mixHex(col.base, col.deep, 0.45)} />
            <stop offset="0.94" stopColor={col.deep} />
            <stop offset="1" stopColor={mixHex(col.deep, "#000000", 0.2)} />
          </linearGradient>
        );
      })}
      {colors.map((i) => {
        const col = getLiquidColor(i);
        return (
          <linearGradient
            key={`sf${i}`}
            id={`${p}sf${i}`}
            x1="0"
            x2="1"
            y1="0"
            y2="0"
          >
            <stop offset="0" stopColor={col.base} />
            <stop offset="0.25" stopColor={col.surface} />
            <stop offset="0.6" stopColor={col.light} />
            <stop offset="1" stopColor={col.base} />
          </linearGradient>
        );
      })}
      <linearGradient
        id={`${p}bowl`}
        gradientUnits="userSpaceOnUse"
        x1={0}
        x2={0}
        y1={STRAIGHT_BOTTOM - 40}
        y2={BOT}
      >
        <stop offset="0" stopColor="#000" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity="0.22" />
      </linearGradient>
      <linearGradient
        id={`${p}wall`}
        gradientUnits="userSpaceOnUse"
        x1={-RO}
        x2={RO}
        y1={0}
        y2={0}
      >
        <stop offset="0" stopColor="#d9efe9" stopOpacity="0.75" />
        <stop offset="0.07" stopColor="#ffffff" stopOpacity="0.9" />
        <stop offset="0.11" stopColor="#bfe0da" stopOpacity="0.55" />
        <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.1" />
        <stop offset="0.88" stopColor="#8fb8b6" stopOpacity="0.45" />
        <stop offset="0.95" stopColor="#5f8f92" stopOpacity="0.7" />
        <stop offset="1" stopColor="#3f6b72" stopOpacity="0.75" />
      </linearGradient>
      <linearGradient
        id={`${p}body`}
        gradientUnits="userSpaceOnUse"
        x1={-RO}
        x2={RO}
        y1={0}
        y2={0}
      >
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.22" />
        <stop offset="0.3" stopColor="#ffffff" stopOpacity="0.04" />
        <stop offset="0.7" stopColor="#dbe9ee" stopOpacity="0.02" />
        <stop offset="1" stopColor="#a8c4cc" stopOpacity="0.25" />
      </linearGradient>
      <linearGradient id={`${p}hl`} x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0" />
        <stop offset="0.06" stopColor="#fff" stopOpacity="0.95" />
        <stop offset="0.55" stopColor="#fff" stopOpacity="0.6" />
        <stop offset="0.9" stopColor="#fff" stopOpacity="0.25" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <linearGradient id={`${p}liqSheen`} gradientUnits="userSpaceOnUse" x1={-R} x2={R} y1={0} y2={0}>
        <stop offset="0" stopColor="#fff" stopOpacity="0" />
        <stop offset="0.12" stopColor="#fff" stopOpacity="0" />
        <stop offset="0.17" stopColor="#fff" stopOpacity="0.55" />
        <stop offset="0.24" stopColor="#fff" stopOpacity="0.1" />
        <stop offset="0.8" stopColor="#fff" stopOpacity="0" />
        <stop offset="0.86" stopColor="#fff" stopOpacity="0.22" />
        <stop offset="0.9" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <linearGradient id={`${p}glint`} x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0" />
        <stop offset="0.5" stopColor="#fff" stopOpacity="1" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <linearGradient id={`${p}sheen`} x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#fff" stopOpacity="0" />
        <stop offset="0.5" stopColor="#fff" stopOpacity="0.85" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <radialGradient id={`${p}cork`} cx="0.35" cy="0.3" r="0.9">
        <stop offset="0" stopColor="#e6bb86" />
        <stop offset="0.6" stopColor="#c8955e" />
        <stop offset="1" stopColor="#9d6a3a" />
      </radialGradient>
      <filter id={`${p}corkTex`} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="n" />
        <feColorMatrix
          in="n"
          type="matrix"
          values="0 0 0 0 0.35  0 0 0 0 0.2  0 0 0 0 0.08  0 0 0 2.4 -1.25"
          result="c"
        />
        <feComposite in="c" in2="SourceAlpha" operator="in" />
      </filter>
      <filter id={`${p}blur07`} x="-50%" y="-20%" width="200%" height="140%">
        <feGaussianBlur stdDeviation="0.7" />
      </filter>
      <filter id={`${p}blur15`} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="1.5" />
      </filter>
    </defs>
  );
}

type TubeProps = { p: string; id: string; view: TubeView };

export function Tube({ p, id, view }: TubeProps) {
  return (
    <g transform={xfTransform(view.xf)}>
      <GlassBack />
      <g clipPath={`url(#${p}cav)`}>
        <Liquid p={p} id={id} view={view} />
      </g>
      <GlassFront p={p} view={view} />
    </g>
  );
}

function GlassBack() {
  return (
    <>
      <path d={CAVITY_PATH} fill="#e6f0f3" fillOpacity={0.22} />
      {/* 奥の内壁の縁 */}
      <path
        d={`M${-R + 1.2},${CAVITY_TOP + 6} L${-R + 1.2},${STRAIGHT_BOTTOM}`}
        stroke="#7c98a6"
        strokeOpacity={0.18}
        strokeWidth={1}
      />
      {/* 口の縁の奥半分 */}
      <path
        d={`M${-RO - 2.4},2.6 A${RO + 2.4},5.4 0 0 1 ${RO + 2.4},2.6`}
        fill="none"
        stroke="#5f7d8c"
        strokeOpacity={0.4}
        strokeWidth={0.9}
      />
    </>
  );
}

function Liquid({ p, id, view }: TubeProps) {
  const { runs, joints, xf } = view;
  const total = runs.reduce((sum, run) => sum + run.units, 0);
  const parts: ReactNode[] = [];
  const defs: ReactNode[] = [];
  const fr = frame(xf.a);

  if (view.film && view.film.opacity > 0.01) {
    const k = BOT - 5;
    parts.push(
      <path
        key="film"
        d={fr.band(k, 400)}
        fill={`url(#${p}lq${view.film.color})`}
        opacity={view.film.opacity}
      />,
    );
  }
  if (total <= 0.001) {
    return (
      <>
        {defs.length > 0 && <defs>{defs}</defs>}
        {parts}
      </>
    );
  }

  const tops = runBoundaries(xf.a, runs);
  const surfaceK = tops[tops.length - 1] ?? BOT;
  const sloshRad = (view.slosh * Math.PI) / 180;
  const center = fr.axisPoint(surfaceK);
  const surfaceDir: Vec = [
    Math.cos(sloshRad) * fr.d[0] - Math.sin(sloshRad) * fr.d[1],
    Math.sin(sloshRad) * fr.d[0] + Math.cos(sloshRad) * fr.d[1],
  ];
  function surfacePoint(t: number): Vec {
    return [center[0] + surfaceDir[0] * t, center[1] + surfaceDir[1] * t];
  }

  // 層の本体（下から）
  runs.forEach((run, i) => {
    if (run.units <= 0.001) return;
    const kBottom = i === 0 ? 400 : (tops[i - 1] ?? 400);
    const isTop = i === runs.length - 1;
    const d = isTop
      ? `M${pt(surfacePoint(-L))} L${pt(surfacePoint(L))} L${pt(fr.on(kBottom, L))} L${pt(fr.on(kBottom, -L))} Z`
      : fr.band(tops[i] ?? 0, kBottom);
    parts.push(
      <path key={`run${i}`} d={d} fill={`url(#${p}lq${run.color})`} />,
    );
  });

  // 層の境: 下の色が上の色へ溶けこむ薄い帯
  runs.forEach((run, i) => {
    const joint = joints[i];
    const below = runs[i - 1];
    if (i === 0 || !joint || !below) return;
    const kb = tops[i - 1] ?? 0;
    if (joint.kind === "mix") {
      const h = joint.width / 2;
      const gid = `${id}jg${i}`;
      const mid = `${id}jm${i}`;
      const [x1, y1] = fr.on(kb + h, 0);
      const [x2, y2] = fr.on(kb - h, 0);
      defs.push(
        <linearGradient
          key={gid}
          id={gid}
          gradientUnits="userSpaceOnUse"
          x1={f(x1)}
          y1={f(y1)}
          x2={f(x2)}
          y2={f(y2)}
        >
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#000" />
        </linearGradient>,
        <mask
          key={mid}
          id={mid}
          maskUnits="userSpaceOnUse"
          x={-200}
          y={-200}
          width={400}
          height={600}
        >
          <rect x={-200} y={-200} width={400} height={600} fill={`url(#${gid})`} />
        </mask>,
      );
      parts.push(
        <path
          key={`mix${i}`}
          d={fr.wavyBand(kb - h, kb + h, joint.amp, joint.phase)}
          fill={`url(#${p}lq${below.color})`}
          mask={`url(#${mid})`}
        />,
      );
      // 境目の奥行き: 2色が触れ合う所にかすかな濃い筋
      const sag = Math.abs(xf.a) < 40 ? 3 * Math.cos((xf.a * Math.PI) / 180) : 0;
      parts.push(
        <path
          key={`mixback${i}`}
          d={`M${fr.wavy(kb, joint.amp * 0.6, joint.phase + 0.5, 0.32, -sag).join(" L")}`}
          fill="none"
          stroke="#fff"
          strokeOpacity={0.22}
          strokeWidth={0.7}
        />,
        <path
          key={`mixline${i}`}
          d={`M${fr.wavy(kb, joint.amp * 0.6, joint.phase + 0.5, 0.32, sag).join(" L")}`}
          fill="none"
          stroke={getLiquidColor(below.color).deep}
          strokeOpacity={0.3}
          strokeWidth={0.9}
        />,
      );
    } else if (joint.opacity > 0.01) {
      const col = getLiquidColor(run.color);
      parts.push(
        <path
          key={`seam${i}`}
          d={fr.wavyStrip(kb - 3.5 - joint.amp, kb + 3.5 + joint.amp, joint.amp, joint.phase)}
          fill={col.light}
          opacity={0.9 * joint.opacity}
          filter={`url(#${p}blur07)`}
        />,
        <path
          key={`seamline${i}`}
          d={`M${fr.wavy(kb + 1.5, joint.amp * 1.2, joint.phase + 2.1, 0.4).join(" L")}`}
          fill="none"
          stroke={col.deep}
          strokeOpacity={0.55 * joint.opacity}
          strokeWidth={1.1}
        />,
      );
    }
  });

  const liquidRegion = `M${pt(surfacePoint(-L))} L${pt(surfacePoint(L))} L${pt(fr.on(400, L))} L${pt(fr.on(400, -L))} Z`;

  // 管の丸みに沿う光と、丸い底に溜まる濃さ
  parts.push(
    <path key="bowl" d={liquidRegion} fill={`url(#${p}bowl)`} />,
    <path key="sheen" d={liquidRegion} fill={`url(#${p}liqSheen)`} />,
  );

  if (view.fresh && view.fresh.opacity > 0.01) {
    const kFrom = runBoundaries(xf.a, [{ color: 0, units: view.fresh.fromUnits }])[0] ?? surfaceK;
    parts.push(
      <path
        key="fresh"
        d={`M${pt(surfacePoint(-L))} L${pt(surfacePoint(L))} L${pt(fr.on(kFrom, L))} L${pt(fr.on(kFrom, -L))} Z`}
        fill="#fff"
        opacity={0.3 * view.fresh.opacity}
      />,
    );
    for (let b = 0; b < 7; b++) {
      const life = (view.fresh.t * 1.6 + b * 0.37) % 1;
      const y = kFrom + (surfaceK - kFrom) * life + 2;
      const x = Math.sin(b * 2.3) * (R - 6);
      parts.push(
        <circle
          key={`bub${b}`}
          cx={f(x + Math.sin(life * 6 + b) * 1.2)}
          cy={f(y)}
          r={f(0.7 + (b % 3) * 0.35)}
          fill="none"
          stroke="#fff"
          strokeWidth={0.6}
          opacity={view.fresh.opacity * 0.85 * Math.sin(Math.PI * life)}
        />,
      );
    }
  }

  if (view.ghost && view.ghost.opacity > 0.01) {
    const kg = heightOfUnits(view.ghost.units);
    parts.push(
      <path
        key="ghost"
        d={`M${fr.wavy(kg, view.ghost.amp, view.ghost.phase, 0.42).join(" L")}`}
        fill="none"
        stroke="#fff"
        strokeWidth={1.1}
        opacity={view.ghost.opacity}
      />,
    );
  }

  if (view.glint && view.glint.p > 0 && view.glint.p < 1) {
    const yFrom = heightOfUnits(view.glint.fromUnits);
    const yTo = heightOfUnits(view.glint.toUnits);
    const g = view.glint.p;
    const head = yFrom + (yTo - yFrom) * g;
    const glow = Math.sin(Math.PI * g);
    parts.push(
      <rect
        key="glintcol"
        x={-R}
        y={f(yTo)}
        width={R * 2}
        height={f(yFrom - yTo)}
        fill="#fff"
        opacity={0.26 * glow}
      />,
      <rect
        key="glintband"
        x={-R}
        y={f(head - 16)}
        width={R * 2}
        height={32}
        fill={`url(#${p}glint)`}
        opacity={0.55 * glow}
      />,
      <ellipse
        key="glintring"
        cx={0}
        cy={f(head)}
        rx={R}
        ry={4}
        fill="none"
        stroke="#fff"
        strokeWidth={2.2}
        opacity={0.9 * glow}
        filter={`url(#${p}blur07)`}
      />,
      <rect
        key="glintL"
        x={-R + 0.4}
        y={f(head - 30)}
        width={2.4}
        height={60}
        rx={1.2}
        fill={`url(#${p}glint)`}
        opacity={glow}
      />,
      <rect
        key="glintR"
        x={R - 2.8}
        y={f(head - 30)}
        width={2.4}
        height={60}
        rx={1.2}
        fill={`url(#${p}glint)`}
        opacity={glow}
      />,
    );
  }

  // 液面: 少し見下ろした凹んだ面と、壁に沿って光る細い縁
  const topRun = runs[runs.length - 1];
  if (topRun) {
    const col = getLiquidColor(topRun.color);
    const tilt = xf.a - view.slosh;
    const cosA = Math.cos((xf.a * Math.PI) / 180);
    if (Math.abs(xf.a) < 55) {
      const rx = R / Math.max(0.3, Math.abs(cosA));
      const ry = 4;
      parts.push(
        <g
          key="surface"
          transform={`translate(${f(center[0])} ${f(center[1])}) rotate(${f(-tilt)})`}
        >
          <ellipse rx={f(rx)} ry={ry} fill={`url(#${p}sf${topRun.color})`} opacity={0.96} />
          <ellipse cx={-3} cy={0.4} rx={f(rx * 0.55)} ry={1.5} fill={col.deep} opacity={0.12} />
          <path
            d={`M${f(-rx)},0 A${f(rx)},${ry} 0 0 1 ${f(rx)},0`}
            fill="none"
            stroke={col.deep}
            strokeOpacity={0.35}
            strokeWidth={0.8}
          />
          <path
            d={`M${f(-rx)},-2.4 Q${f(-rx + 0.6)},0.2 ${f(-rx + 4)},1.4 A${f(rx)},${ry} 0 0 0 ${f(rx - 4)},1.4 Q${f(rx - 0.6)},0.2 ${f(rx)},-2.4`}
            fill="none"
            stroke="#fff"
            strokeWidth={1.6}
            opacity={0.35}
            filter={`url(#${p}blur07)`}
          />
          <path
            d={`M${f(-rx)},-2.4 Q${f(-rx + 0.6)},0.2 ${f(-rx + 4)},1.4 A${f(rx)},${ry} 0 0 0 ${f(rx - 4)},1.4 Q${f(rx - 0.6)},0.2 ${f(rx)},-2.4`}
            fill="none"
            stroke="#fff"
            strokeWidth={0.75}
            opacity={0.95}
          />
          {view.splash && view.splash.p > 0 && view.splash.p < 1 && (
            <SplashRings x={view.splash.x} p={view.splash.p} />
          )}
        </g>,
      );
    } else {
      parts.push(
        <path
          key="surface"
          d={`M${pt(surfacePoint(-L))} L${pt(surfacePoint(L))}`}
          stroke="#fff"
          strokeWidth={1}
          opacity={0.85}
        />,
      );
    }
  }

  return (
    <>
      {defs.length > 0 && <defs>{defs}</defs>}
      <g opacity={0.93}>{parts}</g>
    </>
  );
}

function SplashRings({ x, p }: { x: number; p: number }) {
  const rings = [0, 0.33, 0.66];
  return (
    <>
      {rings.map((offset) => {
        const q = (p * 2.4 + offset) % 1;
        return (
          <ellipse
            key={offset}
            cx={f(x)}
            cy={0.6}
            rx={f(2 + q * 11)}
            ry={f(0.6 + q * 2.2)}
            fill="none"
            stroke="#fff"
            strokeWidth={0.8}
            opacity={f((1 - q) * 0.8)}
          />
        );
      })}
    </>
  );
}

function GlassFront({ p, view }: { p: string; view: TubeView }) {
  const bottomRun = view.runs.find((run) => run.units > 0.001);
  const poolColor = bottomRun
    ? getLiquidColor(bottomRun.color)
    : view.film && view.film.opacity > 0.01
      ? getLiquidColor(view.film.color)
      : null;
  const poolOpacity = bottomRun ? 0.55 : (view.film?.opacity ?? 0) * 0.5;
  const corked = view.cork;
  const glowColor =
    view.glow !== null && view.glow !== undefined
      ? getLiquidColor(view.glow).base
      : null;

  return (
    <>
      {/* 丸い底の厚いガラスに溜まる色 */}
      <path
        d={`M${-R},${STRAIGHT_BOTTOM} A${R},${R} 0 0 0 ${R},${STRAIGHT_BOTTOM} L${RO - 0.5},${STRAIGHT_BOTTOM} A${RO - 0.5},${OUTER_BOT - STRAIGHT_BOTTOM - 0.5} 0 0 1 ${-RO + 0.5},${STRAIGHT_BOTTOM} Z`}
        fill={poolColor ? poolColor.base : "#cfe3e6"}
        opacity={poolColor ? poolOpacity : 0.35}
      />
      {poolColor && (
        <path
          d={`M${-R + 4},${BOT - 2} Q0,${OUTER_BOT + 1} ${R - 4},${BOT - 2}`}
          fill="none"
          stroke={poolColor.deep}
          strokeWidth={3}
          opacity={0.3 * Math.min(1, poolOpacity * 2)}
          filter={`url(#${p}blur15)`}
        />
      )}
      {/* ガラスの胴と肉厚の壁 */}
      <path d={OUTER_PATH} fill={`url(#${p}body)`} />
      <path d={WALL_PATH} fillRule="evenodd" fill={`url(#${p}wall)`} />
      <path d={OUTER_PATH} fill="none" stroke="#4d6e7c" strokeOpacity={0.55} strokeWidth={0.9} />
      <path d={CAVITY_PATH} fill="none" stroke="#ffffff" strokeOpacity={0.55} strokeWidth={0.7} />
      <path
        d={`M${R + 0.6},${CAVITY_TOP + 8} L${R + 0.6},${STRAIGHT_BOTTOM} A${R + 0.6},${R + 0.6} 0 0 1 ${R - 8},${BOT - 1}`}
        fill="none"
        stroke="#2f5560"
        strokeOpacity={0.35}
        strokeWidth={0.8}
      />
      {/* 映り込み: 光は左上から */}
      <rect
        x={-R + 2}
        y={14}
        width={3.8}
        height={158}
        rx={1.9}
        fill={`url(#${p}hl)`}
        filter={`url(#${p}blur07)`}
      />
      <path
        d={`M${-RO + 1.5},8 L${-RO + 1.5},${STRAIGHT_BOTTOM} A${RO - 1.5},${OUTER_BOT - STRAIGHT_BOTTOM - 1.5} 0 0 0 ${-10},${OUTER_BOT - 3}`}
        fill="none"
        stroke="#fff"
        strokeWidth={1.1}
        opacity={0.85}
      />
      <rect x={R - 3.6} y={22} width={1.5} height={140} rx={0.75} fill="#fff" opacity={0.32} />
      <rect x={RO - 2.6} y={18} width={1} height={150} rx={0.5} fill="#fff" opacity={0.4} />
      {/* 厚い底の光 */}
      <path
        d={`M${-13},${OUTER_BOT - 6} Q0,${OUTER_BOT - 1.5} ${9},${OUTER_BOT - 5}`}
        fill="none"
        stroke="#fff"
        strokeWidth={1.6}
        opacity={0.7}
        filter={`url(#${p}blur07)`}
      />
      <ellipse cx={-7} cy={BOT + 3.2} rx={4} ry={1.4} fill="#fff" opacity={0.55} />
      {view.droplets > 0.01 && <Droplets opacity={view.droplets} />}
      {glowColor && (
        <path
          d={OUTER_PATH}
          fill="none"
          stroke={glowColor}
          strokeWidth={2.4}
          opacity={0.38}
          filter={`url(#${p}blur15)`}
        />
      )}
      {view.sheen !== undefined && view.sheen > 0 && view.sheen < 1 && (
        <g clipPath={`url(#${p}outer)`}>
          <rect
            x={f(-80 + view.sheen * 160)}
            y={-40}
            width={26}
            height={300}
            fill={`url(#${p}sheen)`}
            transform={`rotate(18 0 100)`}
            opacity={0.9}
          />
        </g>
      )}
      {view.reject !== undefined && view.reject > 0.01 && (
        <>
          <path d={OUTER_PATH} fill="#3a4a58" opacity={0.14 * view.reject} />
          <path
            d={OUTER_PATH}
            fill="none"
            stroke="#2a3a48"
            strokeWidth={2.6}
            opacity={0.6 * view.reject}
          />
        </>
      )}
      {corked && <CorkBody p={p} y={corked.y} />}
      {/* 口の縁（厚いガラスの巻き） */}
      <path
        d={`M${-RO - 2.4},2.6 L${-RO - 2.4},5 A${RO + 2.4},5.4 0 0 0 ${RO + 2.4},5 L${RO + 2.4},2.6 A${RO + 2.4},5.4 0 0 1 ${-RO - 2.4},2.6`}
        fill="#e7f1f3"
        fillOpacity={corked ? 0.45 : 0.62}
        stroke="#4d6e7c"
        strokeOpacity={0.5}
        strokeWidth={0.8}
      />
      {corked ? (
        <CorkTop p={p} y={corked.y} />
      ) : (
        <ellipse
          cx={0}
          cy={2.6}
          rx={R + 0.8}
          ry={3.9}
          fill="#46606f"
          fillOpacity={0.14}
          stroke="#fff"
          strokeOpacity={0.75}
          strokeWidth={0.8}
        />
      )}
      <path
        d={`M${-RO - 1.4},1.4 A${RO + 2},4 0 0 1 -5,-1.6`}
        fill="none"
        stroke="#fff"
        strokeWidth={1.3}
        opacity={0.95}
      />
    </>
  );
}

function Droplets({ opacity }: { opacity: number }) {
  const drops = [
    [-11, 62, 1.6],
    [-6, 96, 1.1],
    [8, 74, 1.3],
    [12, 128, 0.9],
    [-13, 140, 1.2],
    [3, 158, 1.4],
  ] as const;
  return (
    <g opacity={opacity}>
      {drops.map(([x, y, r]) => (
        <g key={`${x}-${y}`}>
          <ellipse cx={x} cy={y} rx={r} ry={r * 1.35} fill="#7896a3" opacity={0.18} />
          <ellipse cx={x - r * 0.3} cy={y - r * 0.4} rx={r * 0.45} ry={r * 0.55} fill="#fff" opacity={0.95} />
        </g>
      ))}
    </g>
  );
}

function CorkBody({ p, y }: { p: string; y: number }) {
  const top = -13 + y;
  const d = `M${-R - 0.5},${top} L${-R + 1},${15 + y} Q0,${18.5 + y} ${R - 1},${15 + y} L${R + 0.5},${top} Z`;
  return (
    <>
      <path d={d} fill={`url(#${p}cork)`} />
      <path d={d} fill="#000" filter={`url(#${p}corkTex)`} opacity={0.9} />
      <path d={`M${R * 0.7},${top} L${R * 0.68},${14 + y}`} stroke="#6f4522" strokeWidth={5} opacity={0.2} />
      <path d={`M${-R * 0.7},${top + 2} L${-R * 0.68},${12 + y}`} stroke="#f6d8ad" strokeWidth={3} opacity={0.45} />
    </>
  );
}

function CorkTop({ p, y }: { p: string; y: number }) {
  const top = -13 + y;
  return (
    <>
      <ellipse cx={0} cy={top} rx={R + 0.5} ry={4.2} fill="#d9ad78" stroke="#9d6a3a" strokeWidth={0.8} />
      <ellipse cx={0} cy={top} rx={R + 0.5} ry={4.2} fill="#000" filter={`url(#${p}corkTex)`} opacity={0.65} />
      <path
        d={`M${-R * 0.75},${top - 1.6} A${R * 0.8},2.6 0 0 1 ${R * 0.4},${top - 3}`}
        stroke="#f8e0bb"
        strokeWidth={1}
        fill="none"
        opacity={0.85}
      />
    </>
  );
}
