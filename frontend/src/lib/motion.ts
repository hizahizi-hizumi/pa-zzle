/**
 * `frontend/styles/globals.css` の `@theme` にある動きのトークンを、Web Animations API など TS から使う値として写す。
 * 値の正は `@theme` で、ここは `@theme` と同じ値を保つ。
 */
export const MOTION_DURATION_MS = {
  fast: 100,
  normal: 150,
  slow: 200,
} as const;

export const MOTION_EASING = {
  standard: "cubic-bezier(0.4, 0, 0.2, 1)",
  enter: "cubic-bezier(0, 0, 0.2, 1)",
  exit: "cubic-bezier(0.4, 0, 1, 1)",
  celebrate: "cubic-bezier(0.2, 0.8, 0.2, 1)",
} as const;

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function prefersReducedMotion(): boolean {
  return window.matchMedia?.(REDUCED_MOTION_QUERY).matches ?? false;
}

export function subscribePrefersReducedMotion(
  onChange: () => void,
): () => void {
  const query = window.matchMedia?.(REDUCED_MOTION_QUERY);
  if (typeof query?.addEventListener !== "function") {
    return function unsubscribeNothing() {};
  }
  query.addEventListener("change", onChange);
  return function unsubscribe() {
    query.removeEventListener("change", onChange);
  };
}

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

export type AnimationCompletion =
  | { type: "after-animations"; holdMs: number }
  | { type: "after-duration"; durationMs: number };

type PlayAnimationsOptions = {
  /** 動かせない環境では空の配列を返す。 */
  animate: () => readonly Animation[];
  completion: AnimationCompletion;
  reducedMotionHoldMs: number;
  unanimatedHoldMs: number;
  onFinished: () => void;
};

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

export type RejectionShakeTiming = {
  durationMs: number;
  easing: string;
};

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
