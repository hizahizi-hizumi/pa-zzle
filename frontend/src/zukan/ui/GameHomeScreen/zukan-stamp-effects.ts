import type { GameResultLevel } from "@/games/result";
import { MOTION_EASING, prefersReducedMotion } from "@/lib/motion";
import {
  getZukanStampTimeline,
  type ZukanStamp,
  type ZukanStampPoint,
  type ZukanStampStyle,
  type ZukanStampTimeline,
} from "@/zukan/ui/GameHomeScreen/zukan-change-reveal";
import {
  getZukanPiecePath,
  ZUKAN_PIECE_VIEW_BOX,
} from "@/zukan/ui/GameHomeScreen/zukan-piece-shape";
import { zukanProblemStatusOrder } from "@/zukan/ui/GameHomeScreen/zukan-problem-appearance";
import type { ZukanProblemStatus } from "@/zukan/zukan-collection";

/** 評価段階ごとの強さ。段階が高いほど大きく飛ばし、はまったときの波紋と粒を強くする。 */
type ZukanStampTier = {
  /** 飛んでいる間の大きさに足す倍率。 */
  flightScaleBonus: number;
  /** はまったときに飛び散らせる、マスの色の粒の数。 */
  particleCount: number;
  /** 浮いている間に光を帯び、はまったときに台紙を沈ませ、金の粒を足すか。perfect だけ。 */
  isFinest: boolean;
  /** はまったときに状態ごとの数の数字を弾ませる大きさ。小さな数字でも弾んだと見える大きさにする。 */
  countPopScale: number;
};

const zukanStampTiers: Record<GameResultLevel, ZukanStampTier> = {
  clear: {
    flightScaleBonus: 0,
    particleCount: 0,
    isFinest: false,
    countPopScale: 1.25,
  },
  good: {
    flightScaleBonus: 0.05,
    particleCount: 0,
    isFinest: false,
    countPopScale: 1.25,
  },
  great: {
    flightScaleBonus: 0.1,
    particleCount: 6,
    isFinest: false,
    countPopScale: 1.3,
  },
  perfect: {
    flightScaleBonus: 0.2,
    particleCount: 10,
    isFinest: true,
    countPopScale: 1.3,
  },
};

function getZukanStampTier(level: GameResultLevel): ZukanStampTier {
  return zukanStampTiers[level];
}

/**
 * 見せ方ごとの飛び方とはまり方。大きさはピースの1辺に対する倍率。
 * `arcRatio` は、飛ぶ道のりに対する弧の膨らみ。`ripple` は、はまったときに枠から広げる同心円の波紋。
 * `landedGlowMs` は、はまったピースを明るく保って周りから見分けさせる長さ。
 */
type FlightLook = {
  scale: number;
  arcRatio: number;
  /** 影を落とす高さ（ピースの1辺に対する比）。飛んでいる間は離れて薄く、着く直前に寄って濃くなる。 */
  shadowHeight: number;
  flash: { opacity: number; scale: number; durationMs: number };
  ripple: {
    scale: number;
    opacity: number;
    durationMs: number;
    widthPx: number;
    /** 同心円にもう1つ広げる波紋の遅れ。無ければ1つだけ。 */
    echoDelayMs: number | null;
  };
  /** 周りのマスを押し退ける距離。押し退けないなら `null`。 */
  nudgePx: number | null;
  /** 行き先の枠を光らせる濃さ。 */
  slotGlowOpacity: number;
  landedGlowMs: number;
};

const flightLooks: Record<Exclude<ZukanStampStyle, "wave">, FlightLook> = {
  hero: {
    scale: 1.9,
    arcRatio: 0.32,
    shadowHeight: 0.5,
    flash: { opacity: 0.85, scale: 1.3, durationMs: 220 },
    ripple: {
      scale: 3,
      opacity: 1,
      durationMs: 450,
      widthPx: 1,
      echoDelayMs: 110,
    },
    nudgePx: 1.5,
    slotGlowOpacity: 0.6,
    landedGlowMs: 700,
  },
  featured: {
    scale: 1.4,
    arcRatio: 0.25,
    shadowHeight: 0.3,
    flash: { opacity: 0.6, scale: 1.15, durationMs: 160 },
    ripple: {
      scale: 2.5,
      opacity: 1,
      durationMs: 300,
      widthPx: 1,
      echoDelayMs: null,
    },
    nudgePx: null,
    slotGlowOpacity: 0.35,
    landedGlowMs: 600,
  },
};

