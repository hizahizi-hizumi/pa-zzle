import clearedSlideSoundUrl from "@/games/hakoiri-musume/assets/sounds/cleared-slide.flac";
import clearedThudSoundUrl from "@/games/hakoiri-musume/assets/sounds/cleared-thud.flac";
import pieceSlidSoundUrl from "@/games/hakoiri-musume/assets/sounds/piece-slid.flac";
import pieceSlid2SoundUrl from "@/games/hakoiri-musume/assets/sounds/piece-slid-2.flac";
import pieceSlid3SoundUrl from "@/games/hakoiri-musume/assets/sounds/piece-slid-3.flac";
import type { HakoiriMusumeStepNotice } from "@/games/hakoiri-musume/play/use-hakoiri-musume-play";
import {
  getDaughterExitStartMs,
  getDaughterLandingMs,
  REDUCED_MOTION_DAUGHTER_EXIT_MS,
} from "@/games/hakoiri-musume/ui/board/daughter-exit-timing";
import type { GameProgress } from "@/games/play";
import {
  useClearSound,
  useOperationSound,
  usePrepareSoundEffects,
} from "@/games/play-sound-effects";
import {
  defineSoundEffect,
  playLayeredSound,
  playSound,
  REPEATED_SOUND_VARIATION,
  type SoundEffect,
} from "@/lib/sound-effects";

/** 駒が1マスすべる、木のこすれと小さなこつ。3本のテイクで、高さが半音ほどずつ違う。 */
const pieceSlidSounds = [
  pieceSlidSoundUrl,
  pieceSlid2SoundUrl,
  pieceSlid3SoundUrl,
].map(defineSoundEffect);

let previousPieceSlidTake: number | null = null;

/**
 * 次に鳴らすすべる音のテイク。直前のテイクを除いた残りから同じ確からしさで選び、同じ音や決まった順の繰り返しに聞こえないようにする。
 */
function pickPieceSlidSound(): SoundEffect {
  const others = pieceSlidSounds
    .map((_, index) => index)
    .filter((index) => index !== previousPieceSlidTake);
  previousPieceSlidTake = others[Math.floor(Math.random() * others.length)]!;
  return pieceSlidSounds[previousPieceSlidTake]!;
}
/** 娘が出口の縁をこすって抜けていく音。 */
const clearedSlideSound = defineSoundEffect(clearedSlideSoundUrl);
/** 抜け切った娘が箱の外へ落ちる、ごとんと木の箱の胴鳴り。 */
const clearedThudSound = defineSoundEffect(clearedThudSoundUrl);

const hakoiriMusumeSounds: readonly SoundEffect[] = [
  ...pieceSlidSounds,
  clearedSlideSound,
  clearedThudSound,
];

/** 目標の駒（娘）は重い駒として、同じすべる音を遅く低く鳴らす。 */
const DAUGHTER_SLIDE_PLAYBACK_RATE = 0.82;

/** すべる音どうしの間の下限。1回の入力で続けて移ったマスも、続く入力で移ったマスも、1マスずつ聞き分けられるようにずらす。 */
const STEP_SOUND_INTERVAL_MS = 30;

/** 最後にすべる音を鳴らす（予約した）時刻（`performance.now()` の ms）。 */
let lastStepSoundAt = Number.NEGATIVE_INFINITY;

/** 駒が移ったマスの数だけ、すべる音を、前の音から `STEP_SOUND_INTERVAL_MS` 以上あけて鳴らす。 */
function playStepSound(notice: HakoiriMusumeStepNotice) {
  const now = performance.now();
  for (let cell = 0; cell < notice.cellCount; cell += 1) {
    const at = Math.max(now, lastStepSoundAt + STEP_SOUND_INTERVAL_MS);
    lastStepSoundAt = at;
    playSound(pickPieceSlidSound(), {
      delayMs: at - now,
      variation: REPEATED_SOUND_VARIATION,
      playbackRate:
        notice.target === null ? undefined : DAUGHTER_SLIDE_PLAYBACK_RATE,
    });
  }
}

/** 盤面の演出と同じ時刻を始まりに、目標の駒が1つずつ抜け始める時と抜け切って落ちる時に合わせて鳴らす。 */
function playClearSound(targetCount: number) {
  playLayeredSound(
    Array.from({ length: targetCount }, (_, order) => [
      { sound: clearedSlideSound, offsetMs: getDaughterExitStartMs(order) },
      { sound: clearedThudSound, offsetMs: getDaughterLandingMs(order) },
    ]).flat(),
  );
}

/**
 * 動きを減らす設定のクリア音。目標の駒は抜けていかずに一度に箱から消えるので、こすれは鳴らさず、消えるのに合わせて箱の外へ落ちる
 * ごとんを1つだけ鳴らす。
 */
function playReducedMotionClearSound() {
  playSound(clearedThudSound, { delayMs: REDUCED_MOTION_DAUGHTER_EXIT_MS });
}

/**
 * 駒が新しいマスへ移るたびのすべる音と、`targetCount` 個の目標の駒が出口から抜けていく演出の音を鳴らす。結果の報酬の音はアプリが鳴らす。
 * 動けない向きの入力・待った・盤面を戻す・リセットでは鳴らさない。
 */
export function useHakoiriMusumeSoundEffects(
  stepNotice: HakoiriMusumeStepNotice | null,
  progress: GameProgress,
  targetCount: number,
) {
  usePrepareSoundEffects(hakoiriMusumeSounds);
  useOperationSound(stepNotice, playStepSound);
  useClearSound(progress, () => playClearSound(targetCount), {
    playReducedMotionClearSound,
  });
}
