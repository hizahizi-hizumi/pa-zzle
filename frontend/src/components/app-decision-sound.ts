/**
 * アプリの画面で、遊ぶゲームを選ぶ・プレイを始める決定の操作に鳴らす音。全ゲームで揃える。
 * 結果の報酬と同じ C メジャーの鐘の音色で、プレイ中の操作の音より小さく短い。
 * 選ぶ音は G5 の1音、始める音は G5 から C6 へ上がって主音に落ち着く。
 *
 * 決定の操作のイベントハンドラで鳴らす。戻る、メニューやダイアログの開閉、記録を見る、
 * 設定の切り替え、画面遷移そのもの、プレイ中のリセットでは鳴らさない。
 */

import { useEffect } from "react";

import gameSelectSoundUrl from "@/assets/sounds/game-select.wav";
import playStartSoundUrl from "@/assets/sounds/play-start.wav";
import {
  defineSoundEffect,
  playSound,
  prepareSoundEffects,
} from "@/lib/sound-effects";

/** 遊ぶゲームを選んだときの、ごく短く柔らかい1音。 */
const gameSelectSound = defineSoundEffect(gameSelectSoundUrl);

/** プレイを始めるときの、上がる2音。 */
const playStartSound = defineSoundEffect(playStartSoundUrl);

const appDecisionSounds = [gameSelectSound, playStartSound];

/** 決定の操作の音を鳴らしうる部品で呼び、画面を出したときに音の読み込みを始める。 */
export function usePrepareAppDecisionSounds(): void {
  useEffect(() => {
    prepareSoundEffects(appDecisionSounds);
  }, []);
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
