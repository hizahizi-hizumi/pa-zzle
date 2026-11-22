import { RealFigureGround } from "@/games/water-sort/ui/art/real/RealFigureGround";
import { RealGround } from "@/games/water-sort/ui/art/real/RealGround";
import { RealPourImpact } from "@/games/water-sort/ui/art/real/RealPourImpact";
import { RealRackScene } from "@/games/water-sort/ui/art/real/RealRackScene";
import { RealTestTube } from "@/games/water-sort/ui/art/real/RealTestTube";
import {
  getRealReagentFill,
  getRealReagentStreamFill,
  getRealReagentSurfaceShade,
} from "@/games/water-sort/ui/art/real/real-reagent";
import type { WaterSortArt } from "@/games/water-sort/ui/art/water-sort-art";

/**
 * 写真のように描く理科室。光は左上の奥の窓からの昼の光1つ、視点はほぼ真横からわずかに見下ろす平行投影
 * （水平な円と面は縦 = 奥行き × 0.12）。輪郭の線は引かず、形は面の明るさ・つや・屈折で見せる。
 */
export const realArt: WaterSortArt = {
  TestTube: RealTestTube,
  RackScene: RealRackScene,
  Ground: RealGround,
  FigureGround: RealFigureGround,
  PourImpact: RealPourImpact,
  reagent: {
    fill: getRealReagentFill,
    streamFill: getRealReagentStreamFill,
    surfaceShade: getRealReagentSurfaceShade,
  },
};
