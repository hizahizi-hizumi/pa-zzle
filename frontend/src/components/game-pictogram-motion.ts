/**
 * 動きを再生し始めてから、静止した姿のまま見せる時間。
 * 選んだ瞬間は濃淡2色の姿から色だけが変わり、この時間の後に動きの周の頭へ切り替わる。
 */
const SHOWCASE_ENTRY_REST_MS = 600;

const TIMING_KEYS = new Set([
  "offset",
  "computedOffset",
  "easing",
  "composite",
]);

function keyframeValues(keyframe: ComputedKeyframe): string {
  return JSON.stringify(
    Object.entries(keyframe)
      .filter(([key]) => !TIMING_KEYS.has(key))
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

function isKeyframeEffect(
  effect: AnimationEffect | null,
): effect is KeyframeEffect {
  return effect !== null && "getKeyframes" in effect;
}

/** 周のうち、最後の姿（静止した姿）のまま変わらない区間が始まる割合。 */
function restStartFraction(effect: KeyframeEffect): number {
  const keyframes = effect.getKeyframes();
  const last = keyframes.at(-1);
  if (!last) return 1;

  const lastValues = keyframeValues(last);
  let start = last.computedOffset;
  for (const keyframe of keyframes.toReversed()) {
    if (keyframeValues(keyframe) !== lastValues) break;
    start = keyframe.computedOffset;
  }
  return start;
}

/**
 * 包む要素の中で動く色付きピクトグラムを、周の終わりの静止した姿から始める。
 * 切り替えループ（cut）は周の終わりが静止した姿なので、選んだ瞬間に一覧と同じ姿のまま動きへ入れる。
 * 静止した姿の区間が `SHOWCASE_ENTRY_REST_MS` より長ければ、その終わりの部分だけを見せる。
 */
export function startShowcaseAtRest(container: Element): void {
  if (typeof container.getAnimations !== "function") return;

  const animations = container.getAnimations({ subtree: true });
  const timed = animations.flatMap((animation) => {
    const effect = animation.effect;
    if (!isKeyframeEffect(effect)) return [];
    const { delay = 0, duration } = effect.getTiming();
    if (typeof duration !== "number" || duration <= 0) return [];
    return [
      {
        animation,
        delay,
        duration,
        restStart: restStartFraction(effect) * duration,
      },
    ];
  });
  if (timed.length === 0) return;

  const cycleEnd = Math.max(...timed.map(({ duration }) => duration));
  const restStart = Math.max(...timed.map(({ restStart }) => restStart));
  const entry = Math.max(restStart, cycleEnd - SHOWCASE_ENTRY_REST_MS);
  for (const { animation, delay } of timed) {
    animation.currentTime = delay + entry;
  }
}

export const _private = { SHOWCASE_ENTRY_REST_MS };
