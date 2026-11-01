import type { ProblemId } from "@/games/problem-id";
import { MOTION_EASING, playAnimations } from "@/lib/motion";
import {
  getZukanProblemStatus,
  type ZukanProblem,
  type ZukanProblemStatus,
} from "@/zukan/zukan-collection";
import type { ZukanProblemChange } from "@/zukan/zukan-last-viewed";

/**
 * 前回図鑑を見たときからの変化を、台紙のマスでどう見せるか。
 * - `animated`: 前回の姿から、変化したマスを1つずつ押していく演出で見せる。
 * - `marked`: 動きを減らす設定で、動かさずに今の姿に印を載せて見せる。
 */
export type ZukanChangeAppearance = "animated" | "marked";

/**
 * 変化したマスの、今見せている段階。
 * - `waiting`: まだ押していない。前回の姿で描く。
 * - `stamping`: 押している途中で、まだマスに着いていない。下には前回の姿を残す。
 * - `landed`: マスに着いた。今の姿で描き、押した動きの残りを見せる。
 * - `marked`: 動きを減らす設定で、今の姿に印を載せる。
 */
export type ZukanChangeStage = "waiting" | "stamping" | "landed" | "marked";

/** 台紙を開いてから、最初のマスを押し始めるまでの最短の時間。台紙のスクロールが長ければ、その終わりまで待つ。 */
const PREVIOUS_STATE_HOLD_MS = 300;
/** 押す姿が、大きく浮いた所から現れて縮み、マスに着くまで。 */
const STAMP_DROP_DURATION_MS = 190;
/** 押す姿が現れ終える、マスに着くまでの長さに対する割合。 */
const STAMP_APPEAR_OFFSET = 0.36;
/** マスに着いてから、少し行き過ぎた姿から戻るまで。 */
const STAMP_SETTLE_DURATION_MS = 150;
/** マスに着いたときにマスから広がって消える輪の長さ。 */
const STAMP_RING_DURATION_MS = 300;
/** 浮いた姿の大きさ。現れ始めと、現れ終えたとき。 */
const STAMP_LIFTED_SCALE = 2.4;
const STAMP_APPEARED_SCALE = 2.2;
/** マスに着いた瞬間の、行き過ぎて縮んだ大きさ。 */
const STAMP_PRESSED_SCALE = 0.82;
/** 輪が広がりきったときの大きさ。台紙のスクロール領域の内側余白は、この輪が収まる幅にしてある。 */
const STAMP_RING_SCALE = 2.8;
/** 変化が少ないときの、隣り合う順のマスを押し始める間隔。 */
const STAMP_INTERVAL_MAX_MS = 150;
/** 開いてから、最後のマスの輪が消えるまでの上限。変化が多ければ押す間隔を詰める。台紙のスクロールを待つ分は含めない。 */
const REVEAL_DURATION_MAX_MS = 1500;
/** 1つずつ押すマスの数。これより後に変化したマスは、最後にまとめて押す。 */
const INDIVIDUAL_STAMP_LIMIT = 12;
/** 1マスを押し始めてから、そのマスの動きが終わるまで。 */
const STAMP_TAIL_MS =
  STAMP_DROP_DURATION_MS +
  Math.max(STAMP_SETTLE_DURATION_MS, STAMP_RING_DURATION_MS);
/** 押すマスを見えているものとする、台紙の見える範囲の端からの距離。浮いた姿と輪が端で切れない幅。 */
const REVEAL_SCROLL_MARGIN_PX = 32;

const stampDropKeyframes: Keyframe[] = [
  {
    transform: `scale(${STAMP_LIFTED_SCALE})`,
    opacity: 0,
    easing: MOTION_EASING.enter,
  },
  {
    transform: `scale(${STAMP_APPEARED_SCALE})`,
    opacity: 1,
    offset: STAMP_APPEAR_OFFSET,
    easing: MOTION_EASING.standard,
  },
  { transform: `scale(${STAMP_PRESSED_SCALE})`, opacity: 1 },
];

/** 浮いている間だけ影を見せ、マスに着くまでに消す。影は塗りと別の要素にして、透明度だけを動かす。 */
const stampShadowKeyframes: Keyframe[] = [
  { opacity: 1 },
  { opacity: 1, offset: STAMP_APPEAR_OFFSET, easing: MOTION_EASING.standard },
  { opacity: 0 },
];

const stampSettleKeyframes: Keyframe[] = [
  { transform: `scale(${STAMP_PRESSED_SCALE})`, opacity: 1 },
  { transform: "scale(1)", opacity: 1 },
];

