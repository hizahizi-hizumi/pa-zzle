// 試作 label: 色水の試験管1本。口の中心を原点にした局所座標で描く。
import type { ReactNode } from "react";
import {
  CAVITY_BOTTOM,
  CAVITY_PATH,
  OUTER_PATH,
  type Pose,
  UNIT,
  axisXAt,
  inverseTransform,
  poseTransform,
  tiltedLevel,
  toWorld,
  uprightVolume,
} from "./geometry";
import { baseLiquidColor, liquidTone, mix } from "./palette";

export type Segment = {
  color: number;
  amount: number;
  /** 同じ色どうしの境の線。注ぎ足した直後だけ持つ。 */
  seam?: { amplitude: number; opacity: number; phase: number };
};

export type TubeVisual = {
  key: string;
  pose: Pose;
  segments: readonly Segment[];
  /** 内側の曇り。0 で澄み、1 で曇る。 */
  frost: number;
  /** 封をして液が深まった度合い。 */
  deep: number;
  /** 手詰まりで静まった度合い。 */
  hush: number;
  surfaceWave: number;
  wavePhase: number;
  /** 注ぎ先の口から液面まで落ちる流れ。 */
  inflow?: { color: number; width: number; x: number };
  cork?: { lift: number; angle: number; opacity: number; squash: number };
  /** 封をしたときのガラスのきらめきの進み（0〜1）。 */
  glint: number;
  /** 済んだ管の縁ににじむ色。 */
  rim: number;
};

const n = (value: number) => value.toFixed(2);

function upright(pose: Pose) {
  return Math.abs(pose.angle) < 24;
}

