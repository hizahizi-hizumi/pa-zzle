/**
 * 効果音の音量の設定。BGM の音量とは別に選べる。全ゲームで共通にし、端末に保存して次に開いたときも引き継ぐ。
 * 0 は鳴らさない。
 *
 * React からは `useSyncExternalStore(soundEffectsVolumeSetting.subscribe, soundEffectsVolumeSetting.getVolume)` で読む。
 */

import {
  createStoredVolumeSetting,
  type VolumeSetting,
} from "@/lib/stored-volume-setting";

export const soundEffectsVolumeSetting: VolumeSetting =
  createStoredVolumeSetting({
    storageKey: "pa-zzle.sound-effects-volume.v1",
    legacyEnabledStorageKey: "pa-zzle.sound-effects.v1",
  });

/** 効果音を鳴らす音量か。 */
export function isSoundEffectsEnabled(): boolean {
  return soundEffectsVolumeSetting.getVolume() > 0;
}