/** はまる瞬間に沈む大きさと、戻るときにわずかに行き過ぎる大きさ。沈んで戻る形が「はまった」手応えになる。 */
const PRESSED_SCALE = 0.92;
const OVERSHOOT_SCALE = 1.04;
const OVERSHOOT_OFFSET = 0.4;
/** 飛ぶ道のりを分けて描く数。弧を滑らかに見せる。 */
const FLIGHT_SAMPLE_COUNT = 14;
/** 飛んでいる間に大きさを保つ割合。残りで枠の大きさへ縮めて降ろす。 */
const FLIGHT_HOVER_RATIO = 0.5;
/** 降ろすときの縮み方の強さ。大きいほど着く直前に速く縮み、落ちてはまる手応えになる。 */
const FLIGHT_DESCENT_POWER = 1.8;
/** 段階が上がったマスで、前の色が今の色へ塗り替わる、飛ぶ間に対する区間。 */
const PREVIOUS_COLOR_FADE = { from: 0.35, to: 0.85 } as const;
const SHADOW_OPACITY = { flight: 0.22, landed: 0.4, fadeMs: 80 } as const;
/** 波ではめる姿は、持ち上げずに少し大きい所から縮めてはめる。 */
const WAVE_START_SCALE = 1.12;
const WAVE_PRESSED_SCALE = 0.95;
/** 波ではめる姿の、寄せてくる途中の濃さ。着いて数えるまでは、はまった姿より淡くする。 */
const WAVE_APPROACH_OPACITY = 0.45;
/** 同心円の波紋の、広がり方と現れる所。結果画面の波紋と同じ形にする。 */
const RING_EASING = "cubic-bezier(0.15, 0.7, 0.24, 1)";
const RING_START_SCALE = 0.3;
const RING_PEAK_OFFSET = 0.12;
/** 波紋を薄れさせ始める所と、そこでの濃さの割合。広がる間は濃さを保ち、はっきり見せる。 */
const RING_HOLD = { offset: 0.6, opacityRatio: 0.75 } as const;
const RING_ECHO_OPACITY_RATIO = 0.6;
/** 波紋の線の色。ピースの評価段階の色を、彩度を保ったまま少し明るく寄せる。 */
function toRippleColor(color: string): string {
  return `color-mix(in oklch, ${color} 88%, white)`;
}
/** 波紋の細い線の周りに、同じ色の光をにじませる幅。明るい台の上でも、くすませずに光る線として見せる。 */
const RING_GLOW_PX = { outer: 6, inner: 3 } as const;
/** はまったピースを明るく保つ明るさと、その明るさを保つ割合。残りで元へ戻す。 */
const LANDED_GLOW = { brightness: 1.15, holdRatio: 0.6 } as const;
/** 行き先の枠の光が、開いてすぐ淡く見え始めるまで。何かが始まると分かるようにする。 */
const SLOT_GLOW_FIRST_MS = 160;
const SLOT_GLOW_FIRST_RATIO = 0.6;
/** 今回はめたピースに残す「新しい」印。輪郭の外の白い光を、ゆっくり脈打たせてから消す。 */
const NEW_PIECE_MARK = {
  pulseMs: 1300,
  pulseCount: 3,
  opacity: { peak: 0.95, low: 0.25 },
  glow: { width: 0.16, blur: 0.06 },
} as const;
const PARTICLE_SIZE_PX = 4;
/** 粒を飛ばす向きと距離のばらつき。 */
const PARTICLE_ANGLE_JITTER = 0.6;
const PARTICLE_DISTANCE_RANGE = { min: 0.6, spread: 0.5 } as const;
const PARTICLE_END_SCALE = 0.4;
const PARTICLE_SPIN_MAX_DEG = 180;
/** perfect の金色に重ねる、明るい金の粒。 */
const FINEST_SPARKLE_COLOR = "rgb(253 224 71)";
const FINEST_GLOW_OPACITY = 0.7;
/** perfect の飛んでいる姿の周りの光の線の太さとぼかし（ピースの1辺に対する比）。 */
const GLOW = { width: 0.24, blur: 0.1 } as const;
const FINEST_EFFECTS = {
  sparkles: { count: 5, distanceRatio: 0.9 },
  particleDistanceRatio: 1.3,
  sink: { distancePx: 2, durationMs: 200 },
} as const;
const PARTICLE_DISTANCE_RATIO = 1;
const NUDGE_DURATION_MS = 240;
const COUNT_POP_MS = { finest: 340, other: 240 } as const;
/** 台紙の沈みと周りのマスの押し退けの、行って戻る形。 */
const SINK_OFFSETS = { push: 0.25, recoil: 0.6 } as const;
const NUDGE_PUSH_OFFSET = 0.25;
const COUNT_POP_PEAK_OFFSET = 0.3;
/** 行き先の枠の光の、ぼかしの大きさ（ピースの1辺に対する比）と、はまってから消えるまで。 */
const SLOT_GLOW = { blurRatio: 0.25, fadeMs: 90 } as const;
/** 押している間のマスの重なり。飛んでいる姿と行き過ぎた姿が、選んだマスも含めて周りのマスより手前に出る。 */
const STAMPING_SQUARE_Z_INDEX = "30";
/** 効果を描く層の重なり。台紙の中で、押しているマスより手前に出す。 */
const EFFECT_LAYER_Z_INDEX = "40";

/** 押すマスの中の、今の姿で押す面・前の色を重ねる面・浮いた影の要素。前の色の面は段階が上がったマスにだけある。 */
type ZukanStampParts = {
  face: Element;
  previous: Element | null;
  shadow: Element;
};

export function findZukanStampParts(square: Element): ZukanStampParts | null {
  const face = square.querySelector('[data-stamp-part="face"]');
  const shadow = square.querySelector('[data-stamp-part="shadow"]');
  return face && shadow
    ? {
        face,
        previous: square.querySelector('[data-stamp-part="previous"]'),
        shadow,
      }
    : null;
}

/**
 * 波紋や粒を描く層。台紙のマスと同じスクロールの中に重ね、台紙と一緒に動き、台の内側で切れる。
 * 台の外のレベルのカードや凡例、ランダムに遊ぶへは描かない。
 */
export type ZukanStampEffectLayer = {
  element: HTMLElement;
  /** 層を外し、描いている効果ごと片付ける。 */
  remove: () => void;
};

