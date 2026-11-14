export type BrowserStorage = Pick<Storage, "getItem" | "setItem">;

export function getDefaultStorage(): BrowserStorage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
