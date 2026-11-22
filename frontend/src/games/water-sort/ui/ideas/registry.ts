import { alchemyIdea } from "@/games/water-sort/ui/ideas/alchemy/alchemy-idea";
import { barIdea } from "@/games/water-sort/ui/ideas/bar/bar-idea";
import { futureIdea } from "@/games/water-sort/ui/ideas/future/future-idea";
import type { WaterSortIdeaId } from "@/games/water-sort/ui/ideas/idea";
import { kitchenIdea } from "@/games/water-sort/ui/ideas/kitchen/kitchen-idea";
import { labIdea } from "@/games/water-sort/ui/ideas/lab/lab-idea";
import type { WaterSortIdeaOverrides } from "@/games/water-sort/ui/ideas/overrides";
import { summerIdea } from "@/games/water-sort/ui/ideas/summer/summer-idea";

export const WATER_SORT_IDEA_OVERRIDES: Record<
  WaterSortIdeaId,
  WaterSortIdeaOverrides
> = {
  current: {},
  lab: labIdea,
  alchemy: alchemyIdea,
  kitchen: kitchenIdea,
  future: futureIdea,
  summer: summerIdea,
  bar: barIdea,
};
