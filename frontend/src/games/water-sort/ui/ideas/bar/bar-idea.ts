import { BarBoardBackdrop } from "@/games/water-sort/ui/ideas/bar/BarBoardBackdrop";
import { BarClearFinale } from "@/games/water-sort/ui/ideas/bar/BarClearFinale";
import { BarGlass } from "@/games/water-sort/ui/ideas/bar/BarGlass";
import { BarGround } from "@/games/water-sort/ui/ideas/bar/BarGround";
import { BarPourAnimationLayer } from "@/games/water-sort/ui/ideas/bar/BarPourAnimationLayer";
import { BarSoundEffects } from "@/games/water-sort/ui/ideas/bar/BarSoundEffects";
import type { WaterSortIdeaOverrides } from "@/games/water-sort/ui/ideas/overrides";

export const barIdea: WaterSortIdeaOverrides = {
  colorScheme: "dark",
  Ground: BarGround,
  BoardBackdrop: BarBoardBackdrop,
  WaterBottle: BarGlass,
  PourAnimationLayer: BarPourAnimationLayer,
  SoundEffects: BarSoundEffects,
  ClearFinale: BarClearFinale,
};