/**
 * マスを並べた `grid` の、位置の基準になる親の中に層を重ねる。
 * `purpose` は層の役目。押していく演出の層と、演出を終えたあとも残す「新しい」印の層を見分けられるようにする。
 */
export function createZukanStampEffectLayer(
  grid: Element,
  purpose: "stamp-effects" | "new-piece-marks" = "stamp-effects",
): ZukanStampEffectLayer {
  const element = document.createElement("div");
  element.setAttribute("aria-hidden", "true");
  element.setAttribute(`data-zukan-${purpose}`, "");
  Object.assign(element.style, {
    position: "absolute",
    inset: "0",
    pointerEvents: "none",
    zIndex: EFFECT_LAYER_Z_INDEX,
  });
  (grid.parentElement ?? grid).append(element);
  return {
    element,
    remove() {
      element.remove();
    },
  };
}

/** 層の中の、マスの中心の位置と1辺の大きさ。 */
export type ZukanStampSquareBox = ZukanStampPoint & { size: number };

/** マスの、層の中の位置と大きさを測る。押していく前にまとめて測り、押していく間はレイアウトを読まない。 */
export function measureZukanStampSquareBox(
  square: Element,
  layer: ZukanStampEffectLayer,
): ZukanStampSquareBox {
  const rect = square.getBoundingClientRect();
  const origin = layer.element.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2 - origin.left,
    y: rect.top + rect.height / 2 - origin.top,
    size: rect.width,
  };
}

/** マスに `data-piece-shape` が無いときに描く、四角いピースの形。 */
const SQUARE_PIECE_SHAPE = "0,0,0,0";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

/** 効果をピースの形で描く SVG。マスの2倍の大きさの要素いっぱいに、マスと中心を揃えて描く。 */
function createPieceSvg(
  path: string,
  attributes: Record<string, string>,
): SVGSVGElement {
  const svg = document.createElementNS(SVG_NAMESPACE, "svg");
  svg.setAttribute("viewBox", ZUKAN_PIECE_VIEW_BOX);
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.style.overflow = "visible";
  const shape = document.createElementNS(SVG_NAMESPACE, "path");
  shape.setAttribute("d", path);
  shape.setAttribute("stroke-linejoin", "round");
  for (const [name, value] of Object.entries(attributes)) {
    shape.setAttribute(name, value);
  }
  svg.append(shape);
  return svg;
}

let glowSequence = 0;

/**
 * ピースの外側だけに光をにじませる SVG。ぼかした線をピースの形で外側だけに切り抜く。
 * 内側へにじむと、光の層の下にある飛んでいる面がぼやけて見えるため。
 */
function createPieceGlowSvg(
  path: string,
  color: string,
  { width, blur }: { width: number; blur: number },
): SVGSVGElement {
  glowSequence += 1;
  const maskId = `zukan-stamp-glow-mask-${glowSequence}`;
  const filterId = `zukan-stamp-glow-blur-${glowSequence}`;
  const svg = createPieceSvg(path, {
    fill: "none",
    stroke: color,
    "stroke-width": String(width),
    filter: `url(#${filterId})`,
  });
  const glow = svg.firstElementChild;
  const defs = document.createElementNS(SVG_NAMESPACE, "defs");
  defs.innerHTML = `<filter id="${filterId}" x="-1" y="-1" width="3" height="3"><feGaussianBlur stdDeviation="${blur}"/></filter><mask id="${maskId}" maskUnits="userSpaceOnUse" x="-1" y="-1" width="3" height="3"><rect x="-1" y="-1" width="3" height="3" fill="#fff"/><path d="${path}" fill="#000"/></mask>`;
  const group = document.createElementNS(SVG_NAMESPACE, "g");
  group.setAttribute("mask", `url(#${maskId})`);
  if (glow) {
    group.append(glow);
  }
  svg.replaceChildren(defs, group);
  return svg;
}

/**
 * 1枚を押す間に作った動き・要素をまとめて持ち、取り消すときに一度に片付ける。
 * 動きは押していく演出の時計の時刻から始め、同じ時計で決める着く瞬間と、描く姿を揃える。
 */
class StampMotion {
  private readonly animations: Animation[] = [];
  private readonly elements: HTMLElement[] = [];

  constructor(
    private readonly layer: ZukanStampEffectLayer,
    private readonly square: HTMLElement | null,
  ) {
    square?.style.setProperty("z-index", STAMPING_SQUARE_Z_INDEX);
  }

  /**
   * はまった押す姿を薄れさせて、下のマスの普段の姿へ渡し、マスの重なりを戻す。
   * 普段の姿は着いた時から今の色で描かれているので、押す姿が薄れても、はまったピースの色は変わらない。
   */
  handOff(face: Element, timeline: ZukanStampTimeline, landTime: number) {
    const animation = this.animate(
      face,
      [{ opacity: 1 }, { opacity: 0 }],
      {
        delay: timeline.handOffMs - timeline.landMs,
        duration: timeline.handedOffMs - timeline.handOffMs,
        easing: MOTION_EASING.standard,
        fill: "forwards",
      },
      landTime,
    );
    const square = this.square;
    animation.finished.then(
      function restoreLayering() {
        square?.style.removeProperty("z-index");
      },
      function ignoreCancelled() {},
    );
  }

  animate(
    element: Element,
    keyframes: Keyframe[],
    options: KeyframeAnimationOptions,
    startTime: number,
  ): Animation {
    const animation = element.animate(keyframes, options);
    animation.startTime = startTime;
    this.animations.push(animation);
    return animation;
  }

