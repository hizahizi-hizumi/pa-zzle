/**
 * 効果音を鳴らすかどうかの設定。全ゲームで共通にし、端末に保存して次に開いたときも引き継ぐ。
 * はじめは鳴らす。保存した値を読めないときも鳴らす。
 *
 * React からは `useSyncExternalStore(subscribeSoundEffectsEnabled, isSoundEffectsEnabled)` で読む。
 */

import { isRecordObject } from "@/lib/type-guards";

const SOUND_EFFECTS_SETTING_STORAGE_KEY = "pa-zzle.sound-effects.v1";
const DEFAULT_SOUND_EFFECTS_ENABLED = true;

type SoundEffectsSettingStorage = Pick<Storage, "getItem" | "setItem">;

type StoredSoundEffectsSetting = {
  enabled: boolean;
};

let enabled: boolean | null = null;
const listeners = new Set<() => void>();

function getDefaultStorage(): SoundEffectsSettingStorage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readSoundEffectsEnabled(
  storage: SoundEffectsSettingStorage | null,
): boolean {
  if (!storage) {
    return DEFAULT_SOUND_EFFECTS_ENABLED;
  }

  try {
    const stored = storage.getItem(SOUND_EFFECTS_SETTING_STORAGE_KEY);
    if (!stored) {
      return DEFAULT_SOUND_EFFECTS_ENABLED;
    }

    const parsed: unknown = JSON.parse(stored);
    return isStoredSoundEffectsSetting(parsed)
      ? parsed.enabled
      : DEFAULT_SOUND_EFFECTS_ENABLED;
  } catch {
    return DEFAULT_SOUND_EFFECTS_ENABLED;
  }
}

function isStoredSoundEffectsSetting(
  value: unknown,
): value is StoredSoundEffectsSetting {
  return isRecordObject(value) && typeof value.enabled === "boolean";
}

function writeSoundEffectsEnabled(
  next: boolean,
  storage: SoundEffectsSettingStorage | null,
): void {
  if (!storage) {
    return;
  }

  const setting: StoredSoundEffectsSetting = { enabled: next };
  try {
    storage.setItem(SOUND_EFFECTS_SETTING_STORAGE_KEY, JSON.stringify(setting));
  } catch {
    // 保存できない端末でも、開いている間は選んだ設定に従う。
  }
}

/** 効果音を鳴らす設定か。 */
export function isSoundEffectsEnabled(): boolean {
  enabled ??= readSoundEffectsEnabled(getDefaultStorage());
  return enabled;
}

/** 効果音を鳴らすかどうかを選び、端末に保存する。 */
export function setSoundEffectsEnabled(next: boolean): void {
  writeSoundEffectsEnabled(next, getDefaultStorage());
  if (enabled === next) {
    return;
  }

  enabled = next;
  notifyListeners();
}

/** 設定が変わったら `onChange` を呼ぶ。別のタブで変えたときも呼ぶ。購読をやめる関数を返す。 */
export function subscribeSoundEffectsEnabled(onChange: () => void): () => void {
  if (listeners.size === 0) {
    window.addEventListener("storage", handleStorage);
  }
  listeners.add(onChange);

  return function unsubscribe() {
    listeners.delete(onChange);
    if (listeners.size === 0) {
      window.removeEventListener("storage", handleStorage);
    }
  };
}

function handleStorage(event: StorageEvent) {
  if (event.key !== null && event.key !== SOUND_EFFECTS_SETTING_STORAGE_KEY) {
    return;
  }

  const next = readSoundEffectsEnabled(getDefaultStorage());
  if (enabled === next) {
    return;
  }
  enabled = next;
  notifyListeners();
}

function notifyListeners() {
  for (const listener of listeners) {
    listener();
  }
}
