import { useSyncExternalStore } from "react";

/** 見出しの並びから開く層を、画面の下から出すシートで出す画面幅。より広い幅では、ボタンから出すポップオーバーで出す。 */
const SHEET_MEDIA_QUERY = "(width < 40rem)";

function subscribeSheetMedia(onChange: () => void): () => void {
  const media = window.matchMedia?.(SHEET_MEDIA_QUERY);
  media?.addEventListener("change", onChange);
  return () => media?.removeEventListener("change", onChange);
}

function readSheetMedia(): boolean {
  return window.matchMedia?.(SHEET_MEDIA_QUERY).matches ?? false;
}

/** 見出しの並びから開く層（絞り込み・成績）を、今の画面幅でシートとして出すか。 */
export function useHeaderLayerSheet(): boolean {
  return useSyncExternalStore(subscribeSheetMedia, readSheetMedia);
}
