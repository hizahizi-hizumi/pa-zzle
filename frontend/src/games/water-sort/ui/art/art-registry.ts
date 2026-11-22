import { useSyncExternalStore } from "react";

import {
  getWaterSortArtStyle,
  subscribeWaterSortArtStyle,
  type WaterSortArtStyle,
} from "@/games/water-sort/ui/art/art-style";
import { flatArt } from "@/games/water-sort/ui/art/flat/flat-art";
import { labArt } from "@/games/water-sort/ui/art/lab-art";
import { realArt } from "@/games/water-sort/ui/art/real/real-art";
import type { WaterSortArt } from "@/games/water-sort/ui/art/water-sort-art";

const WATER_SORT_ARTS: Record<WaterSortArtStyle, WaterSortArt> = {
  lab: labArt,
  flat: flatArt,
  real: realArt,
};

export function useWaterSortArtStyle(): WaterSortArtStyle {
  return useSyncExternalStore(
    subscribeWaterSortArtStyle,
    getWaterSortArtStyle,
    getWaterSortArtStyle,
  );
}

export function useWaterSortArt(): WaterSortArt {
  return WATER_SORT_ARTS[useWaterSortArtStyle()];
}
