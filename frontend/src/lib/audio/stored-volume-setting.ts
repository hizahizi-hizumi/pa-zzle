import { isRecordObject } from "@/lib/type-guards";

export const MAX_VOLUME = 10;
export const DEFAULT_VOLUME = 5;

type SettingStorage = Pick<Storage, "getItem" | "setItem">;

type StoredVolumeSetting = {
  volume: number;
  // 0 にする前に決めた音量。
  unmutedVolume: number;
};

type LegacyStoredEnabledSetting = {
  enabled: boolean;
};

const DEFAULT_SETTING: StoredVolumeSetting = {
  volume: DEFAULT_VOLUME,
  unmutedVolume: DEFAULT_VOLUME,
};

type StoredVolumeSettingOptions = {
  storageKey: string;
  legacyEnabledStorageKey: string;
};

export type VolumeSetting = {
  getVolume: () => number;
  /** スライダーを動かしている途中の値を渡してよい。 */
  setVolume: (next: number) => void;
  /** スライダーを離したときや、キーで動かしたときに呼ぶ。 */
  commitVolume: (next: number) => void;
  toggleMuted: () => void;
  subscribe: (onChange: () => void) => () => void;
};

export function getVolumeGain(volume: number, maxGain: number): number {
  // 耳は音の大きさを比で感じるので、スライダーの位置が音量の感じ方とおおよそ揃うよう、音量の二乗に比例させる
  // （音量が半分の `DEFAULT_VOLUME` で -12 dB）。
  return maxGain * (volume / MAX_VOLUME) ** 2;
}

function toVolume(value: number): number {
  return Math.min(MAX_VOLUME, Math.max(0, Math.round(value)));
}

function getDefaultStorage(): SettingStorage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readSetting(
  { storageKey, legacyEnabledStorageKey }: StoredVolumeSettingOptions,
  storage: SettingStorage | null,
): StoredVolumeSetting {
  if (!storage) {
    return DEFAULT_SETTING;
  }

  try {
    const stored = storage.getItem(storageKey);
    if (stored === null) {
      return readLegacyEnabledSetting(legacyEnabledStorageKey, storage);
    }

    const parsed: unknown = JSON.parse(stored);
    return isStoredVolumeSetting(parsed) ? parsed : DEFAULT_SETTING;
  } catch {
    return DEFAULT_SETTING;
  }
}

function readLegacyEnabledSetting(
  storageKey: string,
  storage: SettingStorage,
): StoredVolumeSetting {
  const stored = storage.getItem(storageKey);
  if (stored === null) {
    return DEFAULT_SETTING;
  }

  const parsed: unknown = JSON.parse(stored);
  if (isLegacyStoredEnabledSetting(parsed) && !parsed.enabled) {
    return { volume: 0, unmutedVolume: DEFAULT_VOLUME };
  }
  return DEFAULT_SETTING;
}

function isStoredVolumeSetting(value: unknown): value is StoredVolumeSetting {
  return (
    isRecordObject(value) &&
    isVolume(value.volume) &&
    isVolume(value.unmutedVolume) &&
    value.unmutedVolume > 0
  );
}

function isVolume(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_VOLUME
  );
}

function isLegacyStoredEnabledSetting(
  value: unknown,
): value is LegacyStoredEnabledSetting {
  return isRecordObject(value) && typeof value.enabled === "boolean";
}

function writeSetting(
  storageKey: string,
  setting: StoredVolumeSetting,
  storage: SettingStorage | null,
): void {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(storageKey, JSON.stringify(setting));
  } catch {
    // 保存できない端末でも、開いている間は選んだ音量に従う。
  }
}

export function createStoredVolumeSetting(
  options: StoredVolumeSettingOptions,
): VolumeSetting {
  let setting: StoredVolumeSetting | null = null;
  const listeners = new Set<() => void>();

  function getSetting(): StoredVolumeSetting {
    setting ??= readSetting(options, getDefaultStorage());
    return setting;
  }

  function getVolume(): number {
    return getSetting().volume;
  }

  function setVolume(next: number): void {
    changeSetting({ ...getSetting(), volume: toVolume(next) });
  }

  function commitVolume(next: number): void {
    const volume = toVolume(next);
    const { unmutedVolume } = getSetting();
    changeSetting({
      volume,
      unmutedVolume: volume > 0 ? volume : unmutedVolume,
    });
  }

  function toggleMuted(): void {
    const { volume, unmutedVolume } = getSetting();
    changeSetting(
      volume > 0
        ? { volume: 0, unmutedVolume: volume }
        : { volume: unmutedVolume, unmutedVolume },
    );
  }

  function changeSetting(next: StoredVolumeSetting) {
    writeSetting(options.storageKey, next, getDefaultStorage());
    const changed = getSetting().volume !== next.volume;
    setting = next;
    if (changed) {
      notifyListeners();
    }
  }

  function subscribe(onChange: () => void): () => void {
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
    if (event.key !== null && event.key !== options.storageKey) {
      return;
    }

    const next = readSetting(options, getDefaultStorage());
    const changed = getSetting().volume !== next.volume;
    setting = next;
    if (changed) {
      notifyListeners();
    }
  }

  function notifyListeners() {
    for (const listener of listeners) {
      listener();
    }
  }

  return { getVolume, setVolume, commitVolume, toggleMuted, subscribe };
}
