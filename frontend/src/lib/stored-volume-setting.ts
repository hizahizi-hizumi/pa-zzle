/**
 * 端末に保存する音量の設定。全ゲームで共通にし、次に開いたときも引き継ぐ。
 * 音量は 0〜`MAX_VOLUME` の整数で、0 は鳴らさない。はじめは `DEFAULT_VOLUME` にし、保存した値を読めないときも `DEFAULT_VOLUME` にする。
 * 消音して 0 にしても、消音を戻したときに元の音量で鳴らせるよう、0 にする前に決めた音量を覚えておく。
 *
 * 設定ごとに `createStoredVolumeSetting` で一つ作り、その設定のモジュールが公開する。
 * React からは `useSyncExternalStore(setting.subscribe, setting.getVolume)` で読む。
 */

import { isRecordObject } from "@/lib/type-guards";

export const MAX_VOLUME = 10;
export const DEFAULT_VOLUME = 5;

type SettingStorage = Pick<Storage, "getItem" | "setItem">;

type StoredVolumeSetting = {
  volume: number;
  /** 消音を戻すときの音量。0 より大きい。 */
  unmutedVolume: number;
};

/** 音量を選べるようにする前の、鳴らすかどうかだけの設定。 */
type StoredEnabledSetting = {
  enabled: boolean;
};

const DEFAULT_SETTING: StoredVolumeSetting = {
  volume: DEFAULT_VOLUME,
  unmutedVolume: DEFAULT_VOLUME,
};

type StoredVolumeSettingOptions = {
  storageKey: string;
  /**
   * 音量を選べるようにする前の、鳴らすかどうかだけを保存していたキー。
   * 音量をまだ保存していない端末では、鳴らさない設定を 0、鳴らす設定を `DEFAULT_VOLUME` として読み替える。
   */
  legacyEnabledStorageKey: string;
};

export type VolumeSetting = {
  /** 今の音量。0 は鳴らさない。 */
  getVolume: () => number;
  /** 音量を変え、端末に保存する。スライダーを動かしている途中の値を渡してよい。 */
  setVolume: (next: number) => void;
  /**
   * 利用者が選び終えた音量に変え、端末に保存する。0 より大きければ、消音を戻すときの音量として覚える。
   * スライダーを離したときや、キーで動かしたときに呼ぶ。
   */
  commitVolume: (next: number) => void;
  /** 鳴らしていれば消音し、消音していれば 0 にする前に選んでいた音量へ戻す。 */
  toggleMuted: () => void;
  /** 音量が変わったら `onChange` を呼ぶ。別のタブで変えたときも呼ぶ。購読をやめる関数を返す。 */
  subscribe: (onChange: () => void) => () => void;
};

/**
 * 音量を、出口の GainNode に掛ける大きさにする。`maxGain` は音量が `MAX_VOLUME` のときの大きさ。
 * 耳は音の大きさを比で感じるので、スライダーの位置が音量の感じ方とおおよそ揃うよう、音量の二乗に比例させる
 * （音量が半分の `DEFAULT_VOLUME` で -12 dB）。
 */
export function getVolumeGain(volume: number, maxGain: number): number {
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
  if (isStoredEnabledSetting(parsed) && !parsed.enabled) {
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

function isStoredEnabledSetting(value: unknown): value is StoredEnabledSetting {
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

/** 端末に保存する音量の設定を作る。 */
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
