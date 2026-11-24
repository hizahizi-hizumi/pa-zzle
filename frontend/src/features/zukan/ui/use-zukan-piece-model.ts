import { type RefObject, useEffect, useSyncExternalStore } from "react";
import type { ZukanPieceScene } from "@/features/zukan/ui/zukan-piece-scene";
import { registerZukanResultPieceFrontAligner } from "@/features/zukan/ui/zukan-result-piece-pose";
import {
  prefersReducedMotion,
  subscribePrefersReducedMotion,
} from "@/lib/motion";
import { afterScreenTransition } from "@/lib/screen-transition";

/** 1周にかける長さ（ms）。静かに、ゆっくり回す。 */
const TURN_PERIOD_MS = 14_000;
/** 回り始めてから決まった速さになるまでの長さ（ms）。正面の平面の姿から、止まった所から回り出す。 */
const TURN_RAMP_MS = 1_800;
/** 浮き沈みの1往復の長さ（ms）と、浮く高さ（px）。 */
const BOB_PERIOD_MS = 4_600;
const BOB_HEIGHT_PX = 3;
/** 正面へ戻す動きの長さ（ms）。戻す角度が半周のときに `ALIGN_MAX_MS`。 */
const ALIGN_MIN_MS = 160;
const ALIGN_MAX_MS = 440;
/** 画素の細かさの上限。 */
const MAX_PIXEL_RATIO = 2;

type ZukanPieceModelRefs = {
  /** 浮き沈みさせる箱。平面のピースと立体の描画を重ねて入れる。 */
  bodyRef: RefObject<HTMLElement | null>;
  /** 平面のピース。立体を描けるまで・描けないときに見せ、立体の色をここから読む。 */
  flatRef: RefObject<SVGSVGElement | null>;
  /** 落ち影。浮いた高さと、回って見える幅に合わせて変える。 */
  shadowRef: RefObject<HTMLElement | null>;
};

/** WebGL を持たないブラウザでは、three.js を読み込まずに平面のピースのまま見せる。 */
function supportsWebGL(): boolean {
  return (
    typeof WebGL2RenderingContext !== "undefined" ||
    typeof WebGLRenderingContext !== "undefined"
  );
}

function easeInOut(progress: number): number {
  return progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
}

/** ピースに掛かっている、終わりのある動き（結果の演出や画面の行き来）が終わるのを待つ。 */
async function animationsSettled(element: Element): Promise<void> {
  const animations =
    typeof document.getAnimations === "function"
      ? document.getAnimations().filter((animation) => {
          const effect = animation.effect;
          const target =
            effect instanceof KeyframeEffect ? effect.target : null;
          const iterations = effect?.getComputedTiming().iterations ?? 1;
          return (
            target?.contains(element) === true && Number.isFinite(iterations)
          );
        })
      : [];
  await Promise.allSettled(animations.map((animation) => animation.finished));
}

/**
 * 結果のピースを、立体で静かに回しながら浮き沈みさせる。
 * three.js はここで初めて読み込む。読み込むまで・WebGL が使えないとき・動きを減らす設定では、平面のピースのまま止めておく。
 * 立体は、正面を向いた平面のピースと重なる姿から、止まった所から回り出す。
 */
