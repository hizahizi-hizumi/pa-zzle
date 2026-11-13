// 試験管1本: ガラス、色水の層と層の境の液面の線、コルク栓。
import type { ReactNode } from "react";
import { lighten, liquidColor } from "./colors";
import {
  apply,
  CAVITY_PATH,
  OUTER_PATH,
  type Pose,
  poseTransform,
  tiltedLevel,
  uprightLevel,
} from "./geometry";

export type LiquidRun = { color: number; amount: number };

export type TubeVisual = {
  runs: readonly LiquidRun[];
  /** 1色で満ちた明るさ（0〜1）。 */
  done: number;
  /** コルク栓。null なら無い。drop は栓の浮き（0 ではまる）。 */
  cork: { drop: number; opacity: number; press: number } | null;
  /** 注いだ色と同じ色の上に残る、前の液面の線。揺れて消える。 */
  seam: { level: number; amp: number; opacity: number; phase: number } | null;
  surfaceWave: number;
  wavePhase: number;
  splash: number;
  /** 注ぎ先の中へ落ちる流れ（局所座標）。 */
  innerStream: {
    x: number;
    width: number;
    color: number;
    top: number;
  } | null;
  bubbles: readonly { x: number; y: number; r: number; o: number }[];
  /** 線が消えた所から広がる光（0〜1）。 */
  mergeGlow: { level: number; strength: number } | null;
  /** ガラスを走る光（0〜1 の進み）。null なら無い。 */
  glint: number | null;
  /** 栓がはまった瞬間に口の縁から広がる光の輪（0〜1 の進み）。 */
  corkBurst: number | null;
};

export const EMPTY_VISUAL: TubeVisual = {
  runs: [],
  done: 0,
  cork: null,
  seam: null,
  surfaceWave: 0,
  wavePhase: 0,
  splash: 0,
  innerStream: null,
  bubbles: [],
  mergeGlow: null,
  glint: null,
  corkBurst: null,
};

type TubeViewProps = {
  id: string;
  pose: Pose;
  visual: TubeVisual;
};

/** これより大きく傾けたときは、液面を世界の水平に保って描く。 */
const UPRIGHT_LIMIT = 6;

export function TubeView({ id, pose, visual }: TubeViewProps) {
  const upright = Math.abs(pose.a) <= UPRIGHT_LIMIT;
  return (
    <g>
      {upright ? (
        <g transform={poseTransform(pose)}>
          <g clipPath="url(#tb-cav)">{uprightLiquid(visual)}</g>
        </g>
      ) : (
        tiltedLiquid(id, pose, visual)
      )}
      <g transform={poseTransform(pose)}>{glass(visual)}</g>
    </g>
  );
}

function totalAmount(runs: readonly LiquidRun[]) {
  return runs.reduce((sum, run) => sum + run.amount, 0);
}

function wavyPath(
  y: number,
  half: number,
  depth: number,
  amp: number,
  phase: number,
  front: boolean,
) {
  let d = "";
  for (let x = -half; x <= half + 0.01; x += 2) {
    const e = Math.sqrt(Math.max(0, 1 - (x / half) ** 2));
    const yy =
      y + (front ? depth : -depth) * e + Math.sin(x * 0.42 + phase) * amp * e;
    d += `${d ? " L" : "M"}${x.toFixed(2)},${yy.toFixed(2)}`;
  }
  return d;
}

