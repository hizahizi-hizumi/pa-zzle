/** アプリの画面で、遊ぶゲームを選ぶ・プレイを始める決定の操作に鳴らす音。決定の操作のイベントハンドラで鳴らす。 */

import gameSelectSoundUrl from "@/assets/sounds/game-select.flac";
import playStartSoundUrl from "@/assets/sounds/play-start.flac";
import { usePrepareSoundEffects } from "@/games/play-sound-effects";
import { defineSoundEffect, playSound } from "@/lib/sound-effects";

const gameSelectSound = defineSoundEffect(gameSelectSoundUrl);

const playStartSound = defineSoundEffect(playStartSoundUrl);

const appDecisionSounds = [gameSelectSound, playStartSound];

/** 決定の操作の音を鳴らしうる画面すべてを包む部品で一度呼び、アプリを開いたときに音の読み込みを始める。 */
export function usePrepareAppDecisionSounds(): void {
  usePrepareSoundEffects(appDecisionSounds);
}

/** 遊ぶゲームを選んだときの音を鳴らす。 */
export function playGameSelectSound(): void {
  playSound(gameSelectSound);
}

/** プレイを始めるときの音を鳴らす。 */
export function playPlayStartSound(): void {
  playSound(playStartSound);
}

/** プレイを始める音を鳴らしてから `startPlay` を行う、決定の操作のイベントハンドラを作る。 */
export function withPlayStartSound(startPlay: () => void): () => void {
  return function startPlayWithSound() {
    playPlayStartSound();
    startPlay();
  };
}

export const _private = { gameSelectSound, playStartSound };
