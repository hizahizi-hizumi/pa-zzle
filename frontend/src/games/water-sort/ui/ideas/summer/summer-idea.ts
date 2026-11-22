import type { WaterSortIdeaOverrides } from "@/games/water-sort/ui/ideas/overrides";
import { SummerClearFinale } from "@/games/water-sort/ui/ideas/summer/SummerClearFinale";
import { SummerGround } from "@/games/water-sort/ui/ideas/summer/SummerGround";
import { SummerPourAnimationLayer } from "@/games/water-sort/ui/ideas/summer/SummerPourAnimationLayer";
import { SummerSoundEffects } from "@/games/water-sort/ui/ideas/summer/SummerSoundEffects";
import { SummerWaterBottle } from "@/games/water-sort/ui/ideas/summer/SummerWaterBottle";

export const summerIdea: WaterSortIdeaOverrides = {
  Ground: SummerGround,
  WaterBottle: SummerWaterBottle,
  PourAnimationLayer: SummerPourAnimationLayer,
  SoundEffects: SummerSoundEffects,
  ClearFinale: SummerClearFinale,
};