function uprightLiquid(visual: TubeVisual): ReactNode {
  const { runs } = visual;
  const nodes: ReactNode[] = [];
  let acc = 0;
  const bounds: { color: number; top: number; bottom: number }[] = [];
  for (const run of runs) {
    if (run.amount <= 0.001) continue;
    const bottom = uprightLevel(acc);
    acc += run.amount;
    bounds.push({ color: run.color, top: uprightLevel(acc), bottom });
  }
  const total = acc;
  bounds.forEach((band, index) => {
    nodes.push(
      <rect
        key={`b${index}`}
        x={-23}
        y={band.top}
        width={46}
        height={band.bottom - band.top + (index === 0 ? 30 : 0.6)}
        fill={`url(#tb-lq-${band.color})`}
      />,
    );
  });

  if (visual.done > 0 && total > 0) {
    nodes.push(
      <rect
        key="done"
        x={-23}
        y={uprightLevel(total)}
        width={46}
        height={200}
        fill="#fff"
        opacity={0.1 * visual.done}
      />,
    );
  }

  if (visual.mergeGlow && visual.mergeGlow.strength > 0) {
    const g = visual.mergeGlow;
    const y = uprightLevel(g.level);
    const surfaceY = uprightLevel(total);
    nodes.push(
      <g key="mglow">
        <rect
          x={-23}
          y={surfaceY}
          width={46}
          height={Math.max(0, uprightLevel(Math.max(0, g.level - 1)) - surfaceY)}
          fill="#fff"
          opacity={0.2 * g.strength}
        />
        <ellipse
          cx={0}
          cy={y}
          rx={30}
          ry={8 + 30 * (1 - g.strength)}
          fill="url(#tb-glow)"
          opacity={0.85 * g.strength}
        />
      </g>,
    );
  }

  if (visual.innerStream) {
    const s = visual.innerStream;
    const surfaceY = uprightLevel(total);
    if (surfaceY > s.top) {
      const color = liquidColor(s.color);
      nodes.push(
        <g key="stream">
          <rect
            x={s.x - s.width / 2}
            y={s.top}
            width={s.width}
            height={surfaceY - s.top + 1}
            fill={color.light}
          />
          <rect
            x={s.x - s.width / 2}
            y={s.top}
            width={Math.max(0.5, s.width * 0.3)}
            height={surfaceY - s.top}
            fill="#fff"
            opacity={0.55}
          />
        </g>,
      );
    }
  }

  // 層の境: 前の弧が光る液面の線、奥の弧は上の液越しに淡く。
  bounds.slice(0, -1).forEach((band, index) => {
    const y = band.top;
    const light = liquidColor(band.color).light;
    nodes.push(
      <g key={`l${index}`}>
        <path
          d={`M-22,${y} A22,3 0 0 1 22,${y}`}
          stroke={lighten(light, 0.6)}
          strokeWidth={0.8}
          fill="none"
          opacity={0.6}
        />
        <path
          d={`M-22,${y} A22,3 0 0 0 22,${y}`}
          stroke="#fff"
          strokeWidth={2.4}
          fill="none"
          opacity={0.35}
          filter="url(#tb-blur1)"
        />
        <path
          d={`M-22,${y} A22,3 0 0 0 22,${y}`}
          stroke="#fff"
          strokeWidth={1}
          fill="none"
          opacity={0.95}
        />
      </g>,
    );
  });

  if (visual.seam && visual.seam.opacity > 0.01) {
    const s = visual.seam;
    const y = uprightLevel(s.level);
    const front = wavyPath(y, 22, 3, s.amp, s.phase, true);
    const back = wavyPath(y, 22, 3, s.amp * 0.8, s.phase + 1.3, false);
    nodes.push(
      <g key="seam">
        <path
          d={back}
          stroke="#fff"
          strokeWidth={0.8}
          fill="none"
          opacity={0.45 * s.opacity}
        />
        <path
          d={front}
          stroke="#fff"
          strokeWidth={3.4}
          fill="none"
          opacity={0.55 * s.opacity}
          filter="url(#tb-blur1)"
        />
        <path
          d={front}
          stroke="#fff"
          strokeWidth={1.3}
          fill="none"
          opacity={s.opacity}
        />
      </g>,
    );
  }

  for (const [index, bubble] of visual.bubbles.entries()) {
    nodes.push(
      <circle
        key={`bb${index}`}
        cx={bubble.x}
        cy={bubble.y}
        r={bubble.r}
        fill="#fff"
        fillOpacity={0.25 * bubble.o}
        stroke="#fff"
        strokeWidth={0.6}
        strokeOpacity={0.85 * bubble.o}
      />,
    );
  }

  const top = bounds[bounds.length - 1];
  if (top) {
    const y = top.top;
    const surface = lighten(liquidColor(top.color).light, 0.4);
    const w = visual.surfaceWave;
    if (w > 0.02) {
      const front = wavyPath(y, 23, 3.4, w, visual.wavePhase, true);
      const back = wavyPath(y, 23, 3.4, w, visual.wavePhase + 1, false);
      const backReversed = back
        .split(" L")
        .map((p) => p.replace("M", ""))
        .reverse()
        .join(" L");
      nodes.push(
        <g key="surf">
          <path
            d={`${front} L${backReversed} Z`}
            fill={surface}
            opacity={0.95}
          />
          <path
            d={front}
            stroke="#fff"
            strokeWidth={1}
            fill="none"
            opacity={0.9}
          />
        </g>,
      );
    } else {
      nodes.push(
        <g key="surf">
          <ellipse
            cx={0}
            cy={y}
            rx={23}
            ry={3.4}
            fill={surface}
            opacity={0.95}
          />
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
            opacity={0.6}
          />
        </g>,
      );
    }
    if (visual.splash > 0.01 && visual.innerStream) {
      const sx = visual.innerStream.x;
      const k = visual.splash;
      nodes.push(
        <g key="splash">
          <ellipse
            cx={sx}
            cy={y + 0.5}
            rx={4 + 7 * k}
            ry={1 + 1.6 * k}
            fill="none"
            stroke="#fff"
            strokeWidth={0.9}
            opacity={0.8}
          />
          <ellipse
            cx={sx}
            cy={y + 0.8}
            rx={8 + 12 * k}
            ry={1.6 + 2.2 * k}
            fill="none"
            stroke="#fff"
            strokeWidth={0.6}
            opacity={0.45}
          />
        </g>,
      );
    }
  }

  return nodes;
}

