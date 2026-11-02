import { useSyncExternalStore } from "react";

/**
 * チュートリアルで手を引いている間の見せ方。見比べるための確かめ用の切り替え。
 * - `board`: 盤面のうち次に押す所と決め手のほかを沈める（`TutorialSubduable`）。
 * - `screen`: 画面全体に覆いを重ね、次に押す所・決め手・一言だけを抜いて見せる（`TutorialFocusScrim`）。
 *
 * URL の `?focus=board` / `?focus=screen` か、画面の切り替えで選ぶ。選んだものは端末に覚える。何も選んでいなければ `board`。
 */
export type TutorialFocusMode = "board" | "screen";

const STORAGE_KEY = "pa-zzle.tutorial-focus-mode.v1";
const QUERY_KEY = "focus";
const DEFAULT_MODE: TutorialFocusMode = "board";

let mode: TutorialFocusMode | null = null;
const listeners = new Set<() => void>();

function parseMode(value: string | null | undefined): TutorialFocusMode | null {
  return value === "board" || value === "screen" ? value : null;
}

function readQueryMode(): TutorialFocusMode | null {
  try {
    return parseMode(
      new URLSearchParams(window.location.search).get(QUERY_KEY),
    );
  } catch {
    return null;
  }
}

function readStoredMode(): TutorialFocusMode | null {
  try {
    return parseMode(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function storeMode(next: TutorialFocusMode): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // 覚えられない環境では、開いている間だけ切り替える。
  }
}

export function getTutorialFocusMode(): TutorialFocusMode {
  if (mode === null) {
    if (typeof window === "undefined") {
      return DEFAULT_MODE;
    }
    const queryMode = readQueryMode();
    if (queryMode !== null) {
      storeMode(queryMode);
    }
    mode = queryMode ?? readStoredMode() ?? DEFAULT_MODE;
  }
  return mode;
}

export function setTutorialFocusMode(next: TutorialFocusMode): void {
  mode = next;
  storeMode(next);
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTutorialFocusMode(): TutorialFocusMode {
  return useSyncExternalStore(
    subscribe,
    getTutorialFocusMode,
    () => DEFAULT_MODE,
  );
}