function liquidOfUpright(visual: TubeVisual): ReactNode[] {
  const nodes: ReactNode[] = [];
  let level = 0;
  const bands: { color: number; top: number; bottom: number; seam?: Segment["seam"] }[] = [];
  for (const segment of visual.segments) {
    if (segment.amount <= 0.001) {
      continue;
    }
    const bottom = CAVITY_BOTTOM - UNIT * level;
    level += segment.amount;
    const top = CAVITY_BOTTOM - UNIT * level;
    bands.push({ color: segment.color, top, bottom, seam: segment.seam });
  }
  bands.forEach((band, index) => {
    const tone = liquidTone(band.color, visual.deep);
    const id = `lbl-lq-${visual.key}-${index}`;
    nodes.push(
      <linearGradient key={`g${id}`} id={id} x1="-22" x2="22" y1="0" y2="0" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor={tone.dark} />
        <stop offset=".18" stopColor={tone.light} />
        <stop offset=".5" stopColor={tone.light} />
        <stop offset="1" stopColor={tone.dark} />
      </linearGradient>,
      <rect
        key={`b${id}`}
        x="-24"
        y={n(band.top)}
        width="48"
        height={n(band.bottom - band.top + (index === 0 ? 8 : 0.6))}
        fill={`url(#${id})`}
      />,
    );
  });
  const topBand = bands.at(-1);
  bands.forEach((band, index) => {
    if (index === 0) {
      return;
    }
    const below = bands[index - 1];
    const h = band.bottom;
    if (below && below.color !== band.color) {
      const lineColor = mix(baseLiquidColor(below.color), "#ffffff", 0.6);
      nodes.push(
        <g key={`line${index}`}>
          <path d={`M-22,${n(h)} A22,3 0 0 1 22,${n(h)}`} stroke={lineColor} strokeWidth=".7" fill="none" opacity=".5" />
          <path d={`M-22,${n(h)} A22,3 0 0 0 22,${n(h)}`} stroke="#fff" strokeWidth="2.2" fill="none" opacity=".3" filter="url(#lbl-blur1)" />
          <path d={`M-22,${n(h)} A22,3 0 0 0 22,${n(h)}`} stroke="#fff" strokeWidth=".9" fill="none" opacity={n(0.9 - visual.frost * 0.25)} />
        </g>,
      );
    } else if (band.seam && band.seam.opacity > 0.01) {
      const { amplitude, opacity, phase } = band.seam;
      let d = `M-22,${n(h)}`;
      for (let x = -22; x <= 22; x += 2) {
        const ellipse = 3 * Math.sqrt(Math.max(0, 1 - (x / 22) ** 2));
        d += ` L${x},${n(h + ellipse + Math.sin(x * 0.42 + phase) * amplitude)}`;
      }
      nodes.push(
        <g key={`seam${index}`}>
          <path d={d} stroke="#fff" strokeWidth="1.6" fill="none" opacity={n(opacity * 0.55)} filter="url(#lbl-blur06)" />
          <path d={d} stroke="#fff" strokeWidth=".75" fill="none" opacity={n(opacity)} />
        </g>,
      );
    }
  });
  if (topBand) {
    const h = topBand.top;
    const tone = liquidTone(topBand.color, visual.deep);
    const wave = visual.surfaceWave;
    if (wave > 0.01) {
      let upper = `M-23,${n(h)}`;
      let lower = "";
      for (let x = -23; x <= 23; x += 2) {
        const e = 3.4 * Math.sqrt(Math.max(0, 1 - (x / 22) ** 2));
        upper += ` L${x},${n(h - e + Math.sin(x * 0.5 + visual.wavePhase) * wave)}`;
      }
      for (let x = 23; x >= -23; x -= 2) {
        const e = 3.4 * Math.sqrt(Math.max(0, 1 - (x / 22) ** 2));
        lower += ` L${x},${n(h + e + Math.sin(x * 0.5 + visual.wavePhase + 1) * wave)}`;
      }
      nodes.push(<path key="surface" d={`${upper}${lower}Z`} fill={tone.surface} opacity=".95" />);
      let rim = `M-23,${n(h)}`;
      for (let x = -23; x <= 23; x += 2) {
        const e = 3.4 * Math.sqrt(Math.max(0, 1 - (x / 22) ** 2));
        rim += ` L${x},${n(h + e + Math.sin(x * 0.5 + visual.wavePhase + 1) * wave)}`;
      }
      nodes.push(<path key="surface-rim" d={rim} stroke="#fff" strokeWidth="1" fill="none" opacity=".85" />);
    } else {
      nodes.push(
        <ellipse key="surface" cx="0" cy={n(h)} rx="23" ry="3.4" fill={tone.surface} opacity=".95" />,
        <path key="surface-rim" d={`M-22,${n(h)} A22,3.4 0 0 0 22,${n(h)}`} stroke="#fff" strokeWidth="1" fill="none" opacity=".9" />,
        <path key="surface-hl" d={`M-15,${n(h - 1.2)} A16,2 0 0 1 4,${n(h - 2.6)}`} stroke="#fff" strokeWidth=".8" fill="none" opacity=".55" />,
      );
    }
  }
  if (visual.inflow && topBand) {
    const { color, width, x } = visual.inflow;
    const tone = liquidTone(color, visual.deep);
    nodes.push(
      <g key="inflow">
        <rect x={n(x - width / 2)} y="-4" width={n(width)} height={n(topBand.top + 4)} fill={tone.light} />
        <rect x={n(x - width / 2)} y="-4" width={n(Math.max(0.5, width * 0.3))} height={n(topBand.top + 4)} fill="#fff" opacity=".45" />
        <ellipse cx={n(x)} cy={n(topBand.top + 0.6)} rx={n(5 + width * 2)} ry="1.6" fill="none" stroke="#fff" strokeWidth=".9" opacity=".7" />
        <ellipse cx={n(x)} cy={n(topBand.top + 1)} rx={n(9 + width * 3)} ry="2.6" fill="none" stroke="#fff" strokeWidth=".6" opacity=".35" />
      </g>,
    );
  }
  return nodes;
}

