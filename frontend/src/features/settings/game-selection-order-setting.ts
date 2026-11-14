const storageKey = "pa-zzle.game-selection-order.v1";
const defaultOrder: readonly string[] = [];
const listeners = new Set<() => void>();
let currentOrder: readonly string[] | null = null;

function isGameIdList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === "string" && item.length > 0) &&
    new Set(value).size === value.length
  );
}

function readOrder(): readonly string[] {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored === null) return defaultOrder;
    const parsed: unknown = JSON.parse(stored);
    return isGameIdList(parsed) ? parsed : defaultOrder;
  } catch {
    return defaultOrder;
  }
}

function getSnapshot(): readonly string[] {
  currentOrder ??= readOrder();
  return currentOrder;
}

function notify(): void {
  for (const listener of listeners) listener();
}

function onStorage(event: StorageEvent): void {
  if (event.key !== storageKey && event.key !== null) return;
  currentOrder = readOrder();
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

function setOrder(gameIds: readonly string[]): void {
  if (!isGameIdList(gameIds)) return;
  currentOrder = [...gameIds];
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(currentOrder));
  } catch {
    // 保存できない環境でも、今開いている画面では並び替えを反映する。
  }
  notify();
}

function restoreDefault(): void {
  currentOrder = defaultOrder;
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // 保存できない環境でも、今開いている画面では初期順に戻す。
  }
  notify();
}

function sortGameIds(
  availableGameIds: readonly string[],
  preferredGameIds: readonly string[],
): string[] {
  const available = new Set(availableGameIds);
  const preferred = preferredGameIds.filter((id) => available.has(id));
  const selected = new Set(preferred);
  return [...selected, ...availableGameIds.filter((id) => !selected.has(id))];
}

export const gameSelectionOrderSetting = {
  getSnapshot,
  subscribe,
  setOrder,
  restoreDefault,
  sortGameIds,
};

export const _private = {
  isGameIdList,
  resetCache() {
    currentOrder = null;
    notify();
  },
};
