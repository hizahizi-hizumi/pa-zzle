import { KitchenClearFinale } from "@/games/water-sort/ui/ideas/kitchen/KitchenClearFinale";
import { KitchenGround } from "@/games/water-sort/ui/ideas/kitchen/KitchenGround";
import { KitchenJar } from "@/games/water-sort/ui/ideas/kitchen/KitchenJar";
import { KitchenPourAnimationLayer } from "@/games/water-sort/ui/ideas/kitchen/KitchenPourAnimationLayer";
import { KitchenShelves } from "@/games/water-sort/ui/ideas/kitchen/KitchenShelves";
import { KitchenSoundEffects } from "@/games/water-sort/ui/ideas/kitchen/KitchenSoundEffects";
import type { WaterSortIdeaOverrides } from "@/games/water-sort/ui/ideas/overrides";

/** 初夏の朝の台所で、果実のシロップを果実ごとの瓶に詰め分ける。 */
export const kitchenIdea: WaterSortIdeaOverrides = {
  Ground: KitchenGround,
  BoardBackdrop: KitchenShelves,
  WaterBottle: KitchenJar,
  PourAnimationLayer: KitchenPourAnimationLayer,
  SoundEffects: KitchenSoundEffects,
  ClearFinale: KitchenClearFinale,
};
