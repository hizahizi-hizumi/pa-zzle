const boardPaintProperties = new Set([
  "offset",
  "easing",
  "composite",
  "opacity",
  "filter",
  "strokeDashoffset",
]);

function animateBoardDescendant(
  anchor: Element | null | undefined,
  visual: Element | null | undefined,
  keyframes: Keyframe[],
  timing: KeyframeAnimationOptions,
): Animation | null {
  if (!anchor || !visual) return null;
  if (anchor === visual || !anchor.contains(visual)) {
    throw new Error(
      "Board animation target must be a descendant of its layout anchor",
    );
  }
  if (typeof visual.animate !== "function") return null;
  return visual.animate(keyframes, timing);
}

/** 盤面上の内容を動かさず、光や色だけを変える。 */
export function animateBoardPaint(
  anchor: Element | null | undefined,
  visual: Element | null | undefined,
  keyframes: Keyframe[],
  timing: KeyframeAnimationOptions,
): Animation | null {
  for (const frame of keyframes) {
    for (const property of Object.keys(frame)) {
      if (!boardPaintProperties.has(property)) {
        throw new Error(
          `Board paint animation cannot change geometry: ${property}`,
        );
      }
    }
  }
  return animateBoardDescendant(anchor, visual, keyframes, timing);
}

/** 実際の着手や、形を変えると明示した演出だけで使う。 */
export function animateBoardGeometry(
  anchor: Element | null | undefined,
  visual: Element | null | undefined,
  keyframes: Keyframe[],
  timing: KeyframeAnimationOptions,
): Animation | null {
  return animateBoardDescendant(anchor, visual, keyframes, timing);
}
