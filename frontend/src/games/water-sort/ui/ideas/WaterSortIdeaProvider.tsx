import { type ReactNode, useCallback, useMemo, useState } from "react";
import { WaterSortIdeaContext } from "@/games/water-sort/ui/ideas/IdeaContext";
import {
  isWaterSortIdeaId,
  type WaterSortIdeaId,
} from "@/games/water-sort/ui/ideas/idea";
import { WATER_SORT_IDEA_OVERRIDES } from "@/games/water-sort/ui/ideas/registry";
import { getDefaultStorage } from "@/lib/browser-storage";

const STORAGE_KEY = "pa-zzle:water-sort-idea";
const QUERY_KEY = "idea";

type WaterSortIdeaProviderProps = {
  children: ReactNode;
};

function readInitialIdea(): WaterSortIdeaId {
  if (typeof window === "undefined") {
    return "current";
  }
  const fromQuery = new URLSearchParams(window.location.search).get(QUERY_KEY);
  if (isWaterSortIdeaId(fromQuery)) {
    saveIdea(fromQuery);
    return fromQuery;
  }
  try {
    const stored = getDefaultStorage()?.getItem(STORAGE_KEY);
    return isWaterSortIdeaId(stored) ? stored : "current";
  } catch {
    return "current";
  }
}

function saveIdea(idea: WaterSortIdeaId) {
  try {
    getDefaultStorage()?.setItem(STORAGE_KEY, idea);
  } catch {
    // 保存できなくても、この画面の中では切り替わる。
  }
}

export function WaterSortIdeaProvider({
  children,
}: WaterSortIdeaProviderProps) {
  const [idea, setIdeaState] = useState<WaterSortIdeaId>(readInitialIdea);
  const setIdea = useCallback((next: WaterSortIdeaId) => {
    setIdeaState(next);
    saveIdea(next);
    // 遊び方やチュートリアルから戻る先は今の URL なので、URL の案も合わせる。
    const url = new URL(window.location.href);
    if (url.searchParams.has(QUERY_KEY)) {
      url.searchParams.set(QUERY_KEY, next);
      window.history.replaceState(window.history.state, "", url);
    }
  }, []);
  const value = useMemo(
    () => ({ idea, overrides: WATER_SORT_IDEA_OVERRIDES[idea], setIdea }),
    [idea, setIdea],
  );

  return (
    <WaterSortIdeaContext.Provider value={value}>
      {children}
    </WaterSortIdeaContext.Provider>
  );
}
