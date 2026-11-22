import { AlchemyClearFinale } from "@/games/water-sort/ui/ideas/alchemy/AlchemyClearFinale";
import { AlchemyGround } from "@/games/water-sort/ui/ideas/alchemy/AlchemyGround";
import { AlchemyPourLayer } from "@/games/water-sort/ui/ideas/alchemy/AlchemyPourLayer";
import { AlchemyShelves } from "@/games/water-sort/ui/ideas/alchemy/AlchemyShelves";
import { AlchemySoundEffects } from "@/games/water-sort/ui/ideas/alchemy/AlchemySoundEffects";
import { AlchemyWaterBottle } from "@/games/water-sort/ui/ideas/alchemy/AlchemyWaterBottle";
import type { WaterSortIdeaOverrides } from "@/games/water-sort/ui/ideas/overrides";

/**
 * 錬金術師の工房。夜の工房で、混沌とした霊液を元素ごとに分け、純粋な精に還す（溶かして、固めよ）。
 * 元素どうしは交わらないので、注いでも色は混ざらない。
 */
export const alchemyIdea: WaterSortIdeaOverrides = {
  colorScheme: "dark",
  Ground: AlchemyGround,
  BoardBackdrop: AlchemyShelves,
  WaterBottle: AlchemyWaterBottle,
  PourAnimationLayer: AlchemyPourLayer,
  SoundEffects: AlchemySoundEffects,
  ClearFinale: AlchemyClearFinale,
};
