/**
 * アプリの画面で、ゲームを選んで移動する操作と、プレイを始める決定の操作に返す効果音。
 * 効果音の音量を選んだときに、選んだ音量を確かめる音としても鳴らす。
 */

import carouselMoveSoundUrl from "@/assets/sounds/carousel-move.flac";
import gameSelectSoundUrl from "@/assets/sounds/game-select.flac";
import playStartSoundUrl from "@/assets/sounds/play-start.flac";
import { usePrepareSoundEffects } from "@/games/play-sound-effects";
import {
  defineSoundEffect,
  playSound,
  REPEATED_SOUND_VARIATION,
} from "@/lib/sound-effects";

const gameSelectSound = defineSoundEffect(gameSelectSoundUrl);

const playStartSound = defineSoundEffect(playStartSoundUrl);
const carouselMoveSound = defineSoundEffect(carouselMoveSoundUrl);

const appDecisionSounds = [gameSelectSound, playStartSound, carouselMoveSound];

/** 決定の操作の音を鳴らしうる画面すべてを包む部品で一度呼び、アプリを開いたときに音の読み込みを始める。 */
export function usePrepareAppDecisionSounds(): void {
  usePrepareSoundEffects(appDecisionSounds);
}

/** 遊ぶゲームを選んだときの音を鳴らす。 */
export function playGameSelectSound(): void {
  playSound(gameSelectSound);
}

/** ホームで選ぶゲームが切り替わるときの軽い操作音を鳴らす。 */
export function playCarouselMoveSound(): void {
  playSound(carouselMoveSound, {
    variation: REPEATED_SOUND_VARIATION,
    volume: 0.48,
  });
}

/** プレイを始めるときの音を鳴らす。 */
export function playPlayStartSound(): void {
  playSound(playStartSound);
}

/**
 * 効果音の音量を選び終えたときに、選んだ音量で鳴らす。
 * 設定の操作には音を鳴らさないが、効果音の音量は聞かないと合わせられないので、アプリの画面の音で確かめられるようにする。
 */
export function playSoundEffectsVolumePreview(): void {
  playSound(playStartSound);
}

/** プレイを始める音を鳴らしてから `startPlay` を行う、決定の操作のイベントハンドラを作る。 */
export function withPlayStartSound(startPlay: () => void): () => void {
  return function startPlayWithSound() {
    playPlayStartSound();
    startPlay();
  };
}

export const _private = { gameSelectSound, playStartSound, carouselMoveSound };
