import {
  createStoredVolumeSetting,
  type VolumeSetting,
} from "@/lib/audio/stored-volume-setting";

export const soundEffectsVolumeSetting: VolumeSetting =
  createStoredVolumeSetting({
    storageKey: "pa-zzle.sound-effects-volume.v1",
    legacyEnabledStorageKey: "pa-zzle.sound-effects.v1",
  });

export function isSoundEffectsEnabled(): boolean {
  return soundEffectsVolumeSetting.getVolume() > 0;
}
