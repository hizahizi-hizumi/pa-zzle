/**
 * 端末に保存する、オンかオフかの設定。全ゲームで共通にし、次に開いたときも引き継ぐ。
 * はじめはオン。保存した値を読めないときもオンにする。
 *
 * 設定ごとに `createStoredEnabledSetting` で一つ作り、その設定のモジュールが関数として公開する。
 * React からは `useSyncExternalStore(subscribe, isEnabled)` で読む。
 */

import { isRecordObject } from "@/lib/type-guards";

const DEFAULT_ENABLED = true;

type SettingStorage = Pick<Storage, "getItem" | "setItem">;

type StoredEnabledSetting = {
  enabled: boolean;
};

export type EnabledSetting = {
  isEnabled: () => boolean;
  /** オンかオフかを選び、端末に保存する。 */
  setEnabled: (next: boolean) => void;
  /** 設定が変わったら `onChange` を呼ぶ。別のタブで変えたときも呼ぶ。購読をやめる関数を返す。 */
  subscribe: (onChange: () => void) => () => void;
};

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

function readEnabled(
  storageKey: string,
  storage: SettingStorage | null,
): boolean {
  if (!storage) {
    return DEFAULT_ENABLED;
  }

  try {
    const stored = storage.getItem(storageKey);
    if (!stored) {
      return DEFAULT_ENABLED;
    }

    const parsed: unknown = JSON.parse(stored);
    return isStoredEnabledSetting(parsed) ? parsed.enabled : DEFAULT_ENABLED;
  } catch {
    return DEFAULT_ENABLED;
  }
}

function isStoredEnabledSetting(value: unknown): value is StoredEnabledSetting {
  return isRecordObject(value) && typeof value.enabled === "boolean";
}

function writeEnabled(
  storageKey: string,
  next: boolean,
  storage: SettingStorage | null,
): void {
  if (!storage) {
    return;
  }

  const setting: StoredEnabledSetting = { enabled: next };
  try {
    storage.setItem(storageKey, JSON.stringify(setting));
  } catch {
    // 保存できない端末でも、開いている間は選んだ設定に従う。
  }
}

/** `storageKey` に保存する、オンかオフかの設定を作る。 */
export function createStoredEnabledSetting(storageKey: string): EnabledSetting {
  let enabled: boolean | null = null;
  const listeners = new Set<() => void>();

  function isEnabled(): boolean {
    enabled ??= readEnabled(storageKey, getDefaultStorage());
    return enabled;
  }

  function setEnabled(next: boolean): void {
    writeEnabled(storageKey, next, getDefaultStorage());
    if (enabled === next) {
      return;
    }

    enabled = next;
    notifyListeners();
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
    if (event.key !== null && event.key !== storageKey) {
      return;
    }

    const next = readEnabled(storageKey, getDefaultStorage());
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

  return { isEnabled, setEnabled, subscribe };
}
