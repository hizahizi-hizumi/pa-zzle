import blockedSoundUrl from "@/games/ice-floor-maze/assets/sounds/blocked.flac";
import clearedSoundUrl from "@/games/ice-floor-maze/assets/sounds/cleared.flac";
import goalPassedSoundUrl from "@/games/ice-floor-maze/assets/sounds/goal-passed.flac";
import iceCrackedSoundUrl from "@/games/ice-floor-maze/assets/sounds/ice-cracked.flac";
import rockCrumbledSoundUrl from "@/games/ice-floor-maze/assets/sounds/rock-crumbled.flac";
import slidSoundUrl from "@/games/ice-floor-maze/assets/sounds/slid.flac";
import stoppedSoundUrl from "@/games/ice-floor-maze/assets/sounds/stopped.flac";
import type {
  IceFloorMazeBlockedInput,
  IceFloorMazeLastSlide,
} from "@/games/ice-floor-maze/play/use-ice-floor-maze-play";
import {
  getIceFloorMazeCrackDelayMs,
  getIceFloorMazeSlideDurationMs,
  getIceFloorMazeSlideProgressMs,
} from "@/games/ice-floor-maze/ui/board/slide-timing";
import type { GameProgress } from "@/games/play";
import {
  useClearSound,
  useOperationSound,
  usePrepareSoundEffects,
} from "@/games/play-sound-effects";
import { prefersReducedMotion } from "@/lib/motion";
import {
  defineSoundEffect,
  playSound,
  REPEATED_SOUND_VARIATION,
  type SoundEffect,
} from "@/lib/sound-effects";

/** 駒が氷の上を滑り出す、軽いこすれの音。1プレイで何十回も鳴るので短く小さくし、滑る距離によらず同じ音にする。 */
const slidSound = defineSoundEffect(slidSoundUrl);

/** 駒が止め役にぶつかって止まる、小さなこつんという音。駒がつぶれて戻る時刻に鳴らす。 */
const stoppedSound = defineSoundEffect(stoppedSoundUrl);

/** 1マスも動けない向きを選んだときの、責めない鈍い音。 */
const blockedSound = defineSoundEffect(blockedSoundUrl);

/** もろい岩にぶつかって止まり、岩が崩れる音。止まる音の代わりに鳴らす。 */
const rockCrumbledSound = defineSoundEffect(rockCrumbledSoundUrl);

/** 薄い氷が割れて水面になる音。割れたマスごとに、そのマスが割れる時刻に鳴らす。 */
const iceCrackedSound = defineSoundEffect(iceCrackedSoundUrl);

/** ゴールの上を止まらずに通り過ぎた音。クリアの音より小さく短い。 */
const goalPassedSound = defineSoundEffect(goalPassedSoundUrl);

/** ゴールで止まり、ゴールの輪が広がる完成演出に合わせて鳴らす音。 */
const clearedSound = defineSoundEffect(clearedSoundUrl);

const iceFloorMazeSounds: readonly SoundEffect[] = [
  slidSound,
  stoppedSound,
  blockedSound,
  rockCrumbledSound,
  iceCrackedSound,
  goalPassedSound,
  clearedSound,
];

/**
 * 滑りの音。滑り出しに滑る音、通り過ぎたゴールと割れた薄い氷はその時刻に、止まった時刻に止まる音か崩れる音を鳴らす。
 * ゴールで止まった滑りは完成演出のクリア音が止まりを返すので、止まる音を鳴らさない。
 * 動きを減らす設定では駒が終点へ飛び、変わったマスも変わった後の姿ですぐ描かれるので、
 * 滑る音とゴールの通過の音は鳴らさず、止まる音か崩れる音と、割れた薄い氷の音1つだけをすぐ鳴らす。
 */
function playSlideSounds(slide: IceFloorMazeLastSlide, goal: number) {
  const reducedMotion = prefersReducedMotion();
  const distance = slide.path.length;
  const stopDelayMs = reducedMotion
    ? 0
    : getIceFloorMazeSlideDurationMs(distance);

  if (!reducedMotion) {
    playSound(slidSound, { variation: REPEATED_SOUND_VARIATION });
    if (slide.passedGoal) {
      playSound(goalPassedSound, {
        delayMs: getIceFloorMazeSlideProgressMs(
          distance,
          slide.path.indexOf(goal) + 1,
        ),
      });
    }
  }
  if (slide.crumbledRock !== null) {
    playSound(rockCrumbledSound, { delayMs: stopDelayMs });
  } else if (!slide.isClearingMove) {
    playSound(stoppedSound, {
      delayMs: stopDelayMs,
      variation: REPEATED_SOUND_VARIATION,
    });
  }
  const crackDelaysMs = reducedMotion
    ? slide.crackedIce.length > 0
      ? [0]
      : []
    : slide.crackedIce.map((cell) => getIceFloorMazeCrackDelayMs(slide, cell));
  for (const delayMs of crackDelaysMs) {
    playSound(iceCrackedSound, {
      delayMs,
      variation: REPEATED_SOUND_VARIATION,
    });
  }
}

/** 動きを減らす設定では駒を押し戻さず、画面が何も変わらないので鳴らさない。 */
function playBlockedSound() {
  if (!prefersReducedMotion()) {
    playSound(blockedSound);
  }
}

/**
 * 滑り・動けない入力・ゴールの通過・もろい岩が崩れる・薄い氷が割れる・ゴールで止まる瞬間に効果音を鳴らす。
 * 結果の報酬の音はアプリが鳴らす。閉じ込めの知らせ、待った・盤面を戻すでは鳴らさない。
 */
export function useIceFloorMazeSoundEffects(
  lastSlide: IceFloorMazeLastSlide | null,
  blockedInput: IceFloorMazeBlockedInput | null,
  goal: number,
  progress: GameProgress,
) {
  usePrepareSoundEffects(iceFloorMazeSounds);
  useOperationSound(lastSlide, function playSlideOperationSounds(slide) {
    playSlideSounds(slide, goal);
  });
  useOperationSound(blockedInput, playBlockedSound);
  useClearSound(
    progress,
    function playClearSound() {
      // 完成演出の輪は、駒がゴールに滑り着いてから広がる。
      playSound(clearedSound, {
        delayMs: lastSlide?.isClearingMove
          ? getIceFloorMazeSlideDurationMs(lastSlide.path.length)
          : 0,
      });
    },
    {
      // 動きを減らす設定でも、駒がゴールに止まった姿を少し見せてから結果へ進む。
      playReducedMotionClearSound() {
        playSound(clearedSound);
      },
    },
  );
}
