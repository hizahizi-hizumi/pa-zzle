// 一時の切り替え口: 選んだ試作を、次の問題や結果画面へ移っても保つ。収束のときに消す。
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  type WaterSortLookModule,
  waterSortLooks,
} from "@/games/water-sort/ui/prototypes/registry";

const listeners = new Set<() => void>();
let currentLookId: string | null = readInitialLookId();

function readInitialLookId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const id = new URLSearchParams(window.location.search).get("look");
  return waterSortLooks.some((look) => look.id === id) ? id : null;
}

export function setWaterSortLookId(id: string | null) {
  currentLookId = id;
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useWaterSortLookId(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => currentLookId,
    () => null,
  );
}

const loadedModules = new Map<string, WaterSortLookModule>();

/** 選んだ試作の部品。読み込み中と今の画面のときは null。 */
export function useWaterSortLook(): WaterSortLookModule | null {
  const id = useWaterSortLookId();
  const [, setVersion] = useState(0);

  useEffect(() => {
    if (id === null || loadedModules.has(id)) {
      return;
    }
    const entry = waterSortLooks.find((look) => look.id === id);
    if (!entry) {
      return;
    }
    let cancelled = false;
    void entry.load().then((module) => {
      loadedModules.set(id, module);
      if (!cancelled) {
        setVersion((version) => version + 1);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return id === null ? null : (loadedModules.get(id) ?? null);
}
