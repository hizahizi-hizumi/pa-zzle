import clearedSlideSoundUrl from "@/games/hakoiri-musume/assets/sounds/cleared-slide.flac";
import clearedThudSoundUrl from "@/games/hakoiri-musume/assets/sounds/cleared-thud.flac";
import pieceSlidSoundUrl from "@/games/hakoiri-musume/assets/sounds/piece-slid.flac";
import pieceSlid2SoundUrl from "@/games/hakoiri-musume/assets/sounds/piece-slid-2.flac";
import pieceSlid3SoundUrl from "@/games/hakoiri-musume/assets/sounds/piece-slid-3.flac";
import type { HakoiriMusumeStepNotice } from "@/games/hakoiri-musume/play/use-hakoiri-musume-play";
import { DAUGHTER_EXIT_MS } from "@/games/hakoiri-musume/ui/board/HakoiriMusumeBoard/play-daughter-exit";
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

/** 駒が1マスすべる、木のこすれと小さなこつ。同じ音が続かないよう、テイクを順に替えて鳴らす。 */
const pieceSlidSounds = [
  pieceSlidSoundUrl,
  pieceSlid2SoundUrl,
  pieceSlid3SoundUrl,
].map(defineSoundEffect);
/** 娘が出口の縁をこすって抜けていく音。 */
const clearedSlideSound = defineSoundEffect(clearedSlideSoundUrl);
/** 抜け切った娘が箱の外へ落ちる、ごとんと木の箱の胴鳴り。 */
const clearedThudSound = defineSoundEffect(clearedThudSoundUrl);

const hakoiriMusumeSounds: readonly SoundEffect[] = [
  ...pieceSlidSounds,
  clearedSlideSound,
  clearedThudSound,
];

/** 娘は大きく重い駒なので、同じすべる音を遅く低く鳴らす。 */
const DAUGHTER_SLIDE_PLAYBACK_RATE = 0.82;

function playStepSound(notice: HakoiriMusumeStepNotice) {
  playSound(pieceSlidSounds[notice.id % pieceSlidSounds.length]!, {
    variation: REPEATED_SOUND_VARIATION,
    playbackRate:
      notice.kind === "daughter" ? DAUGHTER_SLIDE_PLAYBACK_RATE : undefined,
  });
}

function playClearSound() {
  playLayeredSound([
    { sound: clearedSlideSound, offsetMs: 0 },
    { sound: clearedThudSound, offsetMs: DAUGHTER_EXIT_MS },
  ]);
}

/**
 * 駒が新しいマスへ移るたびのすべる音と、娘が出口から抜けていく演出の音を鳴らす。結果の報酬の音はアプリが鳴らす。
 * 動けない向きの入力・待った・盤面を戻す・リセットでは鳴らさない。動きを減らす設定では、娘を出口の前に止めたまま見せ、
 * 抜けていく姿が無いのでクリア音を鳴らさない。
 */
export function useHakoiriMusumeSoundEffects(
  stepNotice: HakoiriMusumeStepNotice | null,
  progress: GameProgress,
) {
  usePrepareSoundEffects(hakoiriMusumeSounds);
  useOperationSound(stepNotice, playStepSound);
  useClearSound(progress, playClearSound);
}
