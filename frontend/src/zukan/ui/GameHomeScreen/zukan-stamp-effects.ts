import type { GameResultLevel } from "@/games/result";
import { MOTION_EASING, prefersReducedMotion } from "@/lib/motion";
import {
  getZukanStampTailMs,
  ZUKAN_STAMP_DURATION_MS,
  type ZukanStamp,
} from "@/zukan/ui/GameHomeScreen/zukan-change-reveal";
import { zukanProblemStatusOrder } from "@/zukan/ui/GameHomeScreen/zukan-problem-appearance";
import { playZukanStampSound } from "@/zukan/ui/GameHomeScreen/zukan-stamp-sound";
import type { ZukanProblemStatus } from "@/zukan/zukan-collection";

/** 評価段階ごとの押し方の強さ。段階が高いほど大きく浮かせ、周りへの衝撃を強くする。 */
export type ZukanStampTier = {
  /** 浮いた姿の大きさ（マスの大きさに対する倍率）。 */
  liftedScale: number;
  /** 着いたときに飛び散らせる、マスの色の粒の数。 */
  particleCount: number;
  /** 着いたときに広げる衝撃波の大きさと太さ。 */
  shockwaveScale: number;
  shockwaveWidthPx: number;
  /** 着いたときに、マスの色の光をにじませるか。 */
  flashes: boolean;
  /** 浮いている間に光を帯び、着いたときに台紙を揺らして周りのマスを押し退け、金の粒を足すか。perfect だけ。 */
  isFinest: boolean;
  /** 着いたときに状態ごとの数を弾ませる大きさ。 */
  countPopScale: number;
};

const zukanStampTiers: Record<GameResultLevel, ZukanStampTier> = {
  clear: {
    liftedScale: 2.2,
    particleCount: 0,
    shockwaveScale: 2.6,
    shockwaveWidthPx: 2,
    flashes: false,
    isFinest: false,
    countPopScale: 1.3,
  },
  good: {
    liftedScale: 2.4,
    particleCount: 0,
    shockwaveScale: 3,
    shockwaveWidthPx: 2,
    flashes: false,
    isFinest: false,
    countPopScale: 1.35,
  },
  great: {
    liftedScale: 2.8,
    particleCount: 6,
    shockwaveScale: 3.6,
    shockwaveWidthPx: 2,
    flashes: true,
    isFinest: false,
    countPopScale: 1.45,
  },
  perfect: {
    liftedScale: 3.4,
    particleCount: 14,
    shockwaveScale: 6,
    shockwaveWidthPx: 3,
    flashes: true,
    isFinest: true,
    countPopScale: 1.9,
  },
};

export function getZukanStampTier(level: GameResultLevel): ZukanStampTier {
  return zukanStampTiers[level];
}

/** 浮き始めは、浮いた姿より少し大きい所から現れる。 */
const APPEAR_EXTRA_SCALE = 0.2;
/** 落とす長さのうち、現れ終えて浮いた姿になるまでの割合。 */
const APPEARED_OFFSET = 0.4;
/** 段階が上がったマスを、前の色のまま持ち上げる高さ。 */
const RAISED_LIFT_PX = -6;
/** マスに着いた瞬間の、押し付けて縮んだ大きさ。 */
const PRESSED_SCALE = 0.8;
/** 押し付けたあとに膨らむ大きさと、その山の位置。 */
const REBOUND_SCALE = { finest: 1.3, other: 1.1 } as const;
const REBOUND_OFFSET = 0.4;
/** 段階が上がったマスで、前の色が今の色へ塗り替わり終える、落とす長さに対する割合。 */
const PREVIOUS_COLOR_FADE_END_OFFSET = 0.85;