  /** 層の、中心 `at` に大きさ `size` の要素を置き、動き終えたら外す。`content` があれば要素の中に描く。 */
  spawn(
    at: ZukanStampPoint,
    size: number,
    keyframes: Keyframe[],
    options: KeyframeAnimationOptions,
    startTime: number,
    {
      style = {},
      content,
    }: { style?: Partial<CSSStyleDeclaration>; content?: Element },
  ) {
    const element = document.createElement("div");
    Object.assign(element.style, {
      position: "absolute",
      left: `${at.x - size / 2}px`,
      top: `${at.y - size / 2}px`,
      width: `${size}px`,
      height: `${size}px`,
      opacity: "0",
      ...style,
    });
    if (content) {
      element.append(content);
    }
    this.layer.element.append(element);
    this.elements.push(element);
    const animation = this.animate(
      element,
      keyframes,
      { fill: "forwards", ...options },
      startTime,
    );
    animation.finished.then(
      function removeElement() {
        element.remove();
      },
      function ignoreCancelled() {},
    );
  }

  cancel() {
    for (const animation of this.animations) {
      animation.cancel();
    }
    for (const element of this.elements) {
      element.remove();
    }
    this.square?.style.removeProperty("z-index");
  }
}

/** 飛ぶ道のりの1点。押し始めてからの時刻と、枠からのずれと大きさ。 */
type FlightPoint = { atMs: number; dx: number; dy: number; scale: number };

/**
 * 枠から `from` だけ離れた所を、大きさ `scale` で飛び立ち、弧を描いて枠へ降りる道のり。
 * 弧は道のりの真ん中を上へ膨らませ、前半は大きさを保ち、後半で枠の大きさへ縮めながら速めて降ろす。最後の点で枠に沈む。
 */
function planFlight(
  from: ZukanStampPoint,
  scale: number,
  arcRatio: number,
  { flightMs, landMs }: ZukanStampTimeline,
): FlightPoint[] {
  const distance = Math.hypot(from.x, from.y);
  const control = { x: from.x / 2, y: from.y / 2 - distance * arcRatio };
  return Array.from({ length: FLIGHT_SAMPLE_COUNT + 1 }, (_, sample) => {
    const t = sample / FLIGHT_SAMPLE_COUNT;
    const u = (1 - Math.cos(Math.PI * t)) / 2;
    const descent =
      t <= FLIGHT_HOVER_RATIO
        ? 0
        : ((t - FLIGHT_HOVER_RATIO) / (1 - FLIGHT_HOVER_RATIO)) **
          FLIGHT_DESCENT_POWER;
    return {
      atMs: flightMs + (landMs - flightMs) * t,
      dx: (1 - u) ** 2 * from.x + 2 * (1 - u) * u * control.x,
      dy: (1 - u) ** 2 * from.y + 2 * (1 - u) * u * control.y,
      scale: scale + (PRESSED_SCALE - scale) * descent,
    };
  });
}

function toTransform({ dx, dy, scale }: Omit<FlightPoint, "atMs">): string {
  return `translate(${dx}px, ${dy}px) scale(${scale})`;
}

/**
 * 押す姿の動きを、数を描き直す側と同じ歩みで描かせる。
 * 変形と濃さだけの動きは、描き直しが重いコマでも別に進むので、ピースがはまって見えても数が遅れる。
 * 見た目の変わらない線の色を一緒に動かして、数の描き直しが済むまで押す姿も進めない。
 */
function paceWithCount(keyframes: Keyframe[]): Keyframe[] {
  return keyframes.map((keyframe) => ({
    ...keyframe,
    outlineColor: "transparent",
  }));
}

/** 飛んで枠に沈み、わずかに行き過ぎてから戻る押す姿の動き。飛ぶまでは見せない。 */
function flyFace(
  motion: StampMotion,
  face: Element,
  flight: readonly FlightPoint[],
  timeline: ZukanStampTimeline,
  startTime: number,
) {
  function offsetOf(ms: number): number {
    return ms / timeline.settledMs;
  }
  const appearMs = timeline.appearedMs - timeline.flightMs;
  const [first] = flight;
  const lastSample = flight.length - 1;
  const keyframes: Keyframe[] = [
    ...(first && timeline.flightMs > 0
      ? [{ transform: toTransform(first), opacity: 0, offset: 0 }]
      : []),
    ...flight.map((point, sample) => ({
      transform: toTransform(point),
      opacity: Math.min(1, (point.atMs - timeline.flightMs) / appearMs),
      offset: offsetOf(point.atMs),
      ...(sample === lastSample ? { easing: MOTION_EASING.celebrate } : {}),
    })),
    {
      transform: `scale(${OVERSHOOT_SCALE})`,
      opacity: 1,
      offset:
        offsetOf(timeline.landMs) +
        (1 - offsetOf(timeline.landMs)) * OVERSHOOT_OFFSET,
      easing: MOTION_EASING.standard,
    },
    { transform: "scale(1)", opacity: 1, offset: 1 },
  ];
  motion.animate(
    face,
    paceWithCount(keyframes),
    { duration: timeline.settledMs, fill: "forwards" },
    startTime,
  );
}

