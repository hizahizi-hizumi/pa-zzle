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

/**
 * 演出の完了の決め方。
 * - `after-animations`: すべての Animation が終わってから `holdMs` 経って完了する。
 * - `after-duration`: 演出を始めてから `durationMs` 経って完了する。Animation の終わりは待たない。
 */
export type AnimationCompletion =
  | { type: "after-animations"; holdMs: number }
  | { type: "after-duration"; durationMs: number };

type PlayAnimationsOptions = {
  /** 演出を始め、終わりを待つ Animation を返す。動かせない環境では空の配列を返す。 */
  animate: () => readonly Animation[];
  /** 演出したときの完了の決め方。 */
  completion: AnimationCompletion;
  /** 動きを減らす設定で、演出せずに止まった姿を見せてから完了するまでの時間。`0` ならすぐ完了する。 */
  reducedMotionHoldMs: number;
  /** 動かせる要素が無い環境で、完了するまでの時間。`0` ならすぐ完了する。 */
  unanimatedHoldMs: number;
  onFinished: () => void;
};

/** `delayMs` 経ってから一度だけ `onFinished` を呼ぶ。`0` ならすぐ呼ぶ。戻り値は呼ぶのをやめる関数。 */
function finishAfter(delayMs: number, onFinished: () => void): () => void {
  if (delayMs <= 0) {
    onFinished();
    return function cancelNothing() {};
  }

  const timer = window.setTimeout(onFinished, delayMs);
  return function cancelTimer() {
    window.clearTimeout(timer);
  };
}

/**
 * 演出を再生し、`completion` の決め方で完了したら一度だけ `onFinished` を呼ぶ。
 * 動きを減らす設定では演出せず `reducedMotionHoldMs`、動かせる要素が無い環境では `unanimatedHoldMs` 経ってから呼ぶ。
 * 完了までの時間はゲームが渡し、この関数は値を決めない。
 * 戻り値は演出を取り消す関数で、取り消した後は呼ばない。
 */
export function playAnimations({
  animate,
  completion,
  reducedMotionHoldMs,
  unanimatedHoldMs,
  onFinished,
}: PlayAnimationsOptions): () => void {
  if (prefersReducedMotion()) {
    return finishAfter(reducedMotionHoldMs, onFinished);
  }

  const animations = animate();
  if (animations.length === 0) {
    return finishAfter(unanimatedHoldMs, onFinished);
  }

  let cancelFinish: () => void = function cancelNothing() {};
  let stopWaiting: () => void = function stopNothing() {};
  if (completion.type === "after-duration") {
    cancelFinish = finishAfter(completion.durationMs, onFinished);
  } else {
    stopWaiting = waitForAnimations(animations, function hold() {
      cancelFinish = finishAfter(completion.holdMs, onFinished);
    });
  }

  return function cancel() {
    stopWaiting();
    cancelFinish();
    for (const animation of animations) {
      animation.cancel();
    }
  };
}

/** 操作が通らなかったことを返す揺れの長さと緩急。 */
export type RejectionShakeTiming = {
  durationMs: number;
  easing: string;
};

/**
 * 操作が通らなかったことを、対象の小さな揺れで返す。揺れ方 `keyframes` と長さ・緩急 `timing` はゲームが渡す。
 * 動きを減らす設定と、動かせない環境では揺らさない。
 */
export function playRejectionShake(
  element: Element | null | undefined,
  keyframes: Keyframe[],
  { durationMs, easing }: RejectionShakeTiming,
): void {
  if (typeof element?.animate !== "function" || prefersReducedMotion()) {
    return;
  }

  element.animate(keyframes, { duration: durationMs, easing });
}