function tiltedLiquid(id: string, pose: Pose, visual: TubeVisual): ReactNode {
  const runs = visual.runs.filter((run) => run.amount > 0.001);
  if (runs.length === 0) return null;
  const clipId = `tb-tc-${id}`;
  const facingUp = Math.cos((pose.a * Math.PI) / 180) > 0;
  // 液は低い所から溜まる。口が下を向くほど傾いたときは上の層から先に低い所へ来る。
  const ordered = facingUp ? runs : [...runs].reverse();
  const [cx] = apply(pose, 0, 100);
  const bands: { color: number; top: number; bottom: number }[] = [];
  let acc = 0;
  let previous = pose.y + 400;
  for (const run of ordered) {
    acc += run.amount;
    const top = pose.y + tiltedLevel(pose.a, acc);
    bands.push({ color: run.color, top, bottom: previous });
    previous = top;
  }
  return (
    <g>
      <clipPath id={clipId}>
        <path d={CAVITY_PATH} transform={poseTransform(pose)} />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        {bands.map((band, index) => (
          <rect
            // biome-ignore lint/suspicious/noArrayIndexKey: 層の並びは描くたびに同じ
            key={index}
            x={cx - 260}
            y={band.top}
            width={520}
            height={band.bottom - band.top + 0.6}
            fill={`url(#tb-lqb-${band.color})`}
          />
        ))}
        {bands.map((band, index) => (
          <rect
            // biome-ignore lint/suspicious/noArrayIndexKey: 層の並びは描くたびに同じ
            key={`s${index}`}
            x={cx - 260}
            y={band.top - 0.6}
            width={520}
            height={index === bands.length - 1 ? 1.4 : 1}
            fill="#fff"
            opacity={index === bands.length - 1 ? 0.75 : 0.9}
          />
        ))}
      </g>
    </g>
  );
}

