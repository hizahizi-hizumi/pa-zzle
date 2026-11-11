/**
 * 図鑑の変化を見せるときに、変化したマスを押すたびに鳴らす音。
 * 押すたびの音は短く小さくし、段階が上がったマスと perfect に至ったマスだけを強くする。
 * 図鑑の画面はゲームの音を使わないので、アプリが持つ選ぶ音・始める音・結果の報酬の音を、高さと大きさを変えて使う。
 */

import gameSelectSoundUrl from "@/assets/sounds/game-select.flac";
import playStartSoundUrl from "@/assets/sounds/play-start.flac";
import { getGameResultSound } from "@/components/game-result-sound";
import {
  defineSoundEffect,
  playSound,
  REPEATED_SOUND_VARIATION,
  type SoundEffect,
} from "@/lib/sound-effects";
import type { ZukanStamp } from "@/zukan/ui/GameHomeScreen/zukan-change-reveal";

const tickSound = defineSoundEffect(gameSelectSoundUrl);
const thudSound = defineSoundEffect(playStartSoundUrl);
const perfectRewardSound = getGameResultSound("perfect");

/** 押していく演出で鳴らしうる音すべて。台紙を開いたときに読み込んでおく。 */
export const zukanStampSounds: readonly SoundEffect[] = [
  tickSound,
  thudSound,
  perfectRewardSound,
];

const SEMITONE_RATE = 2 ** (1 / 12);
/** 図鑑の画面の音は、プレイ中の音より控えめにする。 */
const STAMP_VOLUME = 0.7;
/** clear は good より一段小さくする。 */
const CLEAR_VOLUME = STAMP_VOLUME * 0.75;
/** good と great を、それぞれの素材を2半音上げて clear と聞き分ける。 */
const STEP_UP_RATE = SEMITONE_RATE ** 2;
/** 段階が上がったときの2音。1音目から完全4度上げて、少し遅らせて重ねる。 */
const RAISED_SECOND_NOTE_RATE = SEMITONE_RATE ** 5;
const RAISED_SECOND_NOTE_DELAY_MS = 80;
/** perfect の報酬の音は、結果画面で受け取る音より短く明るく、小さく鳴らす。 */
const PERFECT_REWARD_RATE = 1.25;
const PERFECT_REWARD_VOLUME = 0.45;

/** 1マスを押したときに鳴らす音の1つ。 */
type ZukanStampSoundCue = {
  sound: SoundEffect;
  delayMs: number;
  playbackRate: number;
  volume: number;
  /** 回数の多い音として、鳴らすたびに聞き分けられないほど揺らすか。 */
  varies: boolean;
};

function cue(
  sound: SoundEffect,
  {
    delayMs = 0,
    playbackRate = 1,
    volume = STAMP_VOLUME,
    varies = false,
  }: Partial<Omit<ZukanStampSoundCue, "sound">> = {},
): ZukanStampSoundCue {
  return { sound, delayMs, playbackRate, volume, varies };
}

/**
 * 押した変化に合わせて鳴らす音。
 * - perfect に至った: 始める音と、結果の報酬の perfect の音を重ねる。
 * - 段階が上がった: 選ぶ音を、少し遅らせて高くした2音にする。
 * - 新しく great で解いた: 始める音を少し高くする。
 * - 新しく good・clear で解いた: 選ぶ音を小さく鳴らす。回数が多いので揺らす。
 */
function listZukanStampSoundCues({
  level,
  isRaised,
}: ZukanStamp): ZukanStampSoundCue[] {
  if (level === "perfect") {
    return [
      cue(thudSound),
      cue(perfectRewardSound, {
        playbackRate: PERFECT_REWARD_RATE,
        volume: PERFECT_REWARD_VOLUME,
      }),
    ];
  }
  if (isRaised) {
    return [
      cue(tickSound),
      cue(tickSound, {
        delayMs: RAISED_SECOND_NOTE_DELAY_MS,
        playbackRate: RAISED_SECOND_NOTE_RATE,
      }),
    ];
  }
  if (level === "great") {
    return [cue(thudSound, { playbackRate: STEP_UP_RATE, varies: true })];
  }
  return level === "good"
    ? [cue(tickSound, { playbackRate: STEP_UP_RATE, varies: true })]
    : [cue(tickSound, { volume: CLEAR_VOLUME, varies: true })];
}

/** 押した変化に合わせた音を鳴らす。鳴らさない設定と鳴らせない環境では `playSound` が何もしない。 */
export function playZukanStampSound(stamp: ZukanStamp): void {
  for (const {
    sound,
    delayMs,
    playbackRate,
    volume,
    varies,
  } of listZukanStampSoundCues(stamp)) {
    playSound(sound, {
      delayMs,
      playbackRate,
      volume,
      variation: varies ? REPEATED_SOUND_VARIATION : undefined,
    });
  }
}

export const _private = { listZukanStampSoundCues };
