const storageKey = "pa-zzle.game-selection-order.v1";
const hiddenStorageKey = "pa-zzle.hidden-game-ids.v1";
const defaultOrder: readonly string[] = [];
const defaultHiddenIds: readonly string[] = [];
const listeners = new Set<() => void>();
let currentOrder: readonly string[] | null = null;
let currentHiddenIds: readonly string[] | null = null;

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

function readHiddenIds(): readonly string[] {
  try {
    const stored = window.localStorage.getItem(hiddenStorageKey);
    if (stored === null) return defaultHiddenIds;
    const parsed: unknown = JSON.parse(stored);
    return isGameIdList(parsed) ? parsed : defaultHiddenIds;
  } catch {
    return defaultHiddenIds;
  }
}

function getHiddenSnapshot(): readonly string[] {
  currentHiddenIds ??= readHiddenIds();
  return currentHiddenIds;
}

function getSnapshot(): readonly string[] {
  currentOrder ??= readOrder();
  return currentOrder;
}

function notify(): void {
  for (const listener of listeners) listener();
}

function onStorage(event: StorageEvent): void {
  if (
    event.key !== storageKey &&
    event.key !== hiddenStorageKey &&
    event.key !== null
  )
    return;
  if (event.key === storageKey || event.key === null)
    currentOrder = readOrder();
  if (event.key === hiddenStorageKey || event.key === null)
    currentHiddenIds = readHiddenIds();
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

function visibleGameIds(
  orderedGameIds: readonly string[],
  hiddenGameIds: readonly string[],
): string[] {
  const hidden = new Set(hiddenGameIds);
  const visible = orderedGameIds.filter((id) => !hidden.has(id));
  return visible.length > 0 ? visible : orderedGameIds.slice(0, 1);
}

function setGameHidden(
  gameId: string,
  hidden: boolean,
  availableGameIds: readonly string[],
): void {
  if (!availableGameIds.includes(gameId)) return;
  const next = new Set(getHiddenSnapshot());
  if (hidden) {
    if (visibleGameIds(availableGameIds, [...next]).length <= 1) return;
    next.add(gameId);
  } else {
    next.delete(gameId);
  }
  currentHiddenIds = [...next];
  try {
    if (currentHiddenIds.length === 0) {
      window.localStorage.removeItem(hiddenStorageKey);
    } else {
      window.localStorage.setItem(
        hiddenStorageKey,
        JSON.stringify(currentHiddenIds),
      );
    }
  } catch {
    // 保存できない環境でも、今開いている画面では表示設定を反映する。
  }
  notify();
}

function showAllGames(): void {
  currentHiddenIds = defaultHiddenIds;
  try {
    window.localStorage.removeItem(hiddenStorageKey);
  } catch {
    // 保存できない環境でも、今開いている画面では表示設定を反映する。
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
  getHiddenSnapshot,
  subscribe,
  setOrder,
  restoreDefault,
  sortGameIds,
  visibleGameIds,
  setGameHidden,
  showAllGames,
};

export const _private = {
  isGameIdList,
  resetCache() {
    currentOrder = null;
    currentHiddenIds = null;
    notify();
  },
};