/** 飛んでいる姿の真下に、高さに応じて離れて薄い影を落とし、着くときに寄って濃くし、すぐ消す。 */
function flyShadow(
  motion: StampMotion,
  shadow: Element,
  flight: readonly FlightPoint[],
  { size, height }: { size: number; height: number },
  timeline: ZukanStampTimeline,
  startTime: number,
) {
  const durationMs = timeline.landMs + SHADOW_OPACITY.fadeMs;
  function offsetOf(ms: number): number {
    return ms / durationMs;
  }
  const peakScale = flight[0]?.scale ?? 1;
  const keyframes: Keyframe[] = [
    ...(timeline.flightMs > 0 ? [{ opacity: 0, offset: 0 }] : []),
    ...flight.map((point, sample) => {
      const lift = (point.scale - PRESSED_SCALE) / (peakScale - PRESSED_SCALE);
      return {
        transform: toTransform({
          dx: point.dx,
          dy: point.dy + size * height * lift,
          scale: point.scale,
        }),
        opacity:
          sample === 0
            ? 0
            : SHADOW_OPACITY.landed +
              (SHADOW_OPACITY.flight - SHADOW_OPACITY.landed) * lift,
        offset: offsetOf(point.atMs),
      };
    }),
    { transform: "scale(1)", opacity: 0, offset: 1 },
  ];
  motion.animate(
    shadow,
    keyframes,
    { duration: durationMs, fill: "forwards" },
    startTime,
  );
}

/** 段階が上がったマスの前の色を、飛んでいる間に今の色へ塗り替える。 */
function fadePreviousColor(
  motion: StampMotion,
  previous: Element | null,
  timeline: ZukanStampTimeline,
  startTime: number,
) {
  if (previous === null) {
    return;
  }
  const flightLength = timeline.landMs - timeline.flightMs;
  function offsetOf(ratio: number): number {
    return (timeline.flightMs + flightLength * ratio) / timeline.landMs;
  }
  motion.animate(
    previous,
    [
      { opacity: 1 },
      { opacity: 1, offset: offsetOf(PREVIOUS_COLOR_FADE.from) },
      { opacity: 0, offset: offsetOf(PREVIOUS_COLOR_FADE.to) },
      { opacity: 0 },
    ],
    { duration: timeline.landMs, fill: "forwards" },
    startTime,
  );
}

/** 行き先の枠を、飛んでくる前から淡く光らせて「ここに入る」と示し、はまったら消す。 */
function glowSlot(
  motion: StampMotion,
  box: ZukanStampSquareBox,
  piecePath: string,
  color: string,
  opacity: number,
  timeline: ZukanStampTimeline,
  startTime: number,
) {
  const durationMs = timeline.landMs + SLOT_GLOW.fadeMs;
  const fullMs = Math.max(timeline.flightMs, timeline.appearedMs);
  const firstMs = Math.min(SLOT_GLOW_FIRST_MS, fullMs);
  motion.spawn(
    box,
    box.size * 2,
    [
      { opacity: 0 },
      {
        opacity: opacity * (firstMs < fullMs ? SLOT_GLOW_FIRST_RATIO : 1),
        offset: firstMs / durationMs,
      },
      { opacity, offset: fullMs / durationMs },
      { opacity: opacity * 0.7, offset: timeline.landMs / durationMs },
      { opacity: 0 },
    ],
    { duration: durationMs, easing: MOTION_EASING.standard },
    startTime,
    {
      style: {
        filter: `drop-shadow(0 0 ${box.size * SLOT_GLOW.blurRatio}px ${color})`,
      },
      content: createPieceSvg(piecePath, { fill: color }),
    },
  );
}

/** perfect を飛ばしている間だけ、飛んでいる姿の周りに光を帯びさせ、着くときに消す。 */
function glowWhileFlying(
  motion: StampMotion,
  box: ZukanStampSquareBox,
  piecePath: string,
  color: string,
  flight: readonly FlightPoint[],
  timeline: ZukanStampTimeline,
  startTime: number,
) {
  motion.spawn(
    box,
    box.size * 2,
    [
      ...(timeline.flightMs > 0 ? [{ opacity: 0, offset: 0 }] : []),
      ...flight.map((point, sample) => ({
        transform: toTransform(point),
        opacity:
          sample === 0 || sample === flight.length - 1
            ? 0
            : FINEST_GLOW_OPACITY,
        offset: point.atMs / timeline.landMs,
      })),
    ],
    { duration: timeline.landMs },
    startTime,
    { content: createPieceGlowSvg(piecePath, color, GLOW) },
  );
}

function burstParticles(
  motion: StampMotion,
  at: ZukanStampPoint,
  color: string,
  startTime: number,
  {
    count,
    distancePx,
    durationMs,
  }: { count: number; distancePx: number; durationMs: number },
) {
  for (let i = 0; i < count; i += 1) {
    const angle =
      (Math.PI * 2 * (i + Math.random() * PARTICLE_ANGLE_JITTER)) / count;
    const distance =
      distancePx *
      (PARTICLE_DISTANCE_RANGE.min +
        Math.random() * PARTICLE_DISTANCE_RANGE.spread);
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;
    const spin = Math.round(Math.random() * PARTICLE_SPIN_MAX_DEG);
    motion.spawn(
      at,
      PARTICLE_SIZE_PX,
      [
        { transform: "translate(0, 0) rotate(0deg) scale(1)", opacity: 1 },
        {
          transform: `translate(${x}px, ${y}px) rotate(${spin}deg) scale(${PARTICLE_END_SCALE})`,
          opacity: 0,
        },
      ],
      { duration: durationMs, easing: MOTION_EASING.enter },
      startTime,
      { style: { background: color, borderRadius: "1px" } },
    );
  }
}

