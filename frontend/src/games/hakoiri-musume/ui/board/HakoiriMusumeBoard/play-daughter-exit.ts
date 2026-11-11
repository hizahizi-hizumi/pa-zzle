import {
  DAUGHTER_EXIT_MS,
  DAUGHTER_EXIT_SETTLE_MS,
  DAUGHTER_EXIT_START_MS,
  DAUGHTER_LANDING_MS,
  REDUCED_MOTION_DAUGHTER_EXIT_MS,
} from "@/games/hakoiri-musume/ui/board/daughter-exit-timing";
import {
  MOTION_EASING,
  playAnimations,
  prefersReducedMotion,
} from "@/lib/motion";

/** 娘が抜けた後の空いた箱を、結果へ進める前に見せておく時間。 */
const DAUGHTER_EXIT_HOLD_MS = 200;
/** 動きを減らす設定で、娘を箱から消した後、空いた箱を見せておく時間。 */
const REDUCED_MOTION_EMPTY_BOX_HOLD_MS = 550;

/** 抜け切った娘が落ちたごとんに合わせて、箱が沈んで戻る深さと時間。 */
const BOX_SINK_PX = 3.5;
const BOX_SINK_MS = 120;

/** 抜け切った娘が落ちたときに、出口の縁へ差す光の長さ。 */
const EXIT_LIGHT_MS = 420;

/**
 * 止まった所から動き出し、終わりに向けて少し速めて、上の辺が箱の外形の下端を越えるまで（駒の見た目の高さ 1.93 マスに対して、
 * 2マスと縁の太さ 0.2 マス分。高さの 115%）下がって終える。箱の外へ出た分は、箱の外形で切り取られて見えなくなる。
 * 動きの大半が最後に寄ると抜けていく姿が見えないので、加速は弱くし、始めから目に見える速さで下げる。
 */
const daughterExitKeyframes: Keyframe[] = [
  { transform: "translateY(0)" },
  { transform: "translateY(115%)" },
];
const DAUGHTER_EXIT_EASING = "cubic-bezier(0.3, 0.15, 0.7, 0.75)";

const boxSinkKeyframes: Keyframe[] = [
  { transform: "translateY(0)" },
  { transform: `translateY(${BOX_SINK_PX}px)`, offset: 0.3 },
  { transform: "translateY(0)" },
];

/** 出口の縁の光。一度だけ差して、出口の外へ広がりながら消える。 */
const exitLightKeyframes: Keyframe[] = [
  { opacity: 0, transform: "scaleX(0.7)" },
  { opacity: 1, transform: "scaleX(1)", offset: 0.2 },
  { opacity: 0, transform: "scaleX(1.15)" },
];

/**
 * 娘が抜ける演出で動かす要素。
 * - `daughter`: 娘の駒。
 * - `box`: 箱の全体。落ちたごとんに合わせて沈める。
 * - `exitLight`: 出口の縁に差す光。娘が抜け切ったときに一度だけ見せる。
 */
export type DaughterExitElements = {
  daughter: HTMLElement | null;
  box: HTMLElement | null;
  exitLight: HTMLElement | null;
};

/**
 * クリアした瞬間に、娘を見せていた姿（CSS の値）。つかんでいた娘か、弾いて出口の前へ動かした娘のとき。
 * - `lean`: 出口の前のマスからのずれ（`translate`）。指へ寄せて見せていたずれか、弾いて動かす前に見せていた位置。
 * - `scale`・`boxShadow`: 持ち上げて見せていた大きさと影。持ち上げていなければ `RESTING_DAUGHTER_LOOK` の値。
 */
export type DaughterHeldLook = {
  lean: string;
  scale: string;
  boxShadow: string;
};

/** 持ち上げを下ろした娘の、マスに収まった姿。影は、持ち上げた影のずれ・ぼかし・濃さを 0 へ縮めた形。 */
export const RESTING_DAUGHTER_LOOK = {
  translate: "0px 0px",
  scale: "1",
  boxShadow: "0 0 0 -3px rgb(30 18 5 / 0)",
};

/**
 * クリアした娘を、指へ寄せていたずれを収めて持ち上げを下ろし、出口の前で少し止めてから外へ出す。抜け切ったところで箱を沈め、
 * 出口の縁に光を差してから `onFinished` を呼ぶ。戻り値は演出を取り消す関数。
 * `heldLook` は、つかんでいた娘をクリアしたときの姿。つかまずに（キーボードで）クリアしたときは `null` を渡す。
 * 演出の時刻は呼んだ時を始まりとして刻み、同じ時に `DAUGHTER_EXIT_START_MS`・`DAUGHTER_LANDING_MS` で予約した音とずらさない。
 * 動きを減らす設定では、出口の前に着いた娘を動かさずに見せてから、箱から消して、空いた箱を見せてから呼ぶ。
 */
export function playDaughterExit(
  { daughter, box, exitLight }: DaughterExitElements,
  heldLook: DaughterHeldLook | null,
  onFinished: () => void,
): () => void {
  if (prefersReducedMotion()) {
    return hideDaughterWithoutMotion(daughter, onFinished);
  }
  let daughterExit: Animation | undefined;
  return playAnimations({
    animate() {
      if (!daughter?.animate) {
        return [];
      }
      daughterExit = daughter.animate(daughterExitKeyframes, {
        delay: DAUGHTER_EXIT_START_MS,
        duration: DAUGHTER_EXIT_MS,
        easing: DAUGHTER_EXIT_EASING,
        fill: "forwards",
      });
      const animations = [daughterExit];
      if (heldLook) {
        animations.push(
          daughter.animate(
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
            delay: DAUGHTER_LANDING_MS,
            duration: BOX_SINK_MS,
            easing: MOTION_EASING.standard,
          }),
        );
      }
      if (exitLight?.animate) {
        animations.push(
          exitLight.animate(exitLightKeyframes, {
            delay: DAUGHTER_LANDING_MS,
            duration: EXIT_LIGHT_MS,
            easing: MOTION_EASING.standard,
          }),
        );
      }
      startTogetherNow(animations);
      return animations;
    },
    completion: { type: "after-animations", holdMs: DAUGHTER_EXIT_HOLD_MS },
    reducedMotionHoldMs: 0,
    unanimatedHoldMs: 0,
    onFinished() {
      // 結果へ進むと演出を取り消すので、抜け切った姿を駒に書き残し、結果の画面に替わるまでの間に娘が出口の前へ戻って見えないようにする。
      daughterExit?.commitStyles();
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

/** 動きを減らす設定の演出。娘を動かさず、止めたまま見せてから箱から消し、空いた箱を見せてから `onFinished` を呼ぶ。 */
function hideDaughterWithoutMotion(
  daughter: HTMLElement | null,
  onFinished: () => void,
): () => void {
  const hideTimer = window.setTimeout(() => {
    if (daughter) {
      daughter.style.visibility = "hidden";
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
