/**
 * BGM の音量の設定。効果音の音量とは別に選べる。全ゲームで共通にし、端末に保存して次に開いたときも引き継ぐ。
 * 0 は流さない。
 *
 * React からは `useSyncExternalStore(backgroundMusicVolumeSetting.subscribe, backgroundMusicVolumeSetting.getVolume)` で読む。
 */

import {
  createStoredVolumeSetting,
  type VolumeSetting,
} from "@/lib/stored-volume-setting";

export const backgroundMusicVolumeSetting: VolumeSetting =
  createStoredVolumeSetting({
    storageKey: "pa-zzle.background-music-volume.v1",
    legacyEnabledStorageKey: "pa-zzle.background-music.v1",
  });

/** BGM を流す音量か。 */
export function isBackgroundMusicEnabled(): boolean {
  return backgroundMusicVolumeSetting.getVolume() > 0;
}