/** 中心 `at` から、直径 `diameter` まで細い円を広げる。結果画面の波紋と同じく、現れてから薄れながら広がる。 */
function ring(
  motion: StampMotion,
  at: ZukanStampPoint,
  color: string,
  startTime: number,
  {
    diameter,
    opacity,
    durationMs,
    widthPx,
  }: { diameter: number; opacity: number; durationMs: number; widthPx: number },
) {
  motion.spawn(
    at,
    diameter,
    [
      { transform: `scale(${RING_START_SCALE})`, opacity: 0 },
      { opacity, offset: RING_PEAK_OFFSET },
      { opacity: opacity * RING_HOLD.opacityRatio, offset: RING_HOLD.offset },
      { transform: "scale(1)", opacity: 0 },
    ],
    { duration: durationMs, easing: RING_EASING },
    startTime,
    {
      style: {
        border: `${widthPx}px solid ${color}`,
        borderRadius: "50%",
        boxSizing: "border-box",
        boxShadow: `0 0 ${RING_GLOW_PX.outer}px ${color}, 0 0 ${RING_GLOW_PX.inner}px ${color}, inset 0 0 ${RING_GLOW_PX.inner}px ${color}`,
      },
    },
  );
}

/** はまった瞬間に、ピースの形の白い光を一瞬広げる。 */
function flash(
  motion: StampMotion,
  box: ZukanStampSquareBox,
  piecePath: string,
  startTime: number,
  {
    opacity,
    scale,
    durationMs,
  }: { opacity: number; scale: number; durationMs: number },
) {
  motion.spawn(
    box,
    box.size * 2,
    [
      { transform: "scale(1)", opacity },
      { transform: `scale(${scale})`, opacity: 0 },
    ],
    { duration: durationMs, easing: MOTION_EASING.enter },
    startTime,
    { content: createPieceSvg(piecePath, { fill: "#fff" }) },
  );
}

const NEIGHBOR_DIRECTIONS = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
] as const;

function countGridColumns(grid: Element): number {
  return Math.max(
    getComputedStyle(grid)
      .gridTemplateColumns.split(" ")
      .filter((column) => column !== "").length,
    1,
  );
}

/** はまったマスの周りの8マスを、はまったマスから外へ押し退けて戻す。変化を見せているマスは動かさない。 */
function nudgeNeighbors(
  motion: StampMotion,
  square: Element,
  startTime: number,
  distancePx: number,
) {
  const grid = square.parentElement;
  const index = Number(square.getAttribute("data-index"));
  if (grid === null || Number.isNaN(index)) {
    return;
  }
  const columns = countGridColumns(grid);
  for (const [dx, dy] of NEIGHBOR_DIRECTIONS) {
    const column = (index % columns) + dx;
    const neighbor =
      column < 0 || column >= columns
        ? null
        : grid.querySelector(`[data-index="${index + dx + dy * columns}"]`);
    if (neighbor === null || neighbor.hasAttribute("data-change-stage")) {
      continue;
    }
    const length = Math.hypot(dx, dy);
    motion.animate(
      neighbor,
      [
        { transform: "translate(0, 0)" },
        {
          transform: `translate(${(dx / length) * distancePx}px, ${(dy / length) * distancePx}px)`,
          offset: NUDGE_PUSH_OFFSET,
        },
        { transform: "translate(0, 0)" },
      ],
      { duration: NUDGE_DURATION_MS, easing: MOTION_EASING.standard },
      startTime,
    );
  }
}

/**
 * はまった重みで、台紙をわずかに沈ませて戻す。
 * 動かすのはマスを並べた要素ではなく、マスと演出の層を囲む要素にする。演出の層に描いた波紋や光を、マスと一緒に沈ませるため。
 */
function sinkSheet(
  motion: StampMotion,
  square: Element,
  startTime: number,
  { distancePx, durationMs }: { distancePx: number; durationMs: number },
) {
  const sheet = square.parentElement?.parentElement;
  if (sheet === null || sheet === undefined) {
    return;
  }
  motion.animate(
    sheet,
    [
      { transform: "translateY(0)" },
      { transform: `translateY(${distancePx}px)`, offset: SINK_OFFSETS.push },
      {
        transform: `translateY(${-distancePx / 2}px)`,
        offset: SINK_OFFSETS.recoil,
      },
      { transform: "translateY(0)" },
    ],
    { duration: durationMs, easing: MOTION_EASING.standard },
    startTime,
  );
}

/**
 * 状態ごとの数のうち、`status` の項目の数字を弾ませる。
 * 数は画面の幅によって台紙の頭か横のどちらかに出すので、見えている方が弾むよう、どちらの並びも弾ませる。
 */
function popStatusCount(
  motion: StampMotion,
  status: ZukanProblemStatus,
  startTime: number,
  { scale, durationMs }: { scale: number; durationMs: number },
) {
  const order = zukanProblemStatusOrder.indexOf(status);
  for (const list of document.querySelectorAll(
    '[aria-label="状態ごとの問題の数"]',
  )) {
    const number = list
      .querySelectorAll(":scope > li")
      [order]?.querySelector(":scope > span:last-child");
    if (number === null || number === undefined) {
      continue;
    }
    motion.animate(
      number,
      [
        { transform: "scale(1)" },
        { transform: `scale(${scale})`, offset: COUNT_POP_PEAK_OFFSET },
        { transform: "scale(1)" },
      ],
      { duration: durationMs, easing: MOTION_EASING.celebrate },
      startTime,
    );
  }
}