export function useZukanPieceModel(
  path: string,
  { bodyRef, flatRef, shadowRef }: ZukanPieceModelRefs,
): void {
  const reducedMotion = useSyncExternalStore(
    subscribePrefersReducedMotion,
    prefersReducedMotion,
  );

  useEffect(() => {
    const body = bodyRef.current;
    const flat = flatRef.current;
    if (body === null || flat === null || reducedMotion || !supportsWebGL()) {
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.dataset.zukanPieceModel = "";
    Object.assign(canvas.style, {
      position: "absolute",
      inset: "-50%",
      width: "200%",
      height: "200%",
      visibility: "hidden",
      pointerEvents: "none",
    });

    let disposed = false;
    let scene: ZukanPieceScene | null = null;
    let frame = 0;
    let turn = 0;
    let bobPhase = 0;
    let runningMs = 0;
    let lastTime: number | null = null;
    let isShown = false;
    let isOnScreen = true;
    let aligning: Promise<void> | null = null;
    let finishAligning: (() => void) | null = null;
    let unregisterAligner: (() => void) | null = null;
    let cancelAfterTransition: (() => void) | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let intersectionObserver: IntersectionObserver | null = null;

    function applyPose(bob: number) {
      if (body === null) return;
      const lift = (1 - Math.cos(bob)) / 2;
      body.style.translate = `0 ${-lift * BOB_HEIGHT_PX}px`;
      const shadow = shadowRef.current;
      if (shadow !== null) {
        // 回って薄く見える間は影も細く、浮いた分だけ影を小さく淡くする。
        const width = 0.4 + 0.6 * Math.abs(Math.cos(turn));
        const scale = 1 - 0.1 * lift;
        shadow.style.transform = `scale(${width * scale}, ${scale})`;
        shadow.style.opacity = String(1 - 0.3 * lift);
      }
      scene?.render(turn);
    }

    function resize() {
      if (scene === null || body === null) return;
      const { width } = body.getBoundingClientRect();
      scene.resize(
        width * 2,
        Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO),
      );
      scene.render(turn);
    }

    function tick(now: number) {
      frame = 0;
      const elapsed = lastTime === null ? 0 : now - lastTime;
      lastTime = now;
      runningMs += elapsed;
      const ramp = easeInOut(Math.min(1, runningMs / TURN_RAMP_MS));
      turn += ((Math.PI * 2) / TURN_PERIOD_MS) * elapsed * ramp;
      bobPhase += ((Math.PI * 2) / BOB_PERIOD_MS) * elapsed * ramp;
      applyPose(bobPhase);
      schedule();
    }

    function schedule() {
      if (!isShown || frame !== 0 || !canAnimate()) return;
      frame = requestAnimationFrame(tick);
    }

    function pause() {
      if (frame !== 0) cancelAnimationFrame(frame);
      frame = 0;
      lastTime = null;
    }

    function canAnimate(): boolean {
      return isOnScreen && document.visibilityState !== "hidden";
    }

    // 隠れた・画面外の間は次の描画が来ないので、揃えている途中なら待たずに揃え終える。
    function halt() {
      if (aligning !== null) showFront();
      else pause();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") halt();
      else schedule();
    }

    function showFront() {
      turn = 0;
      bobPhase = 0;
      showFlat();
    }

    function showFlat() {
      pause();
      isShown = false;
      unregisterAligner?.();
      unregisterAligner = null;
      if (flat !== null) flat.style.visibility = "";
      canvas.style.visibility = "hidden";
      if (body !== null) body.style.translate = "";
      const shadow = shadowRef.current;
      if (shadow !== null) {
        shadow.style.transform = "";
        shadow.style.opacity = "";
      }
      const finish = finishAligning;
      aligning = null;
      finishAligning = null;
      finish?.();
    }

    function alignToFront(): Promise<void> {
      if (aligning !== null) return aligning;
      if (!canAnimate()) {
        showFront();
        return Promise.resolve();
      }
      pause();
      const fromTurn = turn;
      const toTurn = Math.round(turn / (Math.PI * 2)) * Math.PI * 2;
      const fromBob = bobPhase;
      const toBob = Math.round(bobPhase / (Math.PI * 2)) * Math.PI * 2;
      const duration =
        ALIGN_MIN_MS +
        (ALIGN_MAX_MS - ALIGN_MIN_MS) *
          Math.min(1, Math.abs(toTurn - fromTurn) / Math.PI);
      aligning = new Promise((resolve) => {
        finishAligning = resolve;
        let start: number | null = null;
        function step(now: number) {
          start ??= now;
          const progress = Math.min(1, (now - start) / duration);
          const eased = easeInOut(progress);
          turn = fromTurn + (toTurn - fromTurn) * eased;
          bobPhase = fromBob + (toBob - fromBob) * eased;
          applyPose(bobPhase);
          if (progress < 1 && !disposed) {
            frame = requestAnimationFrame(step);
            return;
          }
          frame = 0;
          showFront();
        }
        frame = requestAnimationFrame(step);
      });
      return aligning;
    }

    function showModel() {
      if (disposed || scene === null || flat === null) return;
      applyPose(0);
      canvas.style.visibility = "visible";
      flat.style.visibility = "hidden";
      isShown = true;
      unregisterAligner = registerZukanResultPieceFrontAligner(alignToFront);
      schedule();
    }

    function teardown() {
      disposed = true;
      showFlat();
      cancelAfterTransition?.();
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      scene?.dispose();
      scene = null;
      canvas.remove();
    }

    void import("@/features/zukan/ui/zukan-piece-scene").then(
      ({ createZukanPieceScene }) => {
        if (disposed) return;
        scene = createZukanPieceScene(canvas, {
          path,
          faceColor: getComputedStyle(flat).color,
        });
        if (scene === null) return;
        body.append(canvas);
        resize();
        if (typeof ResizeObserver !== "undefined") {
          resizeObserver = new ResizeObserver(resize);
          resizeObserver.observe(body);
        }
        if (typeof IntersectionObserver !== "undefined") {
          intersectionObserver = new IntersectionObserver(([entry]) => {
            isOnScreen = entry?.isIntersecting ?? true;
            if (isOnScreen) schedule();
            else halt();
          });
          intersectionObserver.observe(body);
        }
        document.addEventListener("visibilitychange", handleVisibilityChange);
        cancelAfterTransition = afterScreenTransition(() => {
          void animationsSettled(flat).then(showModel);
        });
      },
      // 読み込めなければ、平面のピースのまま見せる。
      () => {},
    );

    return teardown;
  }, [path, reducedMotion, bodyRef, flatRef, shadowRef]);
}