const stampRingKeyframes: Keyframe[] = [
  { transform: "scale(1)", opacity: 0.9 },
  { transform: `scale(${STAMP_RING_SCALE})`, opacity: 0 },
];

/** 変化したマスを押す順のうち `order` 番目のマスを押す回。1つずつ押す数より後のマスは、最後の1回にまとめる。 */
export function getZukanStampSlot(order: number): number {
  return Math.min(order, INDIVIDUAL_STAMP_LIMIT);
}

/** 変化したマスが `changeCount` 個のときに、押す回の数。 */
export function countZukanStampSlots(changeCount: number): number {
  return changeCount === 0 ? 0 : getZukanStampSlot(changeCount - 1) + 1;
}

/** 押す順に並べたマスの位置 `indices` を、押す回ごとに分ける。 */
export function groupZukanStampSlots(indices: readonly number[]): number[][] {
  const slots: number[][] = [];
  indices.forEach((index, order) => {
    const slot = getZukanStampSlot(order);
    slots[slot] = [...(slots[slot] ?? []), index];
  });
  return slots;
}

/** マスを押す回ごとの時刻。台紙を開いてからの経過で表す。 */
export type ZukanStampPlan = {
  /** 回ごとの、押し始める時刻。スクロールを待つ間は後へずれる。 */
  slotStartMs: readonly number[];
  /** 最後のマスの動きが終わる時刻の見込み。 */
  endMs: number;
};

/**
 * 押す回が `slotCount` 回のときの時刻を決める。少ないうちは一定の間隔で押し、多ければ全体が上限に収まるよう間隔を詰める。
 */
export function planZukanStamps(slotCount: number): ZukanStampPlan {
  const lastStartMaxMs = REVEAL_DURATION_MAX_MS - STAMP_TAIL_MS;
  const intervalMs =
    slotCount > 1
      ? Math.min(
          STAMP_INTERVAL_MAX_MS,
          (lastStartMaxMs - PREVIOUS_STATE_HOLD_MS) / (slotCount - 1),
        )
      : 0;
  const slotStartMs = Array.from({ length: slotCount }, (_, slot) =>
    Math.round(PREVIOUS_STATE_HOLD_MS + slot * intervalMs),
  );
  const lastStartMs = slotStartMs.at(-1) ?? 0;
  return {
    slotStartMs,
    endMs: slotCount === 0 ? 0 : lastStartMs + STAMP_TAIL_MS,
  };
}

/**
 * 押すマスの中の、押す姿・浮いた影・輪の要素。マスは `data-stamp-part` にそれぞれ `face`・`shadow`・`ring` を付けて描く。
 */
export type ZukanStampParts = {
  face: Element;
  shadow: Element;
  ring: Element;
};

export function findZukanStampParts(square: Element): ZukanStampParts | null {
  const face = square.querySelector('[data-stamp-part="face"]');
  const shadow = square.querySelector('[data-stamp-part="shadow"]');
  const ring = square.querySelector('[data-stamp-part="ring"]');
  return face && shadow && ring ? { face, shadow, ring } : null;
}

type ZukanStampCallbacks = {
  /** 押す姿がマスに着いたとき。マスを今の姿にし、数を数え上げる時機。 */
  onLanded: () => void;
  /** 着いたあとの戻りと輪が終わったとき。 */
  onFinished: () => void;
};

function canAnimate({ face, shadow, ring }: ZukanStampParts): boolean {
  return [face, shadow, ring].every(
    (element) => typeof element.animate === "function",
  );
}

/**
 * 変化したマスを押す。押す姿を大きく浮いた姿から縮めてマスに着かせ、着いたら少し行き過ぎた姿から戻しながら輪を広げて消す。
 * 着いたことと終わったことは、時刻の見込みではなく Animation の終わりで知らせる。
 * 動きを減らす設定と、動かせない環境では動かさず、すぐに着いて終わったものとする。戻り値は動きを取り消す関数。
 */
