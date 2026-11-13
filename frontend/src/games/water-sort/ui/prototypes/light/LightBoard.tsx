import { type ReactNode, useEffect, useId, useMemo } from "react";
import { classifyWaterSortDeadlock } from "@/games/water-sort/puzzle/deadlock";
import {
  isCompleteWaterSortBottle,
  isWaterSortCleared,
} from "@/games/water-sort/puzzle/state";
import type { WaterSortBoardProps } from "@/games/water-sort/ui/board/WaterSortBoard";
import { getWaterColorView } from "@/games/water-sort/ui/board/water-bottle/get-water-color-view";
import { setLightMood } from "./light-mood";
import {
  type LiquidBlock,
  pourTilt,
  tiltedBands,
  toBlocks,
  totalAmount,
} from "./liquid";
import {
  BOT,
  CAVITY_H,
  clamp01,
  easeInOut,
  easeOut,
  getSceneLayout,
  LIFT,
  lerp,
  lighten,
  liquidColor,
  mixColor,
  OUTER_BOT,
  RACK,
  type SceneLayout,
  SHELF_FRONT,
  type Slot,
  TIER,
  TIER_BOTTOM,
  TUBE,
} from "./scene";
import { usePourSounds } from "./use-pour-sounds";
import {
  CORK_MS,
  FINALE_MS,
  FLOW_END,
  FLOW_START,
  type MotionSnapshot,
  POUR_MS,
  type PourMotion,
  REVEAL_MS,
  SHAKE_MS,
  useLightMotion,
} from "./use-light-motion";

const { RO, RI, U, CAV_TOP } = TUBE;
const CAV_D = `M${-RI},${CAV_TOP} L${-RI},${BOT - RI} A${RI},${RI} 0 0 0 ${RI},${BOT - RI} L${RI},${CAV_TOP} Z`;
const OUT_D = `M${-RO},4 L${-RO},${BOT - RI} A${RO},${RO} 0 0 0 ${RO},${BOT - RI} L${RO},4`;
const OUT_FILL_D = `${OUT_D} Z`;
/** 光の差す向き（棚板の上での、管の真下から色影が伸びる向き。度） */
const LIGHT_ANGLE = 33;
const SHADOW_LENGTH = 55;

type Pose = { x: number; y: number; angle: number };

type TubeView = {
  index: number;
  slot: Slot;
  blocks: LiquidBlock[];
  pose: Pose;
  /** 小さな揺れ（度、底を軸に） */
  sway: number;
  /** 棚から離れている度合い（色影が細く伸びる） */
  detach: number;
  /** 色影の濃さ */
  shadowStrength: number;
  complete: boolean;
  /** コルク栓のはまり具合（0〜1）。null なら栓は無い */
  cork: number | null;
  reveal: number;
  /** 顔を出した色を知らせる光の輪の広がり（0〜1） */
  revealRing: number;
  wave: number;
  splash: number;
  ghost: { level: number; opacity: number; amp: number } | null;
  glint: number | null;
  lift: number;
  flying: boolean;
};

