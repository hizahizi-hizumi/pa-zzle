import type { WaterSortArt } from "@/games/water-sort/ui/art/water-sort-art";
import { LabPourImpact } from "@/games/water-sort/ui/board/pour/PourAnimationLayer/PourDestination/PourImpact/LabPourImpact";
import {
  getReagentFill,
  getReagentStreamFill,
  getReagentSurfaceShade,
} from "@/games/water-sort/ui/board/test-tube/reagent";
import { LabTestTube } from "@/games/water-sort/ui/board/test-tube/TestTube/LabTestTube";
import { TestTubeRackScene } from "@/games/water-sort/ui/board/WaterSortBoard/TestTubeRack/TestTubeRackScene";
import { LabGround } from "@/games/water-sort/ui/WaterSortGround/LabGround";
import { LabStyleFigureGround } from "@/games/water-sort/ui/WaterSortHowToPlayDialog/LabFigureGround/LabStyleFigureGround";

export const labArt: WaterSortArt = {
  TestTube: LabTestTube,
  RackScene: TestTubeRackScene,
  Ground: LabGround,
  FigureGround: LabStyleFigureGround,
  PourImpact: LabPourImpact,
  reagent: {
    fill: getReagentFill,
    streamFill: getReagentStreamFill,
    surfaceShade: getReagentSurfaceShade,
  },
};
