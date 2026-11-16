import type { HakoiriMusumeExitSide } from "@/games/hakoiri-musume/puzzle/board";
import {
  DAUGHTER_EXIT_MS,
  DAUGHTER_EXIT_SETTLE_MS,
  getDaughterExitStartMs,
  getDaughterLandingMs,
  REDUCED_MOTION_DAUGHTER_EXIT_MS,
} from "@/games/hakoiri-musume/ui/board/daughter-exit-timing";
import {
  MOTION_EASING,
  playAnimations,
  prefersReducedMotion,
} from "@/lib/motion";

/** 目標の駒が抜けた後の空いた箱を、結果へ進める前に見せておく時間。 */
const DAUGHTER_EXIT_HOLD_MS = 200;
/** 動きを減らす設定で、目標の駒を箱から消した後、空いた箱を見せておく時間。 */
const REDUCED_MOTION_EMPTY_BOX_HOLD_MS = 550;

/** 抜け切った目標の駒が落ちたごとんに合わせて、箱が沈んで戻る深さと時間。 */
const BOX_SINK_PX = 3.5;
const BOX_SINK_MS = 120;

/** 抜け切った目標の駒が落ちたときに、出口の縁へ差す光の長さ。 */
const EXIT_LIGHT_MS = 420;

/**
 * 止まった所から動き出し、終わりに向けて少し速めて、駒の後ろの端が箱の外形の端を越えるまで（`travelPercent`）出口の外へ動かして
 * 終える。箱の外へ出た分は、箱の外形で切り取られて見えなくなる。動きの大半が最後に寄ると抜けていく姿が見えないので、加速は弱くし、
 * 始めから目に見える速さで動かす。
 */
function getDaughterExitKeyframes(
  side: HakoiriMusumeExitSide,
  travelPercent: number,
): Keyframe[] {
  const axis = side === "top" || side === "bottom" ? "Y" : "X";
  const sign = side === "top" || side === "left" ? "-" : "";
  return [
    { transform: `translate${axis}(0)` },
    { transform: `translate${axis}(${sign}${travelPercent}%)` },
  ];
}
const DAUGHTER_EXIT_EASING = "cubic-bezier(0.3, 0.15, 0.7, 0.75)";

const boxSinkKeyframes: Keyframe[] = [
  { transform: "translateY(0)" },
  { transform: `translateY(${BOX_SINK_PX}px)`, offset: 0.3 },
  { transform: "translateY(0)" },
];

/** 出口の縁の光。一度だけ差して、出口の外へ、出口の幅の向きに広がりながら消える。 */
function getExitLightKeyframes(side: HakoiriMusumeExitSide): Keyframe[] {
  const scale = side === "top" || side === "bottom" ? "scaleX" : "scaleY";
  return [
    { opacity: 0, transform: `${scale}(0.7)` },
    { opacity: 1, transform: `${scale}(1)`, offset: 0.2 },
    { opacity: 0, transform: `${scale}(1.15)` },
  ];
}

/**
 * クリアした瞬間に、目標の駒を見せていた姿（CSS の値）。つかんでいた駒か、弾いて行き先へ動かした駒のとき。
 * - `lean`: 行き先のマスからのずれ（`translate`）。指へ寄せて見せていたずれか、弾いて動かす前に見せていた位置。
 * - `scale`・`boxShadow`: 持ち上げて見せていた大きさと影。持ち上げていなければ `RESTING_DAUGHTER_LOOK` の値。
 */
export type DaughterHeldLook = {
  lean: string;
  scale: string;
  boxShadow: string;
};

/** 持ち上げを下ろした目標の駒の、マスに収まった姿。影は、持ち上げた影のずれ・ぼかし・濃さを 0 へ縮めた形。 */
export const RESTING_DAUGHTER_LOOK = {
  translate: "0px 0px",
  scale: "1",
  boxShadow: "0 0 0 -3px rgb(30 18 5 / 0)",
};

/**
 * 抜けていく1つの目標の駒。
 * - `element`: 目標の駒。
 * - `exitLight`: その駒の出口の縁に差す光。駒が抜け切ったときに一度だけ見せる。
 * - `side`: 出口のある辺。駒はこの向きへ抜ける。
 * - `travelPercent`: 抜け切るまでに動かす距離（駒の見た目の、抜ける向きの長さに対する %）。
 * - `heldLook`: クリアした瞬間に見せていた姿。つかんでいた駒か、弾いて行き先へ動かした駒のときだけで、ほかは `null`。
 */