export function LightBoard({
  state,
  sourceBottleIndex,
  operation,
  onSelectBottle,
  interactionDisabled,
  onPourAnimationActivityChange,
  onClearAnimationComplete,
}: WaterSortBoardProps) {
  const uid = useId().replace(/:/g, "");
  const layout = useMemo(() => getSceneLayout(state.length), [state.length]);
  const deadlocked = useMemo(
    () =>
      !isWaterSortCleared(state) &&
      classifyWaterSortDeadlock(state) === "deadlocked",
    [state],
  );
  const cleared = useMemo(() => isWaterSortCleared(state), [state]);
  const { snapshot, settleBottle } = useLightMotion({
    bottleCount: state.length,
    operation,
    sourceBottleIndex,
    deadlocked,
    onActivityChange: onPourAnimationActivityChange,
    onClearAnimationComplete,
  });
  usePourSounds(operation);

  const now = snapshot.now;
  const finale =
    snapshot.finaleStart !== null
      ? easeOut((now - snapshot.finaleStart) / 1000)
      : cleared && snapshot.pours.length === 0
        ? 1
        : 0;
  const finaleT =
    snapshot.finaleStart !== null
      ? clamp01((now - snapshot.finaleStart) / FINALE_MS)
      : 0;
  const dim = snapshot.dim;

  const moodKind = finale > 0 ? "clear" : deadlocked ? "dim" : "normal";
  const moodColors = useMemo(
    () =>
      state
        .filter((bottle) => bottle.length > 0)
        .map((bottle) => liquidColor(bottle[0] ?? 0)[0]),
    [state],
  );
  useEffect(() => {
    setLightMood({
      kind: moodKind,
      colors: moodKind === "clear" ? moodColors : [],
    });
  }, [moodKind, moodColors]);
  useEffect(() => () => setLightMood({ kind: "normal", colors: [] }), []);

  const views = state.map((bottle, index) =>
    buildTubeView(index, bottle, layout, snapshot, finaleT),
  );

  const staticRack = useMemo(() => renderStaticRack(layout, uid), [layout, uid]);
  const defs = useMemo(() => renderDefs(uid), [uid]);

  const lightAngle = LIGHT_ANGLE + dim * 9;
  const shadowFade = 1 - dim * 0.55;

  function select(bottleIndex: number) {
    if (interactionDisabled) return;
    settleBottle(bottleIndex);
    onSelectBottle(bottleIndex);
  }

  const aspect = layout.width / layout.height;

  return (
    <div className="flex size-full items-center justify-center [container-type:size]">
      <div
        className="relative"
        style={{
          aspectRatio: `${layout.width} / ${layout.height}`,
          width: `min(100cqw, calc(100cqh * ${aspect}))`,
        }}
      >
        <svg
          aria-hidden="true"
          className="absolute inset-0 size-full overflow-visible"
          viewBox={`0 0 ${layout.width} ${layout.height}`}
        >
          {defs}
          {staticRack.floor}
          {finale > 0 && (
            <ellipse
              cx={layout.width * 0.45}
              cy={layout.height * 0.5}
              rx={layout.width * 0.46}
              ry={layout.height * 0.42}
              fill="#fff4d6"
              opacity={0.55 * finale}
              filter={`url(#${uid}-b7)`}
            />
          )}
          {([0, 1] as const).map((tier) => (
            <g key={tier}>
              {staticRack.back[tier]}
              <g clipPath={`url(#${uid}-shelf${tier})`}>
                {finale > 0 &&
                  views
                    .filter((v) => v.slot.tier === tier)
                    .map((v) => renderWash(v, uid, finale, lightAngle))}
                {views
                  .filter((v) => v.slot.tier === tier)
                  .map((v) =>
                    renderShadow(v, uid, lightAngle, shadowFade, finale),
                  )}
              </g>
              {views
                .filter((v) => v.slot.tier === tier && !v.flying)
                .map((v) => renderTube(v, uid, dim))}
              {staticRack.front[tier]}
            </g>
          ))}
          {staticRack.posts}
          {snapshot.pours.map((pour) =>
            renderStream(pour, layout, now, uid),
          )}
          {views.filter((v) => v.flying).map((v) => renderTube(v, uid, dim))}
          <rect
            x={-40}
            y={-40}
            width={layout.width + 80}
            height={layout.height + 80}
            fill="#26364a"
            opacity={dim * 0.1}
            pointerEvents="none"
          />
        </svg>
        {state.map((bottle, bottleIndex) => {
          const slot = layout.slots[bottleIndex];
          if (!slot) return null;
          const bottleLabel = `ボトル ${bottleIndex + 1}`;
          const contents =
            bottle.length === 0
              ? "空"
              : bottle
                  .map((colorIndex) => getWaterColorView(colorIndex).name)
                  .join("、");
          const left = slot.x - RO - 9;
          const top = slot.ty - LIFT - 6;
          return (
            <button
              key={bottleLabel}
              type="button"
              aria-label={`${bottleLabel}: ${contents}`}
              aria-pressed={bottleIndex === sourceBottleIndex}
              disabled={interactionDisabled}
              onClick={() => select(bottleIndex)}
              className="absolute cursor-pointer touch-manipulation rounded-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{
                left: `${(left / layout.width) * 100}%`,
                top: `${(top / layout.height) * 100}%`,
                width: `${((RO * 2 + 18) / layout.width) * 100}%`,
                height: `${((OUTER_BOT + LIFT + 14) / layout.height) * 100}%`,
                WebkitTapHighlightColor: "transparent",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 状態から見え方へ

function restPose(slot: Slot, lift: number): Pose {
  return { x: slot.x, y: slot.ty - lift * LIFT, angle: 0 };
}

function rotate(x: number, y: number, angleDeg: number): [number, number] {
  const a = (angleDeg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [x * c - y * s, x * s + y * c];
}

function poseFromLip(
  lip: [number, number],
  lipLocal: [number, number],
  angle: number,
): Pose {
  const [rx, ry] = rotate(lipLocal[0], lipLocal[1], angle);
  return { x: lip[0] - rx, y: lip[1] - ry, angle };
}

function pourDirection(pour: PourMotion, layout: SceneLayout): 1 | -1 {
  const src = layout.slots[pour.src];
  const dst = layout.slots[pour.dst];
  if (!src || !dst) return 1;
  let dir: 1 | -1 =
    src.x < dst.x ? 1 : src.x > dst.x ? -1 : dst.x > layout.width / 2 ? 1 : -1;
  const reach = OUTER_BOT + 4;
  if (dir === 1 && dst.x - reach < -6) dir = -1;
  if (dir === -1 && dst.x + reach > layout.width + 6) dir = 1;
  return dir;
}

type PourFrame = {
  pose: Pose;
  moved: number;
  flow: number;
  away: number;
  lip: [number, number];
};

function pourFrame(pour: PourMotion, layout: SceneLayout, now: number): PourFrame {
  const src = layout.slots[pour.src] as Slot;
  const dst = layout.slots[pour.dst] as Slot;
  const t = clamp01((now - pour.start) / POUR_MS);
  const dir = pourDirection(pour, layout);
  const lipLocal: [number, number] = [dir * (RI + 1), CAV_TOP - 1];
  const hover: [number, number] = [dst.x - dir * 4, dst.ty - 14];
  const prepAngle = dir * 36;
  const lipPrep: [number, number] = [hover[0] - dir * 12, hover[1] - 24];
  const prepPose = poseFromLip(lipPrep, lipLocal, prepAngle);
  const startAngle = dir * pourTilt(pour.srcBefore.length);
  const endAngle = dir * pourTilt(pour.srcAfter.length);
  const start = restPose(src, pour.startLift);
  const home = restPose(src, 0);
  const T1 = 0.22;
  const T4 = 0.8;
  let pose: Pose;
  let moved = 0;
  if (t < T1) {
    const u = easeInOut(t / T1);
    pose = {
      x: lerp(start.x, prepPose.x, u),
      y: lerp(start.y, prepPose.y, u) - Math.sin(Math.PI * u) * 18,
      angle: lerp(0, prepAngle, u),
    };
  } else if (t < FLOW_START) {
    const u = easeInOut((t - T1) / (FLOW_START - T1));
    pose = poseFromLip(
      [lerp(lipPrep[0], hover[0], u), lerp(lipPrep[1], hover[1], u)],
      lipLocal,
      lerp(prepAngle, startAngle, u),
    );
  } else if (t < FLOW_END) {
    const u = easeInOut((t - FLOW_START) / (FLOW_END - FLOW_START));
    moved = pour.amount * u;
    pose = poseFromLip(hover, lipLocal, lerp(startAngle, endAngle, u));
  } else if (t < T4) {
    const u = easeInOut((t - FLOW_END) / (T4 - FLOW_END));
    moved = pour.amount;
    pose = poseFromLip(
      [lerp(hover[0], lipPrep[0], u), lerp(hover[1], lipPrep[1], u)],
      lipLocal,
      lerp(endAngle, prepAngle, u),
    );
  } else {
    const u = easeInOut((t - T4) / (1 - T4));
    moved = pour.amount;
    pose = {
      x: lerp(prepPose.x, home.x, u),
      y: lerp(prepPose.y, home.y, u) - Math.sin(Math.PI * u) * 12,
      angle: lerp(prepAngle, 0, u),
    };
  }
  const flow =
    clamp01((t - (FLOW_START - 0.02)) / 0.05) * clamp01((FLOW_END + 0.02 - t) / 0.05);
  const away =
    t < T1 ? easeInOut(t / T1) : t < T4 ? 1 : 1 - easeInOut((t - T4) / (1 - T4));
  const [lx, ly] = rotate(lipLocal[0], lipLocal[1], pose.angle);
  return { pose, moved, flow, away, lip: [pose.x + lx, pose.y + ly] };
}

function buildTubeView(
  index: number,
  bottle: readonly number[],
  layout: SceneLayout,
  snapshot: MotionSnapshot,
  finaleT: number,
): TubeView {
  const slot = layout.slots[index] as Slot;
  const now = snapshot.now;
  const lift = snapshot.lifts[index] ?? 0;
  const view: TubeView = {
    index,
    slot,
    blocks: toBlocks(bottle),
    pose: restPose(slot, lift),
    sway: 0,
    detach: lift,
    shadowStrength: 1 - lift * 0.08,
    complete: isCompleteWaterSortBottle(bottle),
    cork: isCompleteWaterSortBottle(bottle) ? 1 : null,
    reveal: 0,
    revealRing: 0,
    wave: 0,
    splash: 0,
    ghost: null,
    glint: null,
    lift,
    flying: false,
  };

  for (const pour of snapshot.pours) {
    if (pour.src === index) {
      const frame = pourFrame(pour, layout, now);
      view.blocks = toBlocks(pour.srcAfter, {
        color: pour.color,
        amount: pour.amount - frame.moved,
      });
      view.pose = frame.pose;
      view.flying = true;
      view.detach = 1 + frame.away * 1.6;
      view.shadowStrength = 1 - frame.away * 0.72;
      view.complete = false;
      view.cork = null;
      view.lift = 1;
    }
    if (pour.dst === index) {
      const frame = pourFrame(pour, layout, now);
      view.blocks = toBlocks(pour.dstBefore, {
        color: pour.color,
        amount: frame.moved,
      });
      view.wave = frame.flow * 1.5;
      view.splash = frame.flow;
      const topBefore = pour.dstBefore[pour.dstBefore.length - 1];
      if (topBefore === pour.color && frame.moved > 0) {
        const fade = frame.moved / pour.amount;
        view.ghost = {
          level: pour.dstBefore.length,
          opacity: clamp01(1 - fade * 1.15),
          amp: 2.6 * Math.sin(Math.min(1, fade * 1.4) * Math.PI),
        };
      }
      if (!pour.corked) {
        view.complete = false;
        view.cork = null;
      }
    }
  }

  for (const shake of snapshot.shakes) {
    if (shake.bottle !== index) continue;
    const t = clamp01((now - shake.start) / SHAKE_MS);
    if (shake.role === "target") {
      // 首を振るように左右へ大きめに揺れる
      view.sway = 5.5 * Math.sin(t * Math.PI * 6) * (1 - t) ** 1.2;
    } else {
      // 選んだ管は注ぎ先へ傾きかけて、止められたように跳ね戻る
      const target = layout.slots[shake.toward];
      const dir = target && target.x < slot.x ? -1 : 1;
      const lean =
        t < 0.22
          ? easeOut(t / 0.22)
          : Math.exp(-(t - 0.22) * 6) * Math.cos((t - 0.22) * Math.PI * 3.4);
      const dip = Math.sin(Math.min(1, t * 1.5) * Math.PI);
      view.pose = { ...view.pose, y: view.pose.y + dip * 5 };
      view.sway = 13 * dir * lean;
      view.detach = Math.max(0, view.detach - dip * 0.5);
    }
  }
  for (const reveal of snapshot.reveals) {
    if (reveal.bottle !== index) continue;
    const e = clamp01((now - reveal.start) / REVEAL_MS);
    view.reveal = e < 0.1 ? e / 0.1 : (1 - (e - 0.1) / 0.9) ** 2;
    view.revealRing = clamp01((e - 0.04) / 0.6);
  }
  for (const cork of snapshot.corks) {
    if (cork.bottle !== index) continue;
    view.cork = clamp01((now - cork.start) / CORK_MS);
  }
  if (snapshot.finaleStart !== null) {
    const order = slot.x / layout.width + slot.tier * 0.12;
    const g = (finaleT - 0.12 - order * 0.32) / 0.22;
    view.glint = g > 0 && g < 1 ? g : null;
  }
  return view;
}

// ---------------------------------------------------------------- 描画

function colorGradientId(uid: string, color: number) {
  return `${uid}-liq${color}`;
}

function renderDefs(uid: string): ReactNode {
  const colors = Array.from({ length: 12 }, (_, i) => i);
  return (
    <defs>
      {colors.map((color) => {
        const [c1, c2] = liquidColor(color);
        return (
          <linearGradient
            key={color}
            id={colorGradientId(uid, color)}
            x1={-RI}
            x2={RI}
            y1={0}
            y2={0}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor={lighten(c1, 0.28)} />
            <stop offset="0.3" stopColor={c1} />
            <stop offset="0.78" stopColor={mixColor(c1, c2, 0.6)} />
            <stop offset="1" stopColor={c2} />
          </linearGradient>
        );
      })}
      <linearGradient
        id={`${uid}-cyl`}
        x1={-RI}
        x2={RI}
        y1={0}
        y2={0}
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0" stopColor="#000" stopOpacity=".1" />
        <stop offset=".1" stopColor="#fff" stopOpacity=".28" />
        <stop offset=".25" stopColor="#fff" stopOpacity=".06" />
        <stop offset=".5" stopColor="#fff" stopOpacity="0" />
        <stop offset=".8" stopColor="#000" stopOpacity=".06" />
        <stop offset="1" stopColor="#000" stopOpacity=".22" />
      </linearGradient>
      <linearGradient
        id={`${uid}-glass`}
        x1={-RO}
        x2={RO}
        y1={0}
        y2={0}
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0" stopColor="#ffffff" stopOpacity=".34" />
        <stop offset=".2" stopColor="#ffffff" stopOpacity=".06" />
        <stop offset=".7" stopColor="#e3ecf2" stopOpacity=".03" />
        <stop offset="1" stopColor="#b8c6d4" stopOpacity=".32" />
      </linearGradient>
      <linearGradient id={`${uid}-hl`} x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0" />
        <stop offset=".07" stopColor="#fff" stopOpacity=".95" />
        <stop offset=".65" stopColor="#fff" stopOpacity=".6" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <linearGradient id={`${uid}-woodTop`} x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#f7e2b8" />
        <stop offset=".45" stopColor="#eccf9c" />
        <stop offset="1" stopColor="#dcb47c" />
      </linearGradient>
      <linearGradient id={`${uid}-shelfTop`} x1="0" x2="1" y1="0" y2="0.35">
        <stop offset="0" stopColor="#f8e6c2" />
        <stop offset=".5" stopColor="#efd4a3" />
        <stop offset="1" stopColor="#ddb67e" />
      </linearGradient>
      <linearGradient id={`${uid}-shelfDepth`} x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#6b4520" stopOpacity=".32" />
        <stop offset=".22" stopColor="#6b4520" stopOpacity=".06" />
        <stop offset=".85" stopColor="#fff6e2" stopOpacity="0" />
        <stop offset="1" stopColor="#fff6e2" stopOpacity=".35" />
      </linearGradient>
      <linearGradient id={`${uid}-woodFront`} x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#d6a668" />
        <stop offset=".55" stopColor="#c48f55" />
        <stop offset="1" stopColor="#a87341" />
      </linearGradient>
      <linearGradient id={`${uid}-frontLight`} x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#fff3d6" stopOpacity=".28" />
        <stop offset=".5" stopColor="#fff3d6" stopOpacity="0" />
        <stop offset="1" stopColor="#3a210b" stopOpacity=".16" />
      </linearGradient>
      <linearGradient id={`${uid}-postL`} x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#f0cf98" />
        <stop offset=".6" stopColor="#d9ab6c" />
        <stop offset="1" stopColor="#b9864a" />
      </linearGradient>
      <linearGradient id={`${uid}-postR`} x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#c99659" />
        <stop offset=".5" stopColor="#b98448" />
        <stop offset="1" stopColor="#9a6a36" />
      </linearGradient>
      <linearGradient id={`${uid}-dowel`} x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#eccf9e" />
        <stop offset=".5" stopColor="#cf9f68" />
        <stop offset="1" stopColor="#a47443" />
      </linearGradient>
      <radialGradient id={`${uid}-cork`} cx=".32" cy=".3" r=".95">
        <stop offset="0" stopColor="#e6bb87" />
        <stop offset=".6" stopColor="#c8945c" />
        <stop offset="1" stopColor="#9f6c3c" />
      </radialGradient>
      <filter id={`${uid}-grain`} x="0" y="0" width="100%" height="100%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.006 0.38"
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
      <filter id={`${uid}-grainV`} x="0" y="0" width="100%" height="100%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.4 0.006"
          numOctaves="3"
          seed="4"
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
      <filter id={`${uid}-corkTex`} x="0" y="0" width="100%" height="100%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.9"
          numOctaves="2"
          seed="3"
          result="n"
        />
        <feColorMatrix
          in="n"
          type="matrix"
          values="0 0 0 0 0.35  0 0 0 0 0.2  0 0 0 0 0.08  0 0 0 2.4 -1.25"
          result="c"
        />
        <feComposite in="c" in2="SourceAlpha" operator="in" />
      </filter>
      <filter id={`${uid}-b06`}>
        <feGaussianBlur stdDeviation="0.6" />
      </filter>
      <filter id={`${uid}-b1`}>
        <feGaussianBlur stdDeviation="1" />
      </filter>
      <filter id={`${uid}-shadowBlur`} x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="1.3" />
      </filter>
      <filter id={`${uid}-glow`} x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur stdDeviation="2.6" />
      </filter>
      <filter id={`${uid}-b3`} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3" />
      </filter>
      <filter id={`${uid}-b7`} x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="7" />
      </filter>
      <radialGradient id={`${uid}-sparkle`} cx=".5" cy=".5" r=".5">
        <stop offset="0" stopColor="#fff" />
        <stop offset=".3" stopColor="#fff" stopOpacity=".7" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </radialGradient>
      <clipPath id={`${uid}-cav`}>
        <path d={CAV_D} />
      </clipPath>
      <clipPath id={`${uid}-out`}>
        <path d={OUT_FILL_D} />
      </clipPath>
    </defs>
  );
}

function renderStaticRack(layout: SceneLayout, uid: string) {
  const left = layout.rackLeft;
  const right = layout.rackRight;
  const innerLeft = left + RACK.postW;
  const innerRight = right - RACK.postW;
  const back: ReactNode[] = [];
  const front: ReactNode[] = [];
  for (const tier of [0, 1] as const) {
    const ty = layout.tierTops[tier];
    const slots = layout.slots.filter((s) => s.tier === tier);
    const holeY = ty + TIER.holeTop;
    const shelfY = ty + TIER.shelfBack;
    back.push(
      <g key={`b${tier}`}>
        <defs>
          <clipPath id={`${uid}-shelf${tier}`}>
            <rect
              x={innerLeft}
              y={shelfY}
              width={innerRight - innerLeft}
              height={TIER.shelfDepth}
            />
          </clipPath>
        </defs>
        {/* 奥の横木（ガラス越しに透ける） */}
        <rect
          x={innerLeft - 2}
          y={ty + 74}
          width={innerRight - innerLeft + 4}
          height={7}
          rx={3.5}
          fill={`url(#${uid}-dowel)`}
        />
        <rect
          x={innerLeft}
          y={ty + 82}
          width={innerRight - innerLeft}
          height={4}
          fill="#5a3a1c"
          opacity={0.1}
          filter={`url(#${uid}-b1)`}
        />
        {/* 口を支える板の天面と穴 */}
        <rect
          x={left + 2}
          y={holeY}
          width={right - left - 4}
          height={TIER.holeDepth}
          rx={1.5}
          fill={`url(#${uid}-woodTop)`}
        />
        <rect
          x={left + 2}
          y={holeY}
          width={right - left - 4}
          height={TIER.holeDepth}
          fill="#000"
          filter={`url(#${uid}-grain)`}
          opacity={0.5}
        />
        {slots.map((slot) => (
          <g key={slot.x}>
            <ellipse
              cx={slot.x}
              cy={holeY + TIER.holeDepth / 2}
              rx={RO + 4.5}
              ry={3.7}
              fill="#7a5129"
            />
            <ellipse
              cx={slot.x + 0.6}
              cy={holeY + TIER.holeDepth / 2 + 0.6}
              rx={RO + 3}
              ry={2.9}
              fill="#3f2510"
              opacity={0.8}
            />
            <path
              d={`M${slot.x - RO - 4.5},${holeY + TIER.holeDepth / 2} A${RO + 4.5},3.7 0 0 0 ${slot.x + RO + 4.5},${holeY + TIER.holeDepth / 2}`}
              stroke="#fbe6bd"
              strokeWidth={0.8}
              fill="none"
              opacity={0.85}
            />
          </g>
        ))}
        {/* 下の棚板の天面。左上の窓からの光で、左ほど明るい */}
        <rect
          x={left + 2}
          y={shelfY}
          width={right - left - 4}
          height={TIER.shelfDepth}
          fill={`url(#${uid}-shelfTop)`}
        />
        <rect
          x={left + 2}
          y={shelfY}
          width={right - left - 4}
          height={TIER.shelfDepth}
          fill="#000"
          filter={`url(#${uid}-grain)`}
          opacity={0.42}
        />
        <rect
          x={left + 2}
          y={shelfY}
          width={right - left - 4}
          height={TIER.shelfDepth}
          fill={`url(#${uid}-shelfDepth)`}
        />
        {/* 左の柱が落とす影 */}
        <path
          d={`M${innerLeft},${shelfY} L${innerLeft + 9},${shelfY} L${innerLeft + 9 + TIER.shelfDepth * 0.9},${shelfY + TIER.shelfDepth} L${innerLeft},${shelfY + TIER.shelfDepth} Z`}
          fill="#5b3a1a"
          opacity={0.16}
          filter={`url(#${uid}-b3)`}
        />
        {slots.map((slot) => (
          <g key={slot.x}>
            <ellipse
              cx={slot.x}
              cy={ty + OUTER_BOT - 1}
              rx={RO + 3.5}
              ry={4.6}
              fill="#b9884f"
              opacity={0.45}
            />
            <path
              d={`M${slot.x - RO - 3.5},${ty + OUTER_BOT - 1} A${RO + 3.5},4.6 0 0 1 ${slot.x + RO + 3.5},${ty + OUTER_BOT - 1}`}
              stroke="#8a5b30"
              strokeWidth={0.8}
              fill="none"
              opacity={0.55}
            />
          </g>
        ))}
      </g>,
    );
    front.push(
      <g key={`f${tier}`}>
        {renderBoardFront(
          uid,
          left,
          holeY + TIER.holeDepth,
          right - left,
          TIER.holeFront,
        )}
        <rect
          x={left + 2}
          y={holeY + TIER.holeDepth + TIER.holeFront}
          width={right - left - 4}
          height={4}
          fill="#3a2610"
          opacity={0.14}
          filter={`url(#${uid}-b1)`}
        />
        {renderBoardFront(
          uid,
          left,
          ty + SHELF_FRONT,
          right - left,
          TIER.shelfFrontH,
        )}
        <rect
          x={left + 2}
          y={ty + TIER_BOTTOM}
          width={right - left - 4}
          height={5}
          fill="#3a2610"
          opacity={0.14}
          filter={`url(#${uid}-b1)`}
        />
      </g>,
    );
  }
  const postTop = layout.tierTops[0] + TIER.holeTop - 5;
  const postBottom = layout.tierTops[1] + TIER_BOTTOM + 3;
  const postH = postBottom - postTop;
  const posts = (
    <g>
      <rect
        x={left}
        y={postTop}
        width={RACK.postW}
        height={postH}
        rx={2}
        fill={`url(#${uid}-postL)`}
      />
      <rect
        x={left}
        y={postTop}
        width={RACK.postW}
        height={postH}
        fill="#000"
        filter={`url(#${uid}-grainV)`}
        opacity={0.45}
      />
      <rect
        x={right - RACK.postW}
        y={postTop}
        width={RACK.postW}
        height={postH}
        rx={2}
        fill={`url(#${uid}-postR)`}
      />
      <rect
        x={right - RACK.postW}
        y={postTop}
        width={RACK.postW}
        height={postH}
        fill="#000"
        filter={`url(#${uid}-grainV)`}
        opacity={0.45}
      />
      <rect
        x={left}
        y={postTop - 2}
        width={RACK.postW}
        height={4}
        rx={2}
        fill="#f6dfb2"
      />
      <rect
        x={right - RACK.postW}
        y={postTop - 2}
        width={RACK.postW}
        height={4}
        rx={2}
        fill="#e1c08a"
      />
      <rect
        x={left + 0.6}
        y={postTop + 2}
        width={1.4}
        height={postH - 4}
        fill="#fff8e4"
        opacity={0.55}
      />
      <rect
        x={left + RACK.postW - 1}
        y={postTop + 2}
        width={1}
        height={postH - 4}
        fill="#6e461f"
        opacity={0.4}
      />
    </g>
  );
  const floorY = layout.tierTops[1] + TIER_BOTTOM + 4;
  const floor = (
    <g>
      <ellipse
        cx={layout.width / 2 + 14}
        cy={floorY + 4}
        rx={layout.width / 2 + 4}
        ry={7}
        fill="#4a3826"
        opacity={0.2}
        filter={`url(#${uid}-b7)`}
      />
      <ellipse
        cx={layout.width / 2 + 4}
        cy={floorY}
        rx={layout.width / 2 - 6}
        ry={2.4}
        fill="#4a3826"
        opacity={0.22}
        filter={`url(#${uid}-b1)`}
      />
    </g>
  );
  return { back, front, posts, floor };
}

function renderBoardFront(
  uid: string,
  x: number,
  y: number,
  w: number,
  h: number,
): ReactNode {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={1.5} fill={`url(#${uid}-woodFront)`} />
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill="#000"
        filter={`url(#${uid}-grain)`}
        opacity={0.75}
      />
      <rect x={x} y={y} width={w} height={h} fill={`url(#${uid}-frontLight)`} />
      <rect x={x + 1} y={y} width={w - 2} height={1} fill="#fbe8c2" opacity={0.95} />
      <rect x={x} y={y + h - 1} width={w} height={1} fill="#7d5128" opacity={0.55} />
    </g>
  );
}

/** 棚板に落ちる色影の形。管の高さ h（空洞の底から）を、管の真下から右下へ伸びる軸の上の距離へ写す。 */
function shadowGeometry(view: TubeView, lightAngle: number, finale: number) {
  const a = (lightAngle * Math.PI) / 180;
  const d: [number, number] = [Math.cos(a), Math.sin(a)];
  const detachClamped = Math.min(view.detach, 1);
  const length = SHADOW_LENGTH * (1 + 0.2 * view.detach + 0.08 * finale);
  const start = 3 + view.detach * 7;
  const widthScale = 1 - 0.38 * detachClamped + 0.25 * finale;
  const base: [number, number] = [view.slot.x + 3, view.slot.ty + OUTER_BOT - 1];
  function pos(h: number) {
    return start + (0.08 + 0.92 * (h / CAVITY_H)) * length;
  }
  function point(s: number): [number, number] {
    return [base[0] + d[0] * s, base[1] + d[1] * s];
  }
  function line(s0: number, s1: number) {
    const [x1, y1] = point(s0);
    const [x2, y2] = point(s1);
    return { x1, y1, x2, y2 };
  }
  const angleDeg = (Math.atan2(d[1], d[0]) * 180) / Math.PI;
  return { base, d, pos, point, line, length, widthScale, angleDeg };
}

const STREAK_W = 10;

function renderShadow(
  view: TubeView,
  uid: string,
  lightAngle: number,
  fade: number,
  finale: number,
): ReactNode {
  const g = shadowGeometry(view, lightAngle, finale);
  const strength = view.shadowStrength * fade;
  const total = totalAmount(view.blocks);
  const topH = Math.min(CAVITY_H, total * U);
  const top = view.blocks[view.blocks.length - 1];
  const bottom = view.blocks[0];
  const empty = view.blocks.length === 0;
  const dense = view.complete ? 1 : 0;
  const swayRotate =
    view.sway !== 0
      ? `rotate(${view.sway * 1.8} ${g.base[0]} ${g.base[1]})`
      : undefined;
  const reveal = view.reveal;
  const w = STREAK_W * g.widthScale;
  const hotspot = top ? g.point(g.pos(topH)) : null;
  const start = g.point(g.pos(0));
  const corkLevel = view.cork ?? 0;
  const contactFade = 1 - Math.min(view.detach, 1) * 0.65;
  return (
    <g key={view.index} transform={swayRotate}>
      {/* ガラスの底が触れる所の影 */}
      <ellipse
        cx={g.base[0]}
        cy={g.base[1] + 1}
        rx={(RO + 1) * (1 - Math.min(view.detach, 1) * 0.2)}
        ry={4}
        fill="#4a2c12"
        opacity={0.28 * contactFade * (view.flying ? Math.max(0, 1 - (view.detach - 1)) : 1)}
        filter={`url(#${uid}-shadowBlur)`}
      />
      <g opacity={strength}>
        {/* 管の幅いっぱいに淡くにじむ色 */}
        {bottom && (
          <line
            {...g.line(g.pos(0), g.pos(topH))}
            stroke={liquidColor(top?.color ?? bottom.color)[0]}
            strokeWidth={w * 2.6}
            strokeLinecap="round"
            opacity={0.16 + 0.12 * dense + 0.2 * finale}
            filter={`url(#${uid}-b3)`}
          />
        )}
        {/* 色水を抜けた光の帯。下の層ほど管の近く、上の層ほど遠くに落ちる */}
        <g filter={`url(#${uid}-shadowBlur)`}>
          {bottom && (
            <circle
              cx={start[0]}
              cy={start[1]}
              r={w / 2}
              fill={mixColor(liquidColor(bottom.color)[0], "#ffffff", 0.1)}
              opacity={0.78 + 0.2 * dense}
            />
          )}
          {view.blocks.map((block) => {
            const [c1] = liquidColor(block.color);
            return (
              <line
                key={`${block.color}-${block.from}`}
                {...g.line(g.pos(block.from * U), g.pos(block.to * U))}
                stroke={mixColor(c1, "#ffffff", 0.1)}
                strokeWidth={w}
                opacity={0.78 + 0.2 * dense}
              />
            );
          })}
          {!empty && topH < CAVITY_H - 1 && (
            <line
              {...g.line(g.pos(topH), g.pos(CAVITY_H))}
              stroke="#fffaf0"
              strokeWidth={w * 0.7}
              strokeLinecap="round"
              opacity={0.42}
            />
          )}
        </g>
        {/* 円筒が光を集めた細い芯 */}
        {view.blocks.map((block) => {
          const [c1] = liquidColor(block.color);
          return (
            <line
              key={`c${block.color}-${block.from}`}
              {...g.line(g.pos(block.from * U) + 0.5, g.pos(block.to * U) - 0.5)}
              stroke={lighten(c1, 0.5 + 0.12 * dense)}
              strokeWidth={w * 0.3}
              strokeLinecap="round"
              opacity={0.85}
              filter={`url(#${uid}-b06)`}
            />
          );
        })}
        {view.cork !== null && (
          <ellipse
            cx={0}
            cy={0}
            rx={5.5 * g.widthScale}
            ry={w * 0.55}
            transform={`translate(${g.point(g.pos(CAVITY_H) + 5)[0]} ${g.point(g.pos(CAVITY_H) + 5)[1]}) rotate(${g.angleDeg})`}
            fill="#5a3a1e"
            opacity={0.3 * clamp01(corkLevel * 3)}
            filter={`url(#${uid}-glow)`}
          />
        )}
      </g>
      {/* 液面を通った光が集まる明るい点。いちばん上の色を知らせる */}
      {top && hotspot && (
        <g
          opacity={strength}
          transform={`translate(${hotspot[0]} ${hotspot[1]}) rotate(${g.angleDeg})`}
        >
          <ellipse
            rx={9 * (1 + reveal * 1.8) * g.widthScale}
            ry={5.5 * (1 + reveal * 1.6) * g.widthScale}
            fill={liquidColor(top.color)[0]}
            opacity={0.6 + reveal * 0.4}
            filter={`url(#${uid}-glow)`}
          />
          <ellipse
            rx={5 * (1 + reveal * 0.6) * g.widthScale}
            ry={3 * (1 + reveal * 0.6) * g.widthScale}
            fill={lighten(liquidColor(top.color)[0], 0.6)}
            opacity={0.95}
          />
          <ellipse rx={1.8 + reveal * 2} ry={1 + reveal * 1} fill="#fff" opacity={0.95} />
          {view.revealRing > 0 && view.revealRing < 1 && (
            <ellipse
              rx={6 + easeOut(view.revealRing) * 24}
              ry={3 + easeOut(view.revealRing) * 11}
              fill="none"
              stroke={lighten(liquidColor(top.color)[0], 0.35)}
              strokeWidth={2.2 * (1 - view.revealRing) + 0.4}
              opacity={(1 - view.revealRing) * 0.95}
            />
          )}
        </g>
      )}
      {/* 空の管: 透明なガラスが落とす白い光の輪だけ */}
      {empty && (
        <g opacity={strength}>
          <line
            {...g.line(g.pos(0), g.pos(CAVITY_H * 0.7))}
            stroke="#fffdf6"
            strokeWidth={w * 0.8}
            strokeLinecap="round"
            opacity={0.35}
            filter={`url(#${uid}-shadowBlur)`}
          />
          <g
            transform={`translate(${g.point(g.pos(CAVITY_H * 0.86))[0]} ${g.point(g.pos(CAVITY_H * 0.86))[1]}) rotate(${g.angleDeg})`}
          >
            <ellipse
              rx={10 * g.widthScale}
              ry={6 * g.widthScale}
              fill="none"
              stroke="#ffffff"
              strokeWidth={2.6}
              opacity={0.55}
              filter={`url(#${uid}-b1)`}
            />
            <ellipse
              rx={10 * g.widthScale}
              ry={6 * g.widthScale}
              fill="#fffaf0"
              fillOpacity={0.3}
              stroke="#ffffff"
              strokeWidth={1.2}
              opacity={0.95}
            />
          </g>
        </g>
      )}
    </g>
  );
}

function renderWash(
  view: TubeView,
  uid: string,
  finale: number,
  lightAngle: number,
): ReactNode {
  const top = view.blocks[0];
  if (!top) return null;
  const g = shadowGeometry(view, lightAngle, finale);
  const angleDeg = g.angleDeg;
  const [cx, cy] = g.point(g.length * 0.55);
  return (
    <ellipse
      key={`w${view.index}`}
      cx={0}
      cy={0}
      rx={g.length * 0.8}
      ry={30}
      transform={`translate(${cx} ${cy}) rotate(${angleDeg})`}
      fill={liquidColor(top.color)[0]}
      opacity={0.55 * finale}
      filter={`url(#${uid}-b7)`}
    />
  );
}

function renderTube(view: TubeView, uid: string, dim: number): ReactNode {
  const { pose } = view;
  const tilted = Math.abs(pose.angle) > 6;
  const transform =
    view.sway !== 0
      ? `translate(${pose.x} ${pose.y}) rotate(${view.sway} 0 ${OUTER_BOT})`
      : `translate(${pose.x} ${pose.y}) rotate(${pose.angle})`;
  const light = 1 - dim * 0.45;
  return (
    <g key={`t${view.index}`} transform={transform}>
      <g clipPath={`url(#${uid}-cav)`}>
        {tilted
          ? renderTiltedLiquid(view, uid)
          : renderUprightLiquid(view, uid)}
      </g>
      {renderGlass(view, uid, light)}
    </g>
  );
}

function renderUprightLiquid(view: TubeView, uid: string): ReactNode {
  const parts: ReactNode[] = [];
  const blocks = view.blocks;
  blocks.forEach((block, k) => {
    const y0 = BOT - block.to * U;
    const y1 = BOT - block.from * U;
    const [c1] = liquidColor(block.color);
    const fill = view.complete
      ? lighten(c1, 0.08)
      : `url(#${colorGradientId(uid, block.color)})`;
    parts.push(
      <rect
        key={`l${k}`}
        x={-RI - 1}
        y={y0}
        width={RI * 2 + 2}
        height={y1 - y0 + (k === 0 ? 30 : 0.6)}
        fill={fill}
        opacity={0.96}
      />,
    );
  });
  if (blocks.length > 0) {
    // 光が液を抜けて右寄りに集まる帯
    const topY = BOT - totalAmount(blocks) * U;
    parts.push(
      <rect
        key="core"
        x={4}
        y={topY + 3}
        width={6}
        height={BOT - topY}
        fill="#fff"
        opacity={0.16}
        filter={`url(#${uid}-b1)`}
      />,
    );
    parts.push(
      <rect
        key="cyl"
        x={-RI}
        y={topY}
        width={RI * 2}
        height={BOT - topY + 2}
        fill={`url(#${uid}-cyl)`}
      />,
    );
  }
  blocks.forEach((block, k) => {
    const y = BOT - block.to * U;
    const [c1] = liquidColor(block.color);
    const isTop = k === blocks.length - 1;
    if (isTop) {
      const surface = lighten(c1, view.complete ? 0.5 : 0.4);
      const wave = view.wave;
      if (wave > 0.01) {
        let back = `M${-RI - 1},${y}`;
        let frontPath = `M${-RI - 1},${y}`;
        for (let x = -RI - 1; x <= RI + 1; x += 2) {
          const e = Math.sqrt(Math.max(0, 1 - (x / RI) ** 2));
          back += ` L${x},${y - 3.2 * e + Math.sin(x * 0.5 + view.splash * 9) * wave}`;
        }
        for (let x = RI + 1; x >= -RI - 1; x -= 2) {
          const e = Math.sqrt(Math.max(0, 1 - (x / RI) ** 2));
          frontPath += ` L${x},${y + 3.2 * e + Math.sin(x * 0.5 + 1 + view.splash * 9) * wave}`;
        }
        parts.push(
          <path key={`s${k}`} d={`${back} ${frontPath.replace("M", "L")} Z`} fill={surface} />,
        );
        parts.push(
          <ellipse
            key={`sp${k}`}
            cx={2}
            cy={y + 0.5}
            rx={6 * view.splash + 2}
            ry={1.5 * view.splash + 0.6}
            fill="none"
            stroke="#fff"
            strokeWidth={0.9}
            opacity={0.8}
          />,
        );
        parts.push(
          <ellipse
            key={`sp2${k}`}
            cx={2}
            cy={y + 0.8}
            rx={11 * view.splash + 3}
            ry={2.3 * view.splash + 0.8}
            fill="none"
            stroke="#fff"
            strokeWidth={0.6}
            opacity={0.45}
          />,
        );
      } else {
        parts.push(
          <ellipse key={`s${k}`} cx={0} cy={y} rx={RI + 1} ry={3.2} fill={surface} />,
        );
        parts.push(
          <path
            key={`sf${k}`}
            d={`M${-RI},${y} A${RI},3.2 0 0 0 ${RI},${y}`}
            stroke="#fff"
            strokeWidth={1}
            fill="none"
            opacity={0.9}
          />,
        );
        parts.push(
          <path
            key={`sb${k}`}
            d={`M${-RI + 5},${y - 1.1} A${RI - 4},2 0 0 1 ${3},${y - 2.6}`}
            stroke="#fff"
            strokeWidth={0.8}
            fill="none"
            opacity={0.55}
          />,
        );
      }
      if (view.reveal > 0) {
        parts.push(
          <rect
            key={`rg${k}`}
            x={-RI}
            y={y}
            width={RI * 2}
            height={(block.to - block.from) * U}
            fill={lighten(c1, 0.7)}
            opacity={view.reveal * 0.35}
          />,
        );
        parts.push(
          <ellipse
            key={`rv${k}`}
            cx={0}
            cy={y}
            rx={RI + 1}
            ry={3.2}
            fill="#fff"
            opacity={view.reveal * 0.75}
            filter={`url(#${uid}-b06)`}
          />,
        );
      }
    } else {
      parts.push(
        <path
          key={`bb${k}`}
          d={`M${-RI},${y} A${RI},3 0 0 1 ${RI},${y}`}
          stroke={lighten(c1, 0.6)}
          strokeWidth={0.7}
          fill="none"
          opacity={0.5}
        />,
      );
      parts.push(
        <path
          key={`bf${k}`}
          d={`M${-RI},${y} A${RI},3 0 0 0 ${RI},${y}`}
          stroke="#fff"
          strokeWidth={2.2}
          fill="none"
          opacity={0.3}
          filter={`url(#${uid}-b1)`}
        />,
      );
      parts.push(
        <path
          key={`bl${k}`}
          d={`M${-RI},${y} A${RI},3 0 0 0 ${RI},${y}`}
          stroke="#fff"
          strokeWidth={0.9}
          fill="none"
          opacity={0.92}
        />,
      );
    }
  });
  if (view.ghost && view.ghost.opacity > 0) {
    const y = BOT - view.ghost.level * U;
    let d = `M${-RI},${y}`;
    for (let x = -RI; x <= RI; x += 1.5) {
      const e = Math.sqrt(Math.max(0, 1 - (x / RI) ** 2));
      d += ` L${x},${y + 3 * e + Math.sin(x * 0.42 + view.ghost.amp * 3) * view.ghost.amp}`;
    }
    parts.push(
      <path
        key="ghost-glow"
        d={d}
        stroke="#fff"
        strokeWidth={1.6}
        fill="none"
        opacity={view.ghost.opacity * 0.55}
        filter={`url(#${uid}-b06)`}
      />,
    );
    parts.push(
      <path
        key="ghost"
        d={d}
        stroke="#fff"
        strokeWidth={0.8}
        fill="none"
        opacity={view.ghost.opacity}
      />,
    );
  }
  return parts;
}

function renderTiltedLiquid(view: TubeView, uid: string): ReactNode {
  const bands = tiltedBands(view.blocks, view.pose.angle);
  return (
    <g transform={`rotate(${-view.pose.angle})`}>
      {bands.map((band, k) => (
        <rect
          key={`tb${k}`}
          x={-200}
          y={band.hi}
          width={400}
          height={Math.max(0, band.lo - band.hi) + 0.6}
          fill={liquidColor(band.color)[0]}
        />
      ))}
      {bands.map((band, k) => (
        <rect
          key={`tl${k}`}
          x={-200}
          y={band.hi - 0.6}
          width={400}
          height={1.2}
          fill="#fff"
          opacity={0.8}
        />
      ))}
      {bands.length > 0 && (
        <rect
          x={-200}
          y={Math.min(...bands.map((b) => b.hi))}
          width={400}
          height={200}
          fill={`url(#${uid}-cyl)`}
          opacity={0.6}
        />
      )}
    </g>
  );
}

function renderGlass(view: TubeView, uid: string, light: number): ReactNode {
  const liftGlow = view.lift;
  const cork = view.cork;
  const corkDrop = cork === null ? 0 : -30 * (1 - bounce(cork));
  const topColor = view.blocks[0] ? liquidColor(view.blocks[0].color)[0] : null;
  const topY = BOT - totalAmount(view.blocks) * U;
  return (
    <g>
      <rect
        x={-RI}
        y={0}
        width={RI * 2}
        height={BOT + 2}
        fill={`url(#${uid}-cyl)`}
        clipPath={`url(#${uid}-cav)`}
      />
      <path
        d={OUT_D}
        fill={`url(#${uid}-glass)`}
        stroke="rgba(70,88,108,.45)"
        strokeWidth={1}
      />
      <path d={CAV_D} fill="none" stroke="rgba(255,255,255,.45)" strokeWidth={0.8} />
      {/* 左上の光を受けた縦の照り返し */}
      <rect
        x={-RI + 2.2}
        y={12}
        width={4.6}
        height={BOT - 26}
        rx={2.3}
        fill={`url(#${uid}-hl)`}
        opacity={(0.82 + liftGlow * 0.18) * light}
        filter={`url(#${uid}-b06)`}
      />
      <rect
        x={-RI + 3.4}
        y={16}
        width={1.5}
        height={BOT - 40}
        rx={0.75}
        fill="#fff"
        opacity={(0.7 + liftGlow * 0.3) * light}
      />
      <path
        d={`M${-RO + 0.7},10 L${-RO + 0.7},${BOT - RI} A${RO - 0.7},${RO - 0.7} 0 0 0 ${-RO * 0.5},${OUTER_BOT - 2.6}`}
        stroke="#fff"
        strokeWidth={0.9}
        fill="none"
        opacity={0.75 * light}
      />
      <rect x={RI - 3} y={20} width={1.4} height={BOT - 44} rx={0.7} fill="#fff" opacity={0.26 * light} />
      <path
        d={`M${-RI * 0.6},${OUTER_BOT - 6} A${RI},${RI} 0 0 0 ${RI * 0.3},${OUTER_BOT - 4.5}`}
        stroke="#fff"
        strokeWidth={1.3}
        fill="none"
        opacity={0.55 * light}
        filter={`url(#${uid}-b06)`}
      />
      {view.reveal > 0 && (
        <g>
          <circle
            cx={-RI + 4.4}
            cy={lerp(BOT - 8, topY + 4, easeOut(Math.min(1, (1 - view.reveal) * 3)))}
            r={5 + view.reveal * 3}
            fill={`url(#${uid}-sparkle)`}
            opacity={view.reveal}
          />
        </g>
      )}
      {view.glint !== null && (
        <g clipPath={`url(#${uid}-out)`}>
          <rect
            x={-40}
            y={lerp(-50, OUTER_BOT + 20, view.glint)}
            width={80}
            height={16}
            fill="#fff"
            opacity={0.65 * Math.sin(view.glint * Math.PI)}
            transform={`rotate(-28 0 ${lerp(-50, OUTER_BOT + 20, view.glint)})`}
            filter={`url(#${uid}-b1)`}
          />
        </g>
      )}
      {/* 口の縁 */}
      <ellipse
        cx={0}
        cy={4}
        rx={RO + 3.5}
        ry={4.8}
        fill="rgba(255,255,255,.38)"
        stroke="rgba(70,88,108,.5)"
        strokeWidth={1}
      />
      {cork !== null && (
        <g transform={`translate(0 ${corkDrop})`} opacity={clamp01(cork * 5)}>
          <path
            d={`M${-RI - 2.5},-11 L${-RI - 1},13 Q0,16.5 ${RI + 1},13 L${RI + 2.5},-11 Z`}
            fill={`url(#${uid}-cork)`}
          />
          <path
            d={`M${-RI - 2.5},-11 L${-RI - 1},13 Q0,16.5 ${RI + 1},13 L${RI + 2.5},-11 Z`}
            fill="#000"
            filter={`url(#${uid}-corkTex)`}
            opacity={0.85}
          />
          <path d={`M${RI - 4},-11 L${RI - 4.5},13`} stroke="#6f4824" strokeWidth={4} opacity={0.2} />
          <path d={`M${-RI + 4},-9 L${-RI + 4.5},11`} stroke="#f6d8ac" strokeWidth={2.2} opacity={0.5} />
        </g>
      )}
      <path
        d={`M${-RO - 3.5},4 L${-RO - 3.5},6.4 A${RO + 3.5},4.8 0 0 0 ${RO + 3.5},6.4 L${RO + 3.5},4 A${RO + 3.5},4.8 0 0 1 ${-RO - 3.5},4`}
        fill={`rgba(222,234,243,${cork !== null ? 0.3 : 0.55})`}
        stroke="rgba(70,88,108,.45)"
        strokeWidth={0.8}
      />
      {cork !== null ? (
        <g transform={`translate(0 ${corkDrop})`} opacity={clamp01(cork * 5)}>
          <ellipse cx={0} cy={-11} rx={RI + 2.5} ry={3.4} fill="#dcb07b" stroke="#a5713f" strokeWidth={0.8} />
          <ellipse cx={0} cy={-11} rx={RI + 2.5} ry={3.4} fill="#000" filter={`url(#${uid}-corkTex)`} opacity={0.65} />
          <path
            d={`M${-RI + 1},-12.4 A${RI - 2},2 0 0 1 ${6},-13.6`}
            stroke="#f8e0bb"
            strokeWidth={1}
            fill="none"
            opacity={0.85}
          />
        </g>
      ) : (
        <ellipse cx={0} cy={4} rx={RI + 2} ry={3.4} fill="rgba(70,92,115,.16)" stroke="rgba(255,255,255,.7)" strokeWidth={0.8} />
      )}
      <path
        d={`M${-RO - 2},2.2 A${RO + 4},4 0 0 1 ${-3},-0.6`}
        stroke="#fff"
        strokeWidth={1.2}
        fill="none"
        opacity={0.9 * light}
      />
      {view.complete && topColor && (
        <path
          d={OUT_D}
          fill="none"
          stroke={topColor}
          strokeWidth={2.4}
          opacity={0.38}
          filter={`url(#${uid}-b1)`}
        />
      )}
    </g>
  );
}

function bounce(t: number): number {
  const c = clamp01(t);
  const n = 7.5625;
  const d = 2.75;
  if (c < 1 / d) return n * c * c;
  if (c < 2 / d) {
    const x = c - 1.5 / d;
    return n * x * x + 0.75;
  }
  if (c < 2.5 / d) {
    const x = c - 2.25 / d;
    return n * x * x + 0.9375;
  }
  const x = c - 2.625 / d;
  return n * x * x + 0.984375;
}

function renderStream(
  pour: PourMotion,
  layout: SceneLayout,
  now: number,
  uid: string,
): ReactNode {
  const frame = pourFrame(pour, layout, now);
  if (frame.flow <= 0.01) return null;
  const dst = layout.slots[pour.dst] as Slot;
  const surfaceY =
    dst.ty + BOT - (pour.dstBefore.length + frame.moved) * U - 1;
  const [lx, ly] = frame.lip;
  const tx = dst.x + 1;
  const dir = pourDirection(pour, layout);
  const d = `M${lx},${ly} C${lx + dir * 2.5},${ly + 5} ${tx},${ly + 8} ${tx},${ly + 18} L${tx},${surfaceY}`;
  const w = 3.6 * frame.flow;
  const [c1, c2] = liquidColor(pour.color);
  const dash = (now / 6) % 40;
  return (
    <g key={`st${pour.id}`}>
      <path d={d} stroke={c2} strokeWidth={w + 1} fill="none" strokeLinecap="round" opacity={0.85} />
      <path d={d} stroke={c1} strokeWidth={w} fill="none" strokeLinecap="round" />
      <path
        d={d}
        stroke="#fff"
        strokeWidth={Math.max(0.6, w * 0.3)}
        fill="none"
        opacity={0.75}
        transform={`translate(${-w * 0.22} 0)`}
      />
      <path
        d={d}
        stroke="#fff"
        strokeWidth={Math.max(0.8, w * 0.42)}
        strokeDasharray="6 34"
        strokeDashoffset={-dash}
        fill="none"
        opacity={0.95 * frame.flow}
        transform={`translate(${-w * 0.18} 0)`}
        filter={`url(#${uid}-b06)`}
      />
      <circle cx={lx} cy={ly} r={5 * frame.flow} fill={`url(#${uid}-sparkle)`} opacity={0.9} />
      <path
        d={`M${lx},${ly - 7 * frame.flow} L${lx + 0.8},${ly} L${lx},${ly + 7 * frame.flow} L${lx - 0.8},${ly} Z M${lx - 7 * frame.flow},${ly} L${lx},${ly - 0.8} L${lx + 7 * frame.flow},${ly} L${lx},${ly + 0.8} Z`}
        fill="#fff"
        opacity={0.9 * frame.flow}
      />
    </g>
  );
}
