/**
 * アプリの画面で、遊ぶゲームを選ぶ・プレイを始める決定の操作に鳴らす音。全ゲームで揃える。
 * 結果の報酬と同じ C メジャーの鐘の音色で作り、プレイ中の操作の音より小さく短くする。
 * 選ぶ音の G5 から、始める音は C6 へ上がって主音に落ち着く。
 *
 * 決定の操作のイベントハンドラで鳴らす。戻る、メニューやダイアログの開閉、記録を見る、
 * 設定の切り替え、画面遷移そのもの、プレイ中のリセットでは鳴らさない。
 */

import { createBellNote, NOTE } from "@/components/game-result-sound";
import { playSound, type SoundTone } from "@/lib/sound-effects";

/** 遊ぶゲームを選んだときの、ごく短く柔らかい1音。 */
const gameSelectSound: readonly SoundTone[] = createBellNote(
  NOTE.G5,
  0,
  120,
  0.04,
);

/** プレイを始めるときの、上がる2音。 */
const playStartSound: readonly SoundTone[] = [
  ...createBellNote(NOTE.G5, 0, 110, 0.045),
  ...createBellNote(NOTE.C6, 75, 200, 0.05),
];

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