/** はまったピースを、明るく保ってから元の明るさへ戻す。明るさはそのマスにだけ掛け、戻し終えたら外す。押す姿を普段の姿へ渡したあとも明るさを保つよう、マスごと明るくする。 */
function brightenLanded(
  motion: StampMotion,
  square: Element,
  durationMs: number,
  startTime: number,
) {
  const bright = `brightness(${LANDED_GLOW.brightness})`;
  motion.animate(
    square,
    [
      { filter: bright },
      { filter: bright, offset: LANDED_GLOW.holdRatio },
      { filter: "brightness(1)" },
    ],
    { duration: durationMs, easing: MOTION_EASING.standard },
    startTime,
  );
}

/** 押すマスと、その中の部品と変化。 */
type ZukanStampTarget = {
  square: Element;
  parts: ZukanStampParts;
  stamp: ZukanStamp;
};

/** 押し始めた1枚。着く瞬間は押していく演出の時計が決め、`land` で知らせる。 */
export type ZukanStampMotion = {
  /** はまった瞬間の、光・波紋・粒・周りの押し退け・数の弾み。`landTime` は着いた時刻。 */
  land: (landTime: number) => void;
  /** 動きを取り消して、重ねて描いた効果を片付ける。 */
  cancel: () => void;
};

type ZukanStampOptions = {
  layer: ZukanStampEffectLayer;
  /** 層の中のマスの位置と大きさ。 */
  box: ZukanStampSquareBox;
  style: ZukanStampStyle;
  /** 飛び立つ所。層の中の位置で表す。 */
  from: ZukanStampPoint;
  /** 押し始めた時刻。`document.timeline` の時刻で表す。 */
  startTime: number;
};

function canAnimate({ face, shadow, previous }: ZukanStampParts): boolean {
  return [face, shadow, ...(previous ? [previous] : [])].every(
    (element) => typeof element.animate === "function",
  );
}

/** 持ち上げずに、飛び立つ向きから少し大きい姿で縮めてはめ、沈んで戻る。 */
function playWaveFace(
  motion: StampMotion,
  face: Element,
  offset: ZukanStampPoint,
  timeline: ZukanStampTimeline,
  startTime: number,
) {
  const landOffset = timeline.landMs / timeline.settledMs;
  motion.animate(
    face,
    paceWithCount([
      {
        transform: toTransform({
          dx: offset.x,
          dy: offset.y,
          scale: WAVE_START_SCALE,
        }),
        opacity: 0,
      },
      {
        transform: toTransform({
          dx: offset.x / 3,
          dy: offset.y / 3,
          scale: (WAVE_START_SCALE + WAVE_PRESSED_SCALE) / 2,
        }),
        opacity: WAVE_APPROACH_OPACITY,
        offset: landOffset / 2,
      },
      {
        transform: `scale(${WAVE_PRESSED_SCALE})`,
        opacity: 1,
        offset: landOffset,
        easing: MOTION_EASING.celebrate,
      },
      { transform: "scale(1)", opacity: 1 },
    ]),
    { duration: timeline.settledMs, fill: "forwards" },
    startTime,
  );
}

/** はまった瞬間の、見せ方と段階に応じた光・波紋・粒・押し退け・数の弾み。 */
function playImpact(
  motion: StampMotion,
  { square, stamp }: ZukanStampTarget,
  box: ZukanStampSquareBox,
  look: FlightLook,
  { color, piecePath }: { color: string; piecePath: string },
  landTime: number,
) {
  const tier = getZukanStampTier(stamp.level);
  flash(motion, box, piecePath, landTime, look.flash);
  brightenLanded(motion, square, look.landedGlowMs, landTime);
  const { ripple } = look;
  const rippleColor = toRippleColor(color);
  const diameter = box.size * ripple.scale;
  ring(motion, box, rippleColor, landTime, { ...ripple, diameter });
  if (ripple.echoDelayMs !== null) {
    ring(motion, box, rippleColor, landTime + ripple.echoDelayMs, {
      ...ripple,
      diameter,
      opacity: ripple.opacity * RING_ECHO_OPACITY_RATIO,
    });
  }
  burstParticles(motion, box, color, landTime, {
    count: tier.particleCount,
    distancePx:
      box.size *
      (tier.isFinest
        ? FINEST_EFFECTS.particleDistanceRatio
        : PARTICLE_DISTANCE_RATIO),
    durationMs: ripple.durationMs,
  });
  if (tier.isFinest) {
    burstParticles(motion, box, FINEST_SPARKLE_COLOR, landTime, {
      count: FINEST_EFFECTS.sparkles.count,
      distancePx: box.size * FINEST_EFFECTS.sparkles.distanceRatio,
      durationMs: ripple.durationMs,
    });
    sinkSheet(motion, square, landTime, FINEST_EFFECTS.sink);
  }
  if (look.nudgePx !== null) {
    nudgeNeighbors(motion, square, landTime, look.nudgePx);
  }
  popStatusCount(motion, stamp.level, landTime, {
    scale: tier.countPopScale,
    durationMs: tier.isFinest ? COUNT_POP_MS.finest : COUNT_POP_MS.other,
  });
}

