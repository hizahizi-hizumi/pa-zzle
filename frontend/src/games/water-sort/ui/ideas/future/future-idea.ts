import { FutureBackdrop } from "@/games/water-sort/ui/ideas/future/FutureBackdrop";
import { FutureCell } from "@/games/water-sort/ui/ideas/future/FutureCell";
import { FutureClearFinale } from "@/games/water-sort/ui/ideas/future/FutureClearFinale";
import { FutureGround } from "@/games/water-sort/ui/ideas/future/FutureGround";
import { FuturePourLayer } from "@/games/water-sort/ui/ideas/future/FuturePourLayer";
import { FutureSoundEffects } from "@/games/water-sort/ui/ideas/future/FutureSoundEffects";
import type { WaterSortIdeaOverrides } from "@/games/water-sort/ui/ideas/overrides";

export const futureIdea: WaterSortIdeaOverrides = {
  colorScheme: "dark",
  Ground: FutureGround,
  BoardBackdrop: FutureBackdrop,
  WaterBottle: FutureCell,
  PourAnimationLayer: FuturePourLayer,
  SoundEffects: FutureSoundEffects,
  ClearFinale: FutureClearFinale,
};
