import { LabBoardBackdrop } from "@/games/water-sort/ui/ideas/lab/LabBoardBackdrop";
import { LabClearFinale } from "@/games/water-sort/ui/ideas/lab/LabClearFinale";
import { LabGround } from "@/games/water-sort/ui/ideas/lab/LabGround";
import { LabPourAnimationLayer } from "@/games/water-sort/ui/ideas/lab/LabPourAnimationLayer";
import { LabSoundEffects } from "@/games/water-sort/ui/ideas/lab/LabSoundEffects";
import { LabWaterBottle } from "@/games/water-sort/ui/ideas/lab/LabWaterBottle";
import type { WaterSortIdeaOverrides } from "@/games/water-sort/ui/ideas/overrides";

export const labIdea: WaterSortIdeaOverrides = {
  Ground: LabGround,
  BoardBackdrop: LabBoardBackdrop,
  WaterBottle: LabWaterBottle,
  PourAnimationLayer: LabPourAnimationLayer,
  SoundEffects: LabSoundEffects,
  ClearFinale: LabClearFinale,
};
