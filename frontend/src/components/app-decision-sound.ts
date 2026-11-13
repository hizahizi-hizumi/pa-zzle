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

export function playGameSelectSound(): void {
  playSound(gameSelectSound);
}

export function playCarouselMoveSound(): void {
  playSound(carouselMoveSound, {
    variation: REPEATED_SOUND_VARIATION,
    volume: 0.48,
  });
}

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

export function withPlayStartSound(startPlay: () => void): () => void {
  return function startPlayWithSound() {
    playPlayStartSound();
    startPlay();
  };
}

export const _private = { gameSelectSound, playStartSound, carouselMoveSound };
