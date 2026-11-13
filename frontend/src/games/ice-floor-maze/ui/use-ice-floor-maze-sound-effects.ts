import blockStoppedSoundUrl from "@/games/ice-floor-maze/assets/sounds/block-stopped.flac";
import blockedSoundUrl from "@/games/ice-floor-maze/assets/sounds/blocked.flac";
import clearedSoundUrl from "@/games/ice-floor-maze/assets/sounds/cleared.flac";
import floorStoppedSoundUrl from "@/games/ice-floor-maze/assets/sounds/floor-stopped.flac";
import glidedLongSoundUrl from "@/games/ice-floor-maze/assets/sounds/glided-long.flac";
import glidedShortSoundUrl from "@/games/ice-floor-maze/assets/sounds/glided-short.flac";
import goalPassedSoundUrl from "@/games/ice-floor-maze/assets/sounds/goal-passed.flac";
import iceCrackedSoundUrl from "@/games/ice-floor-maze/assets/sounds/ice-cracked.flac";
import rockCrumbledSoundUrl from "@/games/ice-floor-maze/assets/sounds/rock-crumbled.flac";
import slidSoundUrl from "@/games/ice-floor-maze/assets/sounds/slid.flac";
import snowPushedSoundUrl from "@/games/ice-floor-maze/assets/sounds/snow-pushed.flac";
import stoppedSoundUrl from "@/games/ice-floor-maze/assets/sounds/stopped.flac";
import type {
  IceFloorMazeBlockedInput,
  IceFloorMazeLastSlide,
} from "@/games/ice-floor-maze/play/use-ice-floor-maze-play";
import {
  getIceFloorMazeBlockContactMs,
  getIceFloorMazeCrackDelayMs,
  getIceFloorMazeSlideDurationMs,
  getIceFloorMazeSlideProgressMs,
  getIceFloorMazeSnowPushDelayMs,
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

/**
 * 駒が氷の上を滑り続ける、乾いた擦れの音。滑り出しの音は短いので、長く滑る手ではこれを重ね、滑っている間じゅう音が続くようにする。
 * 滑る時間に近い長さの方を選び、再生の速さで滑りが止まる時刻のあたりに鳴り終わらせる（揺らぎの分だけ前後する）。
 * 滑り出しの音より小さくする。`durationMs` は音声ファイルの長さで、`scripts/assets/ice_floor_maze_glide_sounds.py` の `duration` と同じ値。
 */
const glideSounds = [
  { sound: defineSoundEffect(glidedShortSoundUrl), durationMs: 170 },
  { sound: defineSoundEffect(glidedLongSoundUrl), durationMs: 300 },
] as const;
/** これより短い滑りは、滑り出しの音だけで足りる。 */
const GLIDE_SOUND_MIN_DISTANCE = 3;

/** 駒が止め役にぶつかって止まる、小さなこつんという音。駒がつぶれて戻る時刻に鳴らす。 */
const stoppedSound = defineSoundEffect(stoppedSoundUrl);

/**
 * 駒が床に入って止まる、ざらついた面に擦れて止まる短い音。何にもぶつからずに止まるので、止まる音（こつん）の代わりに鳴らし、
 * 岩の手前で止まったのか床で止まったのかを耳でも分ける。
 */
const floorStoppedSound = defineSoundEffect(floorStoppedSoundUrl);

/** 1マスも動けない向きを選んだときの、鈍い音。 */
const blockedSound = defineSoundEffect(blockedSoundUrl);

/** もろい岩にぶつかって止まり、岩が崩れる音。止まる音の代わりに鳴らす。 */
const rockCrumbledSound = defineSoundEffect(rockCrumbledSoundUrl);

/**
 * 雪を押し寄せる、くぐもったざくっという音。駒が雪のマスに入り、雪が押し出され始める時刻に、止まる音の代わりに鳴らす。
 * 駒は雪のあったマスで柔らかく止まるので、こつんとは鳴らさない。
 */
const snowPushedSound = defineSoundEffect(snowPushedSoundUrl);

/**
 * 押された滑る氷の塊が氷の上を擦って滑り、止め役に当たって止まる音。駒は塊と一緒に止まるので、止まる音の代わりに鳴らす。
 * 音声ファイルは短い擦れから始まり `BLOCK_STOPPED_SOUND_LEAD_MS` 後に当たるので、塊が止まる時刻よりその分だけ早く鳴らし始める。
 * 駒が塊に触れる前には鳴らし始めない。
 */
const blockStoppedSound = defineSoundEffect(blockStoppedSoundUrl);
const BLOCK_STOPPED_SOUND_LEAD_MS = 40;

/** 薄い氷が割れて水面になる音。割れたマスごとに、そのマスが割れる時刻に鳴らす。 */
const iceCrackedSound = defineSoundEffect(iceCrackedSoundUrl);

/** ゴールの上を止まらずに通り過ぎた音。クリアの音より小さく短い。 */
const goalPassedSound = defineSoundEffect(goalPassedSoundUrl);

/** ゴールで止まり、ゴールの輪が広がる完成演出に合わせて鳴らす音。 */
const clearedSound = defineSoundEffect(clearedSoundUrl);

const iceFloorMazeSounds: readonly SoundEffect[] = [
  slidSound,
  ...glideSounds.map(({ sound }) => sound),
  stoppedSound,
  floorStoppedSound,
  blockedSound,
  rockCrumbledSound,
  snowPushedSound,
  blockStoppedSound,
  iceCrackedSound,
  goalPassedSound,
  clearedSound,
];

function playSlideSounds(slide: IceFloorMazeLastSlide, goal: number) {
  // 動きを減らす設定では駒が終点へ飛び、変わったマスも変わった後の姿ですぐ描かれるので、
  // 滑る音・擦れの音とゴールの通過の音は鳴らさず、止まり方の音と、割れた薄い氷の音1つだけをすぐ鳴らす。
  const reducedMotion = prefersReducedMotion();
  const distance = slide.path.length;
  const stopDelayMs = reducedMotion
    ? 0
    : getIceFloorMazeSlideDurationMs(distance);

  if (!reducedMotion) {
    playSound(slidSound, { variation: REPEATED_SOUND_VARIATION });
    if (distance >= GLIDE_SOUND_MIN_DISTANCE) {
      playGlideSound(stopDelayMs);
    }
    if (slide.passedGoal) {
      playSound(goalPassedSound, {
        delayMs: getIceFloorMazeSlideProgressMs(
          distance,
          slide.path.indexOf(goal) + 1,
        ),
      });
    }
  }
  // ゴールで止まった滑りは完成演出のクリア音が止まりを返すので、止まる音を鳴らさない。
  if (slide.crumbledRock !== null) {
    playSound(rockCrumbledSound, { delayMs: stopDelayMs });
  } else if (slide.pushedSnow) {
    playSound(snowPushedSound, {
      delayMs: reducedMotion ? 0 : getIceFloorMazeSnowPushDelayMs(slide),
    });
  } else if (slide.movedBlock) {
    playSound(blockStoppedSound, {
      delayMs: reducedMotion
        ? 0
        : Math.max(
            getIceFloorMazeBlockContactMs(slide, slide.movedBlock.from),
            stopDelayMs - BLOCK_STOPPED_SOUND_LEAD_MS,
          ),
    });
  } else if (!slide.isClearingMove) {
    playSound(slide.stoppedOnFloor ? floorStoppedSound : stoppedSound, {
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

function playGlideSound(slideMs: number) {
  const { sound, durationMs } = glideSounds.reduce((nearest, candidate) =>
    Math.abs(candidate.durationMs - slideMs) <
    Math.abs(nearest.durationMs - slideMs)
      ? candidate
      : nearest,
  );
  playSound(sound, {
    variation: REPEATED_SOUND_VARIATION,
    playbackRate: durationMs / slideMs,
  });
}

function playBlockedSound() {
  // 動きを減らす設定では駒を押し戻さず、画面が何も変わらないので鳴らさない。
  if (!prefersReducedMotion()) {
    playSound(blockedSound);
  }
}

/** 結果の報酬の音はアプリが鳴らす。もうゴールに止まれないことの知らせ、待った・盤面を戻すでは鳴らさない。 */
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