/** 衝撃波は半分ほどの時間で大きさの多くを広げ、そこから薄れながら残りを広げる。 */
const SHOCKWAVE_MIDWAY = { offset: 0.45, progress: 0.7, opacity: 0.7 } as const;
const PARTICLE_SIZE_PX = 5;
/** 粒を飛ばす向きと距離のばらつき。 */
const PARTICLE_ANGLE_JITTER = 0.6;
const PARTICLE_DISTANCE_RANGE = { min: 0.6, spread: 0.5 } as const;
const PARTICLE_END_SCALE = 0.4;
const PARTICLE_SPIN_MAX_DEG = 180;
const FLASH_OPACITY = 0.55;
/** perfect の金色に重ねる、明るい金の粒。 */
const FINEST_SPARKLE_COLOR = "rgb(253 224 71)";
const FINEST_GLOW_OPACITY = 0.8;
const FINEST_EFFECTS = {
  innerShockwave: { scaleRatio: 0.6, durationRatio: 0.8, widthPx: 2 },
  sparkles: { count: 6, distancePx: 28 },
  particleDistancePx: 46,
  flash: { durationMs: 260, scale: 2.6 },
  shake: { distancePx: 3, durationMs: 200 },
  nudge: { distancePx: 3, durationMs: 260 },
  countPopMs: 360,
} as const;
const OTHER_EFFECTS = {
  particleDistancePx: 28,
  flash: { durationMs: 160, scale: 1.6 },
  countPopMs: 240,
} as const;
/** 台紙の揺れと周りのマスの押し退けの、行って戻る形。 */
const SHAKE_OFFSETS = { push: 0.2, recoil: 0.5 } as const;
const NUDGE_PUSH_OFFSET = 0.25;
const COUNT_POP_PEAK_OFFSET = 0.3;
/** 効果を描く層の重なり。台紙の外のヘッダーやレベルのカードより手前に出す。 */
const EFFECT_LAYER_Z_INDEX = "60";

/** 押すマスの中の、今の姿で押す面・前の色を重ねる面・浮いた影の要素。前の色の面は段階が上がったマスにだけある。 */
export type ZukanStampParts = {
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
 * 粒や衝撃波を、台紙のスクロール領域で切れないよう画面に重ねて描く層。
 * 層は台紙のスクロールに合わせて動き、描いた効果がマスから離れないようにする。
 */
export type ZukanStampEffectLayer = {
  element: HTMLElement;
  /** 画面の上下の位置を、`element` の中の上下の位置にする。 */
  toLayerY: (viewportY: number) => number;
  /** 層を外し、描いている効果ごと片付ける。 */
  remove: () => void;
};

export function createZukanStampEffectLayer(
  scroller: HTMLElement,
): ZukanStampEffectLayer {
  const frame = document.createElement("div");
  frame.setAttribute("aria-hidden", "true");
  frame.setAttribute("data-zukan-stamp-effects", "");
  Object.assign(frame.style, {
    position: "fixed",
    inset: "0",
    pointerEvents: "none",
    zIndex: EFFECT_LAYER_Z_INDEX,
    overflow: "hidden",
  });
  const element = document.createElement("div");
  Object.assign(element.style, { position: "absolute", inset: "0" });
  frame.append(element);
  document.body.append(frame);
  const initialScrollTop = scroller.scrollTop;
  function scrolledBy() {
    return scroller.scrollTop - initialScrollTop;
  }
  function followScroll() {
    element.style.transform = `translateY(${-scrolledBy()}px)`;
  }
  scroller.addEventListener("scroll", followScroll);
  return {
    element,
    toLayerY(viewportY) {
      return viewportY + scrolledBy();
    },
    remove() {
      scroller.removeEventListener("scroll", followScroll);
      frame.remove();
    },
  };
}

type Point = { x: number; y: number };
type SquareBox = Point & { size: number };

function readSquareBox(element: Element): SquareBox {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
    size: rect.width,
  };
}

/** 1マスを押す間に作った動き・要素・時計をまとめて持ち、取り消すときに一度に片付ける。 */
class StampMotion {
  private readonly animations: Animation[] = [];
  private readonly elements: HTMLElement[] = [];
  private readonly timers: number[] = [];

  constructor(private readonly layer: ZukanStampEffectLayer) {}

  animate(
    element: Element,
    keyframes: Keyframe[],
    options: KeyframeAnimationOptions,
  ): Animation {
    const animation = element.animate(keyframes, options);
    this.animations.push(animation);
    return animation;
  }

