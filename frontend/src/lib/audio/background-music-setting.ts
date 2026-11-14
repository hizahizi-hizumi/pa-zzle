import {
  createStoredVolumeSetting,
  type VolumeSetting,
} from "@/lib/audio/stored-volume-setting";

export const backgroundMusicVolumeSetting: VolumeSetting =
  createStoredVolumeSetting({
    storageKey: "pa-zzle.background-music-volume.v1",
    legacyEnabledStorageKey: "pa-zzle.background-music.v1",
  });

export function isBackgroundMusicEnabled(): boolean {
  return backgroundMusicVolumeSetting.getVolume() > 0;
}