function glass(visual: TubeVisual): ReactNode {
  const top = visual.runs.find((run) => run.amount > 0);
  const doneColor = top ? liquidColor(top.color).light : "#fff";
  const cork = visual.cork;
  return (
    <>
      <g clipPath="url(#tb-cav)">
        <rect x={-22} y={0} width={44} height={200} fill="url(#tb-cyl)" />
      </g>
      <path
        d={OUTER_PATH}
        fill="url(#tb-glass)"
        stroke="rgba(70,92,116,.45)"
        strokeWidth={1}
      />
      <path
        d={CAVITY_PATH}
        fill="none"
        stroke="rgba(255,255,255,.5)"
        strokeWidth={0.8}
      />
      <rect
        x={-19.5}
        y={14}
        width={4.6}
        height={160}
        rx={2.3}
        fill="url(#tb-hl)"
        filter="url(#tb-blur06)"
      />
      <path
        d="M-24.3,10 L-24.3,172 A24.3,24.3 0 0 0 -14,193"
        stroke="#fff"
        strokeWidth={0.9}
        fill="none"
        opacity={0.75}
      />
      <rect
        x={15.5}
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
        strokeWidth={1.3}
        fill="none"
        opacity={0.55}
        filter="url(#tb-blur06)"
      />
      {visual.done > 0 && (
        <path
          d={OUTER_PATH}
          fill="none"
          stroke={doneColor}
          strokeWidth={2.4}
          opacity={0.4 * visual.done}
          filter="url(#tb-blur1)"
        />
      )}
      <ellipse
        cx={0}
        cy={4}
        rx={28.5}
        ry={5.2}
        fill="rgba(255,255,255,.38)"
        stroke="rgba(70,92,116,.5)"
        strokeWidth={1}
      />
      {cork && corkBody(cork)}
      <path
        d="M-28.5,4 L-28.5,6.5 A28.5,5.2 0 0 0 28.5,6.5 L28.5,4 A28.5,5.2 0 0 1 -28.5,4"
        fill={`rgba(220,232,242,${cork && cork.drop < 6 ? 0.3 : 0.55})`}
        stroke="rgba(70,92,116,.45)"
        strokeWidth={0.8}
      />
      {cork ? (
        corkTop(cork)
      ) : (
        <ellipse
          cx={0}
          cy={4}
          rx={23.5}
          ry={3.6}
          fill="rgba(70,92,116,.16)"
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
      {visual.glint !== null && glint(visual.glint)}
      {visual.corkBurst !== null && corkBurst(visual.corkBurst)}
    </>
  );
}

function corkOffset(cork: NonNullable<TubeVisual["cork"]>) {
  return -cork.drop + cork.press;
}

function corkBody(cork: NonNullable<TubeVisual["cork"]>): ReactNode {
  const dy = corkOffset(cork);
  return (
    <g transform={`translate(0 ${dy})`} opacity={cork.opacity}>
      <path
        d="M-21,-12 L-19.5,14 Q0,17.5 19.5,14 L21,-12 Z"
        fill="url(#tb-cork)"
      />
      <path
        d="M-21,-12 L-19.5,14 Q0,17.5 19.5,14 L21,-12 Z"
        fill="#000"
        filter="url(#tb-cork-tex)"
        opacity={0.9}
      />
      <path d="M14,-12 L13.5,14" stroke="#7c5129" strokeWidth={4} opacity={0.2} />
      <path
        d="M-15,-10 L-14.5,12"
        stroke="#f6d8ac"
        strokeWidth={2.4}
        opacity={0.5}
      />
    </g>
  );
}

function corkTop(cork: NonNullable<TubeVisual["cork"]>): ReactNode {
  const dy = corkOffset(cork);
  return (
    <g transform={`translate(0 ${dy})`} opacity={cork.opacity}>
      <ellipse
        cx={0}
        cy={-12}
        rx={21}
        ry={3.6}
        fill="#dcb07b"
        stroke="#a06c3c"
        strokeWidth={0.8}
      />
      <ellipse
        cx={0}
        cy={-12}
        rx={21}
        ry={3.6}
        fill="#000"
        filter="url(#tb-cork-tex)"
        opacity={0.7}
      />
      <path
        d="M-15,-13.5 A16,2.2 0 0 1 8,-14.6"
        stroke="#f8dfb8"
        strokeWidth={1}
        fill="none"
        opacity={0.85}
      />
    </g>
  );
}

function glint(progress: number): ReactNode {
  const y = 20 + progress * 150;
  const o = Math.sin(Math.PI * Math.min(1, progress)) * 0.95;
  return (
    <g opacity={o}>
      <circle cx={-17} cy={y} r={10} fill="url(#tb-sparkle)" />
      <path
        d={`M-17,${y - 11} L-16,${y - 1} L-17,${y + 11} L-18,${y - 1} Z M-28,${y} L-18,${y - 1} L-6,${y} L-18,${y + 1} Z`}
        fill="#fff"
      />
    </g>
  );
}

function corkBurst(progress: number): ReactNode {
  const k = 1 - (1 - progress) ** 2;
  const o = 1 - progress;
  return (
    <g>
      <ellipse
        cx={0}
        cy={2}
        rx={26 + 22 * k}
        ry={5 + 5 * k}
        fill="none"
        stroke="#fff"
        strokeWidth={2.2 * o + 0.4}
        opacity={0.9 * o}
      />
      {[-1, 1].map((side) =>
        [0, 1, 2].map((n) => {
          const angle = (-30 - n * 28) * (Math.PI / 180);
          const r = 22 + 18 * k;
          return (
            <circle
              key={`${side}${n}`}
              cx={side * Math.cos(angle) * r}
              cy={-6 + Math.sin(angle) * r * 0.6 + 10 * k * k}
              r={1.4 * o + 0.3}
              fill="#fff6e4"
              opacity={o}
            />
          );
        }),
      )}
    </g>
  );
}