function liquidOfTilted(visual: TubeVisual): ReactNode[] {
  const { pose } = visual;
  const segments = visual.segments.filter((segment) => segment.amount > 0.001);
  if (segments.length === 0) {
    return [];
  }
  let level = 0;
  const volumes = segments.map((segment) => {
    const start = uprightVolume(level);
    level += segment.amount;
    return { color: segment.color, volume: uprightVolume(level) - start };
  });
  const mouthDown = Math.cos((pose.angle * Math.PI) / 180) < 0;
  const deepestFirst = mouthDown ? [...volumes].reverse() : volumes;
  const nodes: ReactNode[] = [];
  const [cx] = toWorld(pose, 0, 100);
  let accumulated = 0;
  let previous = 4000;
  const levels: number[] = [];
  deepestFirst.forEach((item, index) => {
    accumulated += item.volume;
    const h = tiltedLevel(pose, accumulated);
    const tone = liquidTone(item.color, visual.deep);
    const id = `lbl-tl-${visual.key}-${index}`;
    nodes.push(
      <linearGradient key={`g${id}`} id={id} x1="0" x2="0" y1={n(h)} y2={n(h + 120)} gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor={tone.light} />
        <stop offset="1" stopColor={tone.dark} />
      </linearGradient>,
      <rect key={`b${id}`} x={n(cx - 300)} y={n(h)} width="600" height={n(Math.min(previous, h + 600) - h + 0.6)} fill={`url(#${id})`} />,
    );
    levels.push(h);
    previous = h;
  });
  levels.forEach((h, index) => {
    const isTop = index === levels.length - 1;
    nodes.push(
      <rect key={`l${index}`} x={n(cx - 300)} y={n(h - (isTop ? 0.7 : 0.5))} width="600" height={isTop ? 1.4 : 1} fill="#fff" opacity={isTop ? 0.75 : 0.85} />,
    );
  });
  return [<g key="world" transform={inverseTransform(pose)}>{nodes}</g>];
}