export type DaughterExit = {
  element: HTMLElement | null;
  exitLight: HTMLElement | null;
  side: HakoiriMusumeExitSide;
  travelPercent: number;
  heldLook: DaughterHeldLook | null;
};

/**
 * クリアした目標の駒を、指へ寄せていたずれを収めて持ち上げを下ろし、行き先で少し止めてから、`exits` の順に1つずつ出口の外へ出す。
 * 1つ抜け切るたびに `box` を沈め、その出口の縁に光を差す。最後の駒が抜けた後に `onFinished` を呼ぶ。戻り値は演出を取り消す関数。
 * 演出の時刻は呼んだ時を始まりとして刻み、同じ時に `getDaughterExitStartMs`・`getDaughterLandingMs` で予約した音とずらさない。
 * 動きを減らす設定では、行き先に着いた目標の駒を動かさずに見せてから、箱から消して、空いた箱を見せてから呼ぶ。
 */
export function playDaughterExit(
  box: HTMLElement | null,
  exits: readonly DaughterExit[],
  onFinished: () => void,
): () => void {
  if (prefersReducedMotion()) {
    return hideDaughtersWithoutMotion(
      exits.map((exit) => exit.element),
      onFinished,
    );
  }
  const exitAnimations: Animation[] = [];
  return playAnimations({
    animate() {
      const animations: Animation[] = [];
      exits.forEach((exit, order) => {
        const { element, exitLight, side, travelPercent, heldLook } = exit;
        if (!element?.animate) {
          return;
        }
        const exitAnimation = element.animate(
          getDaughterExitKeyframes(side, travelPercent),
          {
            delay: getDaughterExitStartMs(order),
            duration: DAUGHTER_EXIT_MS,
            easing: DAUGHTER_EXIT_EASING,
            fill: "forwards",
          },
        );
        exitAnimations.push(exitAnimation);
        animations.push(exitAnimation);
        if (heldLook) {
          animations.push(
            element.animate(
              [
                {
                  translate: heldLook.lean,
                  scale: heldLook.scale,
                  boxShadow: heldLook.boxShadow,
                },
                RESTING_DAUGHTER_LOOK,
              ],
              {
                duration: DAUGHTER_EXIT_SETTLE_MS,
                easing: MOTION_EASING.standard,
              },
            ),
          );
        }
        if (box?.animate) {
          animations.push(
            box.animate(boxSinkKeyframes, {
              delay: getDaughterLandingMs(order),
              duration: BOX_SINK_MS,
              easing: MOTION_EASING.standard,
            }),
          );
        }
        if (exitLight?.animate) {
          animations.push(
            exitLight.animate(getExitLightKeyframes(side), {
              delay: getDaughterLandingMs(order),
              duration: EXIT_LIGHT_MS,
              easing: MOTION_EASING.standard,
            }),
          );
        }
      });
      startTogetherNow(animations);
      return animations;
    },
    completion: { type: "after-animations", holdMs: DAUGHTER_EXIT_HOLD_MS },
    reducedMotionHoldMs: 0,
    unanimatedHoldMs: 0,
    onFinished() {
      // 結果へ進むと演出を取り消すので、抜け切った姿を駒に書き残し、結果の画面に替わるまでの間に駒が行き先へ戻って見えないようにする。
      for (const animation of exitAnimations) {
        animation.commitStyles();
      }
      onFinished();
    },
  });
}

/**
 * 演出の始まりを、次の描画を待たずに今にそろえる。描画が遅れても、同じ時に予約した音と遅れた分だけずれることはなく、
 * 遅れた描画は進んだ姿から見せる。
 */
function startTogetherNow(animations: readonly Animation[]) {
  const now = performance.now();
  for (const animation of animations) {
    animation.startTime = now;
  }
}

/** 動きを減らす設定の演出。目標の駒を動かさず、止めたまま見せてから箱から消し、空いた箱を見せてから `onFinished` を呼ぶ。 */
function hideDaughtersWithoutMotion(
  elements: readonly (HTMLElement | null)[],
  onFinished: () => void,
): () => void {
  const hideTimer = window.setTimeout(() => {
    for (const element of elements) {
      if (element) {
        element.style.visibility = "hidden";
      }
    }
  }, REDUCED_MOTION_DAUGHTER_EXIT_MS);
  const finishTimer = window.setTimeout(
    onFinished,
    REDUCED_MOTION_DAUGHTER_EXIT_MS + REDUCED_MOTION_EMPTY_BOX_HOLD_MS,
  );
  return function cancel() {
    window.clearTimeout(hideTimer);
    window.clearTimeout(finishTimer);
  };
}
