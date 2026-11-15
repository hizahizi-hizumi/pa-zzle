import type { ComponentType } from "react";
import type { TutorialPlayStart } from "@/components/TutorialOverlay";
import { BridgesHowToPlayDialog } from "@/games/bridges/ui/BridgesHowToPlayDialog";
import { BridgesTutorial } from "@/games/bridges/ui/BridgesTutorial";
import { HitofudePuzzleHowToPlayDialog } from "@/games/hitofude-puzzle/ui/HitofudePuzzleHowToPlayDialog";
import { HitofudePuzzleTutorial } from "@/games/hitofude-puzzle/ui/HitofudePuzzleTutorial";
import { IceFloorMazeHowToPlayDialog } from "@/games/ice-floor-maze/ui/IceFloorMazeHowToPlayDialog";
import { IceFloorMazeTutorial } from "@/games/ice-floor-maze/ui/IceFloorMazeTutorial";
import { MinesweeperHowToPlayDialog } from "@/games/minesweeper/ui/MinesweeperHowToPlayDialog";
import { MinesweeperTutorial } from "@/games/minesweeper/ui/MinesweeperTutorial";
import { NanpureHowToPlayDialog } from "@/games/nanpure/ui/NanpureHowToPlayDialog";
import { NanpureTutorial } from "@/games/nanpure/ui/NanpureTutorial";
import { ParkingJamHowToPlayDialog } from "@/games/parking-jam/ui/ParkingJamHowToPlayDialog";
import { ParkingJamTutorial } from "@/games/parking-jam/ui/ParkingJamTutorial";
import { ReflectionHowToPlayDialog } from "@/games/reflection/ui/ReflectionHowToPlayDialog";
import { ReflectionTutorial } from "@/games/reflection/ui/ReflectionTutorial";
import { SlidePuzzleHowToPlayDialog } from "@/games/slide-puzzle/ui/SlidePuzzleHowToPlayDialog";
import { SlidePuzzleTutorial } from "@/games/slide-puzzle/ui/SlidePuzzleTutorial";
import { TakuzuHowToPlayDialog } from "@/games/takuzu/ui/TakuzuHowToPlayDialog";
import { TakuzuTutorial } from "@/games/takuzu/ui/TakuzuTutorial";
import { TsumeShogiHowToPlayDialog } from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog";
import { TsumeShogiTutorial } from "@/games/tsume-shogi/ui/TsumeShogiTutorial";
import { WaterSortHowToPlayDialog } from "@/games/water-sort/ui/WaterSortHowToPlayDialog";
import { WaterSortTutorial } from "@/games/water-sort/ui/WaterSortTutorial";

type GuideControl = { open: boolean; onClose: () => void };
type TutorialControl = GuideControl & { playStart?: TutorialPlayStart };
type GuideComponents = {
  HowToPlay: ComponentType<GuideControl>;
  Tutorial: ComponentType<TutorialControl>;
};

const guides: Record<string, GuideComponents> = {
  bridges: { HowToPlay: BridgesHowToPlayDialog, Tutorial: BridgesTutorial },
  "hitofude-puzzle": {
    HowToPlay: HitofudePuzzleHowToPlayDialog,
    Tutorial: HitofudePuzzleTutorial,
  },
  "ice-floor-maze": {
    HowToPlay: IceFloorMazeHowToPlayDialog,
    Tutorial: IceFloorMazeTutorial,
  },
  minesweeper: {
    HowToPlay: MinesweeperHowToPlayDialog,
    Tutorial: MinesweeperTutorial,
  },
  nanpure: { HowToPlay: NanpureHowToPlayDialog, Tutorial: NanpureTutorial },
  "parking-jam": {
    HowToPlay: ParkingJamHowToPlayDialog,
    Tutorial: ParkingJamTutorial,
  },
  reflection: {
    HowToPlay: ReflectionHowToPlayDialog,
    Tutorial: ReflectionTutorial,
  },
  "slide-puzzle": {
    HowToPlay: SlidePuzzleHowToPlayDialog,
    Tutorial: SlidePuzzleTutorial,
  },
  takuzu: { HowToPlay: TakuzuHowToPlayDialog, Tutorial: TakuzuTutorial },
  "tsume-shogi": {
    HowToPlay: TsumeShogiHowToPlayDialog,
    Tutorial: TsumeShogiTutorial,
  },
  "water-sort": {
    HowToPlay: WaterSortHowToPlayDialog,
    Tutorial: WaterSortTutorial,
  },
};

export function findGameGuide(gameId: string): GuideComponents | undefined {
  return guides[gameId];
}