  after(delayMs: number, then: () => void) {
    this.timers.push(window.setTimeout(then, delayMs));
  }

  /** `animation` が描かれ終えたら `then` を呼ぶ。描くのが遅れても、音や数をマスに着いた姿と揃える。取り消したら呼ばない。 */
  whenFinished(animation: Animation, then: () => void) {
    animation.finished.then(then, function ignoreCancelled() {});
  }

  /** 層の、中心 `at` に大きさ `size` の要素を置き、動き終えたら外す。 */
  spawn(
    at: Point,
    size: number,
    style: Partial<CSSStyleDeclaration>,
    keyframes: Keyframe[],
    options: KeyframeAnimationOptions,
  ) {
    const element = document.createElement("div");
    Object.assign(element.style, {
      position: "absolute",
      left: `${at.x - size / 2}px`,
      top: `${this.layer.toLayerY(at.y) - size / 2}px`,
      width: `${size}px`,
      height: `${size}px`,
      ...style,
    });
    this.layer.element.append(element);
    this.elements.push(element);
    const animation = this.animate(element, keyframes, {
      fill: "forwards",
      ...options,
    });
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
    for (const timer of this.timers) {
      window.clearTimeout(timer);
    }
  }
}

function burstParticles(
  motion: StampMotion,
  at: SquareBox,
  color: string,
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
      { background: color, borderRadius: "1px" },
      [
        { transform: "translate(0, 0) rotate(0deg) scale(1)", opacity: 1 },
        {
          transform: `translate(${x}px, ${y}px) rotate(${spin}deg) scale(${PARTICLE_END_SCALE})`,
          opacity: 0,
        },
      ],
      { duration: durationMs, easing: MOTION_EASING.enter },
    );
  }
}

function shockwave(
  motion: StampMotion,
  at: SquareBox,
  color: string,
  {
    scale,
    durationMs,
    widthPx,
  }: { scale: number; durationMs: number; widthPx: number },
) {
  motion.spawn(
    at,
    at.size,
    { border: `${widthPx}px solid ${color}`, boxSizing: "border-box" },
    [
      { transform: "scale(1)", opacity: 1 },
      {
        transform: `scale(${1 + (scale - 1) * SHOCKWAVE_MIDWAY.progress})`,
        opacity: SHOCKWAVE_MIDWAY.opacity,
        offset: SHOCKWAVE_MIDWAY.offset,
      },
      { transform: `scale(${scale})`, opacity: 0 },
    ],
    { duration: durationMs, easing: MOTION_EASING.enter },
  );
}

/** 着いた瞬間にマスの色の光をにじませる。白い台紙の上でも見えるよう、白ではなくマスの色にする。 */
function flash(
  motion: StampMotion,
  at: SquareBox,
  color: string,
  { durationMs, scale }: { durationMs: number; scale: number },
) {
  motion.spawn(
    at,
    at.size,
    {
      background: color,
      boxShadow: `0 0 ${at.size}px ${at.size / 2}px ${color}`,
    },
    [
      { transform: "scale(1)", opacity: FLASH_OPACITY },
      { transform: `scale(${scale})`, opacity: 0 },
    ],
    { duration: durationMs, easing: MOTION_EASING.enter },
  );
}

/** perfect を浮かせている間だけ、浮いた姿の周りに光を帯びさせ、着くときに消す。 */
function glowWhileLifted(
  motion: StampMotion,
  at: SquareBox,
  color: string,
  { liftedScale, durationMs }: { liftedScale: number; durationMs: number },
) {
  const size = at.size * liftedScale;
  motion.spawn(
    at,
    size,
    { boxShadow: `0 0 ${size / 3}px ${size / 6}px ${color}` },
    [
      { opacity: 0 },
      { opacity: FINEST_GLOW_OPACITY, offset: APPEARED_OFFSET },
      { opacity: 0, transform: `scale(${1 / liftedScale})` },
    ],
    { duration: durationMs, easing: MOTION_EASING.standard },
  );
}

