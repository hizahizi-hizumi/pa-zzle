import { useLayoutEffect, useRef, useState } from "react";

import { GamePictogram } from "@/components/GamePictogram";
import {
  MOTION_EASING,
  prefersReducedMotion,
  waitForAnimations,
} from "@/lib/motion";

/** 選んだ瞬間に色が入りきるまでの時間。ヒーローは大きく、色の戻り方が見えるよう長くとる。 */
const COLOR_IN_DURATION_MS = { list: 240, hero: 640 } as const;

/** 最初の 3 割で濃淡2色の姿から灰色にした色付きの姿へ替え、残りで灰色を抜いて色を戻す。 */
const COLOR_LAYER_KEYFRAMES: Keyframe[] = [
  { opacity: 0, filter: "grayscale(1)" },
  { opacity: 1, filter: "grayscale(1)", offset: 0.3 },
  { opacity: 1, filter: "grayscale(0)" },
];
const MONO_LAYER_KEYFRAMES: Keyframe[] = [
  { opacity: 1 },
  { opacity: 0, offset: 0.3 },
  { opacity: 0 },
];

type SelectedGamePictogramProps = {
  pictogramSvg: string;
  /** 選んでいるときに見せる色と動きのあるピクトグラム。無ければ `pictogramSvg` を見せる。 */
  pictogramShowcaseSvg?: string;
  size: keyof typeof COLOR_IN_DURATION_MS;
  motion?: "rest" | "play";
  /**
   * 遊ぶ人が選んだ直後として描くか。描き始めたときの値だけを使い、`true` なら濃淡2色の姿から色を入れる。
   * 色が入りきるまでは動かさず、入りきってから `motion` に従う。
   */
  colorsIn: boolean;
};

function canColorIn(): boolean {
  return (
    typeof HTMLElement.prototype.animate === "function" &&
    !prefersReducedMotion()
  );
}

/** ホームで選んでいるゲームのピクトグラム。色と動きのある姿を持てばそれを見せ、選んだ直後は色を入れて見せる。 */
export function SelectedGamePictogram({
  pictogramSvg,
  pictogramShowcaseSvg,
  size,
  motion = "rest",
  colorsIn,
}: SelectedGamePictogramProps) {
  const [isColoring, setIsColoring] = useState(
    () => colorsIn && pictogramShowcaseSvg !== undefined && canColorIn(),
  );
  const startsColoringRef = useRef(isColoring);
  const colorLayerRef = useRef<HTMLSpanElement>(null);
  const monoLayerRef = useRef<HTMLSpanElement>(null);
  const durationMs = COLOR_IN_DURATION_MS[size];

  // 色付きの姿が見える前に透明にしておくため、描画の前に動きを始める。
  useLayoutEffect(() => {
    const colorLayer = colorLayerRef.current;
    const monoLayer = monoLayerRef.current;
    if (!startsColoringRef.current || !colorLayer || !monoLayer) return;

    const timing: KeyframeAnimationOptions = {
      duration: durationMs,
      easing: MOTION_EASING.standard,
      fill: "both",
    };
    const animations = [
      colorLayer.animate(COLOR_LAYER_KEYFRAMES, timing),
      monoLayer.animate(MONO_LAYER_KEYFRAMES, timing),
    ];
    const stopWaiting = waitForAnimations(animations, () => {
      startsColoringRef.current = false;
      setIsColoring(false);
    });
    return () => {
      stopWaiting();
      for (const animation of animations) animation.cancel();
    };
  }, [durationMs]);

  if (!pictogramShowcaseSvg) {
    return <GamePictogram svg={pictogramSvg} />;
  }

  return (
    <span className="relative block size-full">
      <span ref={colorLayerRef} className="block size-full">
        <GamePictogram
          svg={pictogramShowcaseSvg}
          motion={isColoring ? "rest" : motion}
        />
      </span>
      {isColoring && (
        <span ref={monoLayerRef} className="absolute inset-0">
          <GamePictogram svg={pictogramSvg} />
        </span>
      )}
    </span>
  );
}