export function TubeGlass({ visual }: { visual: TubeVisual }) {
  const { pose, cork } = visual;
  const frost = Math.min(1.3, visual.frost * (1 + visual.hush * 0.3));
  const liquid = upright(pose) ? liquidOfUpright(visual) : liquidOfTilted(visual);
  const sealedColor = visual.segments[0] ? baseLiquidColor(visual.segments[0].color) : "#fff";
  return (
    <g transform={poseTransform(pose)}>
      <rect x="-22" y="0" width="44" height="200" fill="url(#lbl-cyl)" clipPath="url(#lbl-cavity)" />
      <g clipPath="url(#lbl-cavity)">
        {liquid}
        {frost > 0.01 && (
          <>
            <rect x="-24" y="0" width="48" height="200" fill="#eef3f6" opacity={n(frost * 0.1)} />
            <rect x="-24" y="0" width="48" height="200" fill="url(#lbl-frost)" opacity={n(frost * 0.55)} />
            <rect x="-24" y="0" width="48" height="60" fill="#f6f9fb" opacity={n(frost * 0.22)} />
          </>
        )}
        {visual.hush > 0.01 && (
          <rect x="-24" y="0" width="48" height="200" fill="#8c97a3" opacity={n(visual.hush * 0.12 * Math.min(1, visual.frost))} />
        )}
        {visual.deep > 0.01 && (
          <rect x="-9" y="20" width="3" height="150" rx="1.5" fill="#fff" opacity={n(visual.deep * 0.35)} filter="url(#lbl-blur06)" />
        )}
        {visual.glint > 0 && visual.glint < 1 && (
          <rect x="-24" y={n(-30 + visual.glint * 240)} width="48" height="34" fill="url(#lbl-glint)" opacity=".7" transform="skewY(-18)" />
        )}
      </g>
      <path d={OUTER_PATH} fill="url(#lbl-glass)" stroke="rgba(74,94,118,.44)" strokeWidth="1" />
      <path d={CAVITY_PATH} fill="none" stroke="rgba(255,255,255,.45)" strokeWidth=".8" />
      <rect x="-19.5" y="14" width="4.6" height="160" rx="2.3" fill="url(#lbl-hl)" opacity=".85" />
      <path d="M-24.3,10 L-24.3,172 A24.3,24.3 0 0 0 -14,193" stroke="#fff" strokeWidth=".9" fill="none" opacity=".75" />
      <rect x="15.5" y="20" width="1.6" height="146" rx=".8" fill="#fff" opacity=".28" />
      <path d="M-12,188 A20,20 0 0 0 6,190" stroke="#fff" strokeWidth="1.3" fill="none" opacity=".45" />
      {visual.rim > 0.01 && (
        <path d={OUTER_PATH} fill="none" stroke={sealedColor} strokeWidth="2.4" opacity={n(visual.rim * 0.4)} filter="url(#lbl-blur1)" />
      )}
      <ellipse cx="0" cy="4" rx="28.5" ry="5.2" fill="rgba(255,255,255,.38)" stroke="rgba(74,94,118,.5)" strokeWidth="1" />
      {cork && cork.opacity > 0 ? (
        <g opacity={n(cork.opacity)} transform={`translate(0 ${n(-cork.lift)}) rotate(${n(cork.angle)} 0 -12) translate(0 14) scale(${n(1 + cork.squash * 0.06)} ${n(1 - cork.squash * 0.08)}) translate(0 -14)`}>
          <path d="M-21,-12 L-19.5,14 Q0,17.5 19.5,14 L21,-12 Z" fill="url(#lbl-cork)" />
          <path d="M-21,-12 L-19.5,14 Q0,17.5 19.5,14 L21,-12 Z" fill="url(#lbl-cork-dots)" />
          <path d="M14,-12 L13.5,14" stroke="#7c5129" strokeWidth="4" opacity=".2" />
          <path d="M-15,-10 L-14.5,12" stroke="#f3d2a4" strokeWidth="2.4" opacity=".45" />
          <ellipse cx="0" cy="-12" rx="21" ry="3.6" fill="#d9ad78" stroke="#a47040" strokeWidth=".8" />
          <ellipse cx="0" cy="-12" rx="21" ry="3.6" fill="url(#lbl-cork-dots)" />
          <path d="M-15,-13.5 A16,2.2 0 0 1 8,-14.6" stroke="#f6dcb5" strokeWidth="1" fill="none" opacity=".8" />
        </g>
      ) : null}
      <path
        d="M-28.5,4 L-28.5,6.5 A28.5,5.2 0 0 0 28.5,6.5 L28.5,4 A28.5,5.2 0 0 1 -28.5,4"
        fill={`rgba(220,232,242,${cork && cork.opacity > 0.5 && cork.lift < 4 ? 0.3 : 0.55})`}
        stroke="rgba(74,94,118,.45)"
        strokeWidth=".8"
      />
      {!(cork && cork.opacity > 0.5 && cork.lift < 4) && (
        <ellipse cx="0" cy="4" rx="23.5" ry="3.6" fill="rgba(70,92,115,.16)" stroke="rgba(255,255,255,.7)" strokeWidth=".8" />
      )}
      <path d="M-25,2.2 A27,4.2 0 0 1 -4,-0.6" stroke="#fff" strokeWidth="1.2" fill="none" opacity=".9" />
    </g>
  );
}

/** 傾けた管の口の縁（流れが落ち始める所）の世界座標。 */
export function lipPoint(pose: Pose): [number, number] {
  const direction = pose.angle >= 0 ? 1 : -1;
  return toWorld(pose, 22 * direction, 1);
}

export function surfaceY(pose: Pose, amount: number): number {
  return pose.y + CAVITY_BOTTOM - UNIT * amount;
}

export { axisXAt };