function countGridColumns(grid: Element): number {
  return Math.max(
    getComputedStyle(grid)
      .gridTemplateColumns.split(" ")
      .filter((column) => column !== "").length,
    1,
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

/** 押したマスの周りの8マスを、押したマスから外へ押し退けて戻す。変化を見せているマスは動かさない。 */
function nudgeNeighbors(
  motion: StampMotion,
  square: Element,
  { distancePx, durationMs }: { distancePx: number; durationMs: number },
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
      { duration: durationMs, easing: MOTION_EASING.standard },
    );
  }
}

function shakeSheet(
  motion: StampMotion,
  square: Element,
  { distancePx, durationMs }: { distancePx: number; durationMs: number },
) {
  const grid = square.parentElement;
  if (grid === null) {
    return;
  }
  motion.animate(
    grid,
    [
      { transform: "translateY(0)" },
      {
        transform: `translateY(${distancePx}px)`,
        offset: SHAKE_OFFSETS.push,
      },
      {
        transform: `translateY(${-distancePx / 2}px)`,
        offset: SHAKE_OFFSETS.recoil,
      },
      { transform: "translateY(0)" },
    ],
    { duration: durationMs, easing: MOTION_EASING.standard },
  );
}

/** 台紙の上の状態ごとの数のうち、`status` の項目を弾ませる。 */
function popStatusCount(
  motion: StampMotion,
  status: ZukanProblemStatus,
  { scale, durationMs }: { scale: number; durationMs: number },
) {
  const item = document.querySelectorAll(
    '[aria-label="状態ごとの問題の数"] > li',
  )[zukanProblemStatusOrder.indexOf(status)];
  if (item === undefined) {
    return;
  }
  motion.animate(
    item,
    [
      { transform: "scale(1)" },
      { transform: `scale(${scale})`, offset: COUNT_POP_PEAK_OFFSET },
      { transform: "scale(1)" },
    ],
    { duration: durationMs, easing: MOTION_EASING.celebrate },
  );
}

/** 押すマスと、その中の部品と変化。 */
export type ZukanStampTarget = {
  square: Element;
  parts: ZukanStampParts;
  stamp: ZukanStamp;
};

type ZukanStampOptions = {
  layer: ZukanStampEffectLayer;
  /** その回の音を鳴らすマスか。まとめて押す回では、最も重い変化のマスだけが鳴らす。 */
  playsSound: boolean;
  /** 押す姿がマスに着いたとき。マスを今の姿にし、数を数え上げる時機。 */
  onLanded: () => void;
  /** 着いたあとの戻り・衝撃波・粒が終わったとき。 */
  onFinished: () => void;
};

function canAnimate({ face, shadow, previous }: ZukanStampParts): boolean {
  return [face, shadow, ...(previous ? [previous] : [])].every(
    (element) => typeof element.animate === "function",
  );
}

/**
 * 変化したマスを押す。評価段階が高いほど大きく浮かせてから縮めてマスに着かせ、着いたら少し膨らんで戻しながら、段階に応じた衝撃波・光・粒を広げ、状態ごとの数を弾ませて音を鳴らす。
 * 段階が上がったマスは前の色で持ち上げ、落ちながら今の色へ塗り替える。perfect は浮いている間に光を帯び、着いたときに台紙を揺らして周りのマスを押し退ける。
 * 着いたことは時刻の見込みではなく落とす動きの終わりで知らせ、音と数をマスに着いた姿に揃える。
 * 動きを減らす設定と、動かせない環境では動かさず鳴らさず、すぐに着いて終わったものとする。戻り値は動きを取り消して、重ねて描いた効果を片付ける関数。
 */
