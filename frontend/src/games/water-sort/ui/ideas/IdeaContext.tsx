import { createContext, useContext } from "react";

import type { WaterSortIdeaId } from "@/games/water-sort/ui/ideas/idea";
import type { WaterSortIdeaOverrides } from "@/games/water-sort/ui/ideas/overrides";

export type WaterSortIdeaContextValue = {
  idea: WaterSortIdeaId;
  overrides: WaterSortIdeaOverrides;
  setIdea: (idea: WaterSortIdeaId) => void;
};

/**
 * 提供されていない所（チュートリアル・遊び方）は今の画面のまま。
 * 案の部品がこの文脈を読むので、案の一覧（registry）はここから import しない。
 */
export const WaterSortIdeaContext = createContext<WaterSortIdeaContextValue>({
  idea: "current",
  overrides: {},
  setIdea: () => {},
});

export function useWaterSortIdea() {
  return useContext(WaterSortIdeaContext);
}
