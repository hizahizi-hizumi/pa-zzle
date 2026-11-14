import { useSyncExternalStore } from "react";

const SHEET_MEDIA_QUERY = "(width < 40rem)";

function subscribeSheetMedia(onChange: () => void): () => void {
  const media = window.matchMedia?.(SHEET_MEDIA_QUERY);
  media?.addEventListener("change", onChange);
  return () => media?.removeEventListener("change", onChange);
}

function readSheetMedia(): boolean {
  return window.matchMedia?.(SHEET_MEDIA_QUERY).matches ?? false;
}

export function useHeaderLayerSheet(): boolean {
  return useSyncExternalStore(subscribeSheetMedia, readSheetMedia);
}