export function playZukanStamp(
  parts: ZukanStampParts,
  { onLanded, onFinished }: ZukanStampCallbacks,
): () => void {
  const isAnimatable = canAnimate(parts);
  let dropAnimations: Animation[] = [];
  let cancelSettle = function cancelNothing() {};

  function animateDrop(): Animation[] {
    dropAnimations = isAnimatable
      ? [
          parts.face.animate(stampDropKeyframes, {
            duration: STAMP_DROP_DURATION_MS,
            fill: "forwards",
          }),
          parts.shadow.animate(stampShadowKeyframes, {
            duration: STAMP_DROP_DURATION_MS,
          }),
        ]
      : [];
    return dropAnimations;
  }
  function animateSettle(): Animation[] {
    return isAnimatable
      ? [
          parts.face.animate(stampSettleKeyframes, {
            duration: STAMP_SETTLE_DURATION_MS,
            easing: MOTION_EASING.celebrate,
          }),
          parts.ring.animate(stampRingKeyframes, {
            duration: STAMP_RING_DURATION_MS,
            easing: MOTION_EASING.celebrate,
          }),
        ]
      : [];
  }
  function land() {
    onLanded();
    cancelSettle = playAnimations({
      animate: animateSettle,
      completion: { type: "after-animations", holdMs: 0 },
      reducedMotionHoldMs: 0,
      unanimatedHoldMs: 0,
      onFinished,
    });
    // 着いた姿を保っていた動きは、戻りの動きが引き継いだので外す。
    for (const animation of dropAnimations) {
      animation.cancel();
    }
  }

  const cancelDrop = playAnimations({
    animate: animateDrop,
    completion: { type: "after-animations", holdMs: 0 },
    reducedMotionHoldMs: 0,
    unanimatedHoldMs: 0,
    onFinished: land,
  });
  return function cancel() {
    cancelDrop();
    cancelSettle();
  };
}

/** 台紙のスクロール領域で見えている範囲や、マスの範囲の、画面の上下の位置。 */
export type ZukanVerticalSpan = { top: number; bottom: number };

export function joinZukanVerticalSpans(
  spans: readonly ZukanVerticalSpan[],
): ZukanVerticalSpan | null {
  if (spans.length === 0) {
    return null;
  }
  return {
    top: Math.min(...spans.map(({ top }) => top)),
    bottom: Math.max(...spans.map(({ bottom }) => bottom)),
  };
}

/** 見えている範囲 `view` の中に、端から `margin` 空けて `target` が入っているか。 */
export function isZukanSpanInView(
  view: ZukanVerticalSpan,
  target: ZukanVerticalSpan,
  margin = 0,
): boolean {
  return (
    target.top >= view.top + margin && target.bottom <= view.bottom - margin
  );
}

/** 押すマスの範囲 `target` が、浮いた姿と輪が端で切れない余白を空けて見えているか。 */
export function isZukanStampTargetVisible(
  view: ZukanVerticalSpan,
  target: ZukanVerticalSpan,
): boolean {
  return isZukanSpanInView(view, target, REVEAL_SCROLL_MARGIN_PX);
}

/**
 * 押すマスの範囲 `target` が、端から余白を空けて見えるようにする台紙のスクロール位置。既に見えていれば `null`。
 * 範囲が見える範囲に入るなら、動かす量が最も小さい位置にする。入らなければ、範囲の先頭を見える範囲の上端に寄せ、後に続くマスをなるべく多く見せる。
 */
export function findZukanRevealScrollTop(
  view: ZukanVerticalSpan,
  scrollTop: number,
  target: ZukanVerticalSpan,
): number | null {
  const margin = REVEAL_SCROLL_MARGIN_PX;
  if (isZukanStampTargetVisible(view, target)) {
    return null;
  }
  const fits =
    target.bottom - target.top + margin * 2 <= view.bottom - view.top;
  const offset =
    fits && target.bottom > view.bottom - margin
      ? target.bottom - (view.bottom - margin)
      : target.top - (view.top + margin);
  return Math.max(0, scrollTop + offset);
}

/**
 * 押す回ごとに、次に押すマスの範囲 `next` を見せるための台紙のスクロール位置。`next` が見えていれば動かさず `null`。
 * 見えていなければ、まだ押していないマスの範囲 `rest` を `findZukanRevealScrollTop` と同じく見せる。
 */
export function findZukanFollowScrollTop(
  view: ZukanVerticalSpan,
  scrollTop: number,
  next: ZukanVerticalSpan,
  rest: ZukanVerticalSpan,
): number | null {
  return isZukanStampTargetVisible(view, next)
    ? null
    : findZukanRevealScrollTop(view, scrollTop, rest);
}

/** まだ見せていない変化 `pendingChange` があれば前回の姿、無ければ今の姿。 */
export function getZukanShownProblemStatus(
  problem: ZukanProblem,
  pendingChange: ZukanProblemChange | undefined,
): ZukanProblemStatus {
  return pendingChange === undefined
    ? getZukanProblemStatus(problem)
    : pendingChange.previousStatus;
}

/** 変化のうち、新しく解いた問題の数。 */
export function countZukanNewlySolved(
  changes: ReadonlyMap<ProblemId, ZukanProblemChange> | undefined,
): number {
  let count = 0;
  for (const { kind } of changes?.values() ?? []) {
    if (kind === "newly-solved") {
      count += 1;
    }
  }
  return count;
}