/**
 * 変化した1枚を、見せ方 `style` で押し始める。
 * `hero` と `featured` は、行き先の枠を淡く光らせ、`from` から大きな姿で弧を描いて飛ばし、影を落として枠に沈め、わずかに行き過ぎてから戻す。はまったら白い光と波紋を広げる。
 * `hero` は枠を光らせてから飛ばし、同心円の波紋を広げて周りのマスを押し退ける。perfect は飛んでいる間に光を帯びる。段階が上がったマスは前の色で飛ばし、飛んでいる間に今の色へ塗り替える。
 * はまったピースは、しばらく明るく保ってから戻し、小さなピースでも周りから見分けられるようにする。
 * `wave` は持ち上げずに、`from` の向きから少し大きい姿で縮めてはめる。
 * はまったら、押す姿を少し後から薄れさせて、今の姿で描いたマスの普段の姿へ渡す。
 * 動きを減らす設定と、動かせない環境では動かさず `null` を返す。
 */
export function startZukanStamp(
  target: ZukanStampTarget,
  { layer, box, style, from, startTime }: ZukanStampOptions,
): ZukanStampMotion | null {
  if (prefersReducedMotion() || !canAnimate(target.parts)) {
    return null;
  }
  const square = target.square instanceof HTMLElement ? target.square : null;
  const motion = new StampMotion(layer, square);
  const timeline = getZukanStampTimeline(style);
  const offset = { x: from.x - box.x, y: from.y - box.y };
  if (style === "wave") {
    // 波は1コマに何枚も押し始めるので、色を読んで描き方を計算し直させない。
    fadePreviousColor(motion, target.parts.previous, timeline, startTime);
    playWaveFace(motion, target.parts.face, offset, timeline, startTime);
    return {
      land(landTime) {
        motion.handOff(target.parts.face, timeline, landTime);
      },
      cancel() {
        motion.cancel();
      },
    };
  }
  // 押す面は文字色を `currentColor` にしてピースを塗る。
  const color = getComputedStyle(target.parts.face).color;
  const piecePath = getZukanPiecePath(
    target.square.getAttribute("data-piece-shape") ?? SQUARE_PIECE_SHAPE,
  );
  fadePreviousColor(motion, target.parts.previous, timeline, startTime);
  const look = flightLooks[style];
  const tier = getZukanStampTier(target.stamp.level);
  const flight = planFlight(
    offset,
    look.scale + tier.flightScaleBonus,
    look.arcRatio,
    timeline,
  );
  glowSlot(
    motion,
    box,
    piecePath,
    color,
    look.slotGlowOpacity,
    timeline,
    startTime,
  );
  flyShadow(
    motion,
    target.parts.shadow,
    flight,
    { size: box.size, height: look.shadowHeight },
    timeline,
    startTime,
  );
  flyFace(motion, target.parts.face, flight, timeline, startTime);
  if (tier.isFinest) {
    glowWhileFlying(motion, box, piecePath, color, flight, timeline, startTime);
  }
  return {
    land(landTime) {
      playImpact(motion, target, box, look, { color, piecePath }, landTime);
      motion.handOff(target.parts.face, timeline, landTime);
    },
    cancel() {
      motion.cancel();
    },
  };
}

/** 「新しい」印を脈打たせ終えるまでの長さ。 */
export const ZUKAN_NEW_PIECE_MARK_MS =
  NEW_PIECE_MARK.pulseMs * NEW_PIECE_MARK.pulseCount;

/** 「新しい」印を付けるマスと、その層の中の位置と大きさ。 */
export type ZukanNewPieceMarkTarget = {
  square: Element;
  box: ZukanStampSquareBox;
};

/**
 * 今回はめたピースに「新しい」印を残す。ピースの輪郭の外に白い光をにじませ、ゆっくり何度か脈打たせてから消す。
 * 動きを減らす設定と、動かせない環境では何もしない。戻り値は、印をすぐ消して片付ける関数。
 */
export function playZukanNewPieceMarks(
  layer: ZukanStampEffectLayer,
  targets: readonly ZukanNewPieceMarkTarget[],
  startTime: number,
): () => void {
  if (prefersReducedMotion() || typeof layer.element.animate !== "function") {
    return function cancelNothing() {};
  }
  const motion = new StampMotion(layer, null);
  const { peak, low } = NEW_PIECE_MARK.opacity;
  const keyframes: Keyframe[] = [
    { opacity: 0 },
    ...Array.from({ length: NEW_PIECE_MARK.pulseCount }, (_, pulse) => [
      { opacity: peak, offset: (pulse + 0.4) / NEW_PIECE_MARK.pulseCount },
      {
        opacity: pulse === NEW_PIECE_MARK.pulseCount - 1 ? 0 : low,
        offset: (pulse + 1) / NEW_PIECE_MARK.pulseCount,
      },
    ]).flat(),
  ];
  for (const { square, box } of targets) {
    motion.spawn(
      box,
      box.size * 2,
      keyframes,
      {
        duration: ZUKAN_NEW_PIECE_MARK_MS,
        easing: "ease-in-out",
      },
      startTime,
      {
        content: createPieceGlowSvg(
          getZukanPiecePath(
            square.getAttribute("data-piece-shape") ?? SQUARE_PIECE_SHAPE,
          ),
          "#fff",
          NEW_PIECE_MARK.glow,
        ),
      },
    );
  }
  return function cancel() {
    motion.cancel();
  };
}

export const _private = { planFlight, getZukanStampTier };
