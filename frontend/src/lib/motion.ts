/**
 * `frontend/styles/globals.css` の `@theme` にある動きのトークンを、Web Animations API など TS から使う値として写す。
 * 値の正は `@theme` で、ここは `@theme` と同じ値を保つ。Tailwind のクラスでは `duration-(--duration-*)` と `ease-*` を使う。
 */
export const MOTION_DURATION_MS = {
  fast: 100,
  normal: 150,
  slow: 200,
} as const;

/** `@theme` の `--ease-*` と同じ値。 */
export const MOTION_EASING = {
  standard: "cubic-bezier(0.4, 0, 0.2, 1)",
  enter: "cubic-bezier(0, 0, 0.2, 1)",
  exit: "cubic-bezier(0.4, 0, 1, 1)",
  celebrate: "cubic-bezier(0.2, 0.8, 0.2, 1)",
} as const;

/** 操作が通らなかったことを返す揺れの長さ。 */
const REJECTION_SHAKE_MS = 220;

export function prefersReducedMotion(): boolean {
  return (
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
  );
}

/**
 * 渡した Animation がすべて終わったら、一度だけ `onFinished` を呼ぶ。
 * 戻り値は待つのをやめる関数で、やめた後や Animation が取り消された場合は呼ばない。
 */
export function waitForAnimations(
  animations: readonly Animation[],
  onFinished: () => void,
): () => void {
  let waiting = true;
  Promise.all(animations.map((animation) => animation.finished)).then(
    function notifyFinished() {
      if (waiting) {
        waiting = false;
        onFinished();
      }
    },
    function ignoreCancelled() {
      waiting = false;
    },
  );

  return function stopWaiting() {
    waiting = false;
  };
}

type PlayAnimationsOptions = {
  /** 演出を始め、終わりを待つ Animation を返す。動かせない環境では空の配列を返す。 */
  animate: () => readonly Animation[];
  /** 演出を終えてから `onFinished` を呼ぶまで、止まった姿を見せておく時間。 */
  holdMs: number;
  onFinished: () => void;
};

/**
 * 演出を再生し、すべての Animation が終わって `holdMs` 経ってから一度だけ `onFinished` を呼ぶ。
 * 動きを減らす設定と、動かせる要素が無い環境では、演出せずにすぐ呼ぶ。
 * 戻り値は演出を取り消す関数で、取り消した後は呼ばない。
 */
export function playAnimations({
  animate,
  holdMs,
  onFinished,
}: PlayAnimationsOptions): () => void {
  if (prefersReducedMotion()) {
    onFinished();
    return function cancelNothing() {};
  }

  const animations = animate();
  if (animations.length === 0) {
    onFinished();
    return function cancelNothing() {};
  }

  let holdTimer: number | undefined;
  const stopWaiting = waitForAnimations(animations, function hold() {
    holdTimer = window.setTimeout(onFinished, holdMs);
  });

  return function cancel() {
    stopWaiting();
    window.clearTimeout(holdTimer);
    for (const animation of animations) {
      animation.cancel();
    }
  };
}

/**
 * 操作が通らなかったことを、対象の小さな揺れで返す。揺れ方は `keyframes` でゲームが決める。
 * 動きを減らす設定と、動かせない環境では揺らさない。
 */
export function playRejectionShake(
  element: Element | null | undefined,
  keyframes: Keyframe[],
): void {
  if (typeof element?.animate !== "function" || prefersReducedMotion()) {
    return;
  }

  element.animate(keyframes, {
    duration: REJECTION_SHAKE_MS,
    easing: MOTION_EASING.enter,
  });
}
