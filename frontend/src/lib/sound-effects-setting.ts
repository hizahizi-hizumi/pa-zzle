/**
 * 効果音を鳴らすかどうかの設定。全ゲームで共通にし、端末に保存して次に開いたときも引き継ぐ。
 * はじめは鳴らす。保存した値を読めないときも鳴らす。
 *
 * React からは `useSyncExternalStore(subscribeSoundEffectsEnabled, isSoundEffectsEnabled)` で読む。
 */

import { createStoredEnabledSetting } from "@/lib/stored-enabled-setting";

const soundEffectsSetting = createStoredEnabledSetting(
  "pa-zzle.sound-effects.v1",
);

/** 効果音を鳴らす設定か。 */
export function isSoundEffectsEnabled(): boolean {
  return soundEffectsSetting.isEnabled();
}

/** 効果音を鳴らすかどうかを選び、端末に保存する。 */
export function setSoundEffectsEnabled(next: boolean): void {
  soundEffectsSetting.setEnabled(next);
}

/** 設定が変わったら `onChange` を呼ぶ。別のタブで変えたときも呼ぶ。購読をやめる関数を返す。 */
export function subscribeSoundEffectsEnabled(onChange: () => void): () => void {
  return soundEffectsSetting.subscribe(onChange);
}
