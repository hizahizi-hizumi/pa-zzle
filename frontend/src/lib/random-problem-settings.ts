import { isRecordObject } from "@/lib/type-guards";
import type { ZukanProblemStatus } from "@/zukan/zukan-collection";

export const randomProblemStatuses = [
  "untouched",
  "attempted",
  "clear",
  "good",
  "great",
  "perfect",
] as const satisfies readonly ZukanProblemStatus[];

export type RandomProblemStatus = ZukanProblemStatus;

type RandomProblemSettings = {
  global: readonly RandomProblemStatus[];
  overrides: Readonly<Record<string, readonly RandomProblemStatus[]>>;
};

const storageKey = "pa-zzle.random-problem-statuses.v1";
const defaultSettings: RandomProblemSettings = {
  global: randomProblemStatuses,
  overrides: {},
};
let currentSettings: RandomProblemSettings | null = null;
const listeners = new Set<() => void>();

function isStatusList(value: unknown): value is RandomProblemStatus[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((status) =>
      randomProblemStatuses.some((item) => item === status),
    ) &&
    new Set(value).size === value.length
  );
}

function readSettings(): RandomProblemSettings {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored === null) return defaultSettings;
    const parsed: unknown = JSON.parse(stored);
    if (
      !isRecordObject(parsed) ||
      !isStatusList(parsed.global) ||
      !isRecordObject(parsed.overrides)
    ) {
      return defaultSettings;
    }
    const overrides: Record<string, RandomProblemStatus[]> = {};
    for (const [gameId, statuses] of Object.entries(parsed.overrides)) {
      if (isStatusList(statuses)) overrides[gameId] = statuses;
    }
    return { global: parsed.global, overrides };
  } catch {
    return defaultSettings;
  }
}

function getSnapshot(): RandomProblemSettings {
  currentSettings ??= readSettings();
  return currentSettings;
}

function notify(): void {
  for (const listener of listeners) listener();
}

function updateSettings(next: RandomProblemSettings): void {
  currentSettings = next;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  } catch {
    // 保存できない環境でも、この画面を開いている間の選択は保つ。
  }
  notify();
}

function onStorage(event: StorageEvent): void {
  if (event.key !== storageKey && event.key !== null) return;
  currentSettings = readSettings();
  notify();
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0 && typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

function setGlobal(statuses: readonly RandomProblemStatus[]): void {
  if (!isStatusList(statuses)) return;
  updateSettings({ ...getSnapshot(), global: [...statuses] });
}

function setGame(
  gameId: string,
  statuses: readonly RandomProblemStatus[],
): void {
  if (!isStatusList(statuses)) return;
  const settings = getSnapshot();
  updateSettings({
    ...settings,
    overrides: { ...settings.overrides, [gameId]: [...statuses] },
  });
}

function clearGame(gameId: string): void {
  const settings = getSnapshot();
  const overrides = { ...settings.overrides };
  delete overrides[gameId];
  updateSettings({ ...settings, overrides });
}

function getEffective(gameId: string): readonly RandomProblemStatus[] {
  const settings = getSnapshot();
  return settings.overrides[gameId] ?? settings.global;
}

export const randomProblemSettings = {
  getSnapshot,
  subscribe,
  setGlobal,
  setGame,
  clearGame,
  getEffective,
};

export const _private = {
  isStatusList,
  reset() {
    currentSettings = null;
    notify();
  },
};