export function playZukanStamp(
  { square, parts, stamp }: ZukanStampTarget,
  { layer, playsSound, onLanded, onFinished }: ZukanStampOptions,
): () => void {
  if (prefersReducedMotion() || !canAnimate(parts)) {
    onLanded();
    onFinished();
    return function cancelNothing() {};
  }
  const motion = new StampMotion(layer);
  const tier = getZukanStampTier(stamp.level);
  const isFinest = tier.isFinest;
  const dropMs = isFinest
    ? ZUKAN_STAMP_DURATION_MS.perfectDrop
    : ZUKAN_STAMP_DURATION_MS.drop;
  const impactTailMs = getZukanStampTailMs(stamp) - dropMs;
  const color = getComputedStyle(parts.face).backgroundColor;
  const liftPx = stamp.isRaised ? RAISED_LIFT_PX : 0;

  const drop = motion.animate(
    parts.face,
    [
      {
        transform: `scale(${tier.liftedScale + APPEAR_EXTRA_SCALE})`,
        opacity: 0,
        easing: MOTION_EASING.enter,
      },
      {
        transform: `translateY(${liftPx}px) scale(${tier.liftedScale})`,
        opacity: 1,
        offset: APPEARED_OFFSET,
        easing: MOTION_EASING.standard,
      },
      { transform: `scale(${PRESSED_SCALE})`, opacity: 1 },
    ],
    { duration: dropMs, fill: "forwards" },
  );
  if (parts.previous) {
    motion.animate(
      parts.previous,
      [
        { opacity: 1 },
        { opacity: 1, offset: APPEARED_OFFSET },
        { opacity: 0, offset: PREVIOUS_COLOR_FADE_END_OFFSET },
        { opacity: 0 },
      ],
      { duration: dropMs, fill: "forwards" },
    );
  }
  motion.animate(
    parts.shadow,
    [{ opacity: 1 }, { opacity: 1, offset: APPEARED_OFFSET }, { opacity: 0 }],
    { duration: dropMs },
  );
  if (isFinest) {
    glowWhileLifted(motion, readSquareBox(square), color, {
      liftedScale: tier.liftedScale,
      durationMs: dropMs,
    });
  }

  motion.whenFinished(drop, function impact() {
    onLanded();
    motion.after(impactTailMs, onFinished);
    motion.animate(
      parts.face,
      [
        { transform: `scale(${PRESSED_SCALE})`, opacity: 1 },
        {
          transform: `scale(${isFinest ? REBOUND_SCALE.finest : REBOUND_SCALE.other})`,
          opacity: 1,
          offset: REBOUND_OFFSET,
        },
        { transform: "scale(1)", opacity: 1 },
      ],
      {
        duration: ZUKAN_STAMP_DURATION_MS.settle,
        easing: MOTION_EASING.celebrate,
      },
    );
    // 着いた姿を保っていた動きは、戻りの動きが引き継いだので外す。
    drop.cancel();
    const at = readSquareBox(square);
    const effects = isFinest ? FINEST_EFFECTS : OTHER_EFFECTS;
    shockwave(motion, at, color, {
      scale: tier.shockwaveScale,
      durationMs: impactTailMs,
      widthPx: tier.shockwaveWidthPx,
    });
    if (tier.flashes) {
      flash(motion, at, color, effects.flash);
    }
    burstParticles(motion, at, color, {
      count: tier.particleCount,
      distancePx: effects.particleDistancePx,
      durationMs: impactTailMs,
    });
    if (isFinest) {
      const { innerShockwave, sparkles } = FINEST_EFFECTS;
      shockwave(motion, at, color, {
        scale: tier.shockwaveScale * innerShockwave.scaleRatio,
        durationMs: impactTailMs * innerShockwave.durationRatio,
        widthPx: innerShockwave.widthPx,
      });
      burstParticles(motion, at, FINEST_SPARKLE_COLOR, {
        ...sparkles,
        durationMs: impactTailMs,
      });
      shakeSheet(motion, square, FINEST_EFFECTS.shake);
      nudgeNeighbors(motion, square, FINEST_EFFECTS.nudge);
    }
    popStatusCount(motion, stamp.level, {
      scale: tier.countPopScale,
      durationMs: effects.countPopMs,
    });
    if (playsSound) {
      playZukanStampSound(stamp);
    }
  });

  return function cancel() {
    motion.cancel();
  };
}
