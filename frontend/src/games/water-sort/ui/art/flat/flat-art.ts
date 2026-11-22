import { FlatFigureGround } from "@/games/water-sort/ui/art/flat/FlatFigureGround";
import { FlatGround } from "@/games/water-sort/ui/art/flat/FlatGround";
import { FlatPourImpact } from "@/games/water-sort/ui/art/flat/FlatPourImpact";
import { FlatRackScene } from "@/games/water-sort/ui/art/flat/FlatRackScene";
import { FlatTestTube } from "@/games/water-sort/ui/art/flat/FlatTestTube";
import {
  getFlatReagentFill,
  getFlatReagentStreamFill,
  getFlatReagentSurfaceShade,
} from "@/games/water-sort/ui/art/flat/flat-reagent";
import type { WaterSortArt } from "@/games/water-sort/ui/art/water-sort-art";

export const flatArt: WaterSortArt = {
  TestTube: FlatTestTube,
  RackScene: FlatRackScene,
  Ground: FlatGround,
  FigureGround: FlatFigureGround,
  PourImpact: FlatPourImpact,
  reagent: {
    fill: getFlatReagentFill,
    streamFill: getFlatReagentStreamFill,
    surfaceShade: getFlatReagentSurfaceShade,
  },
};
