import type { ParkingJamDifficulty } from "@/games/parking-jam/difficulty";
import type {
  ParkingJamBoard,
  ParkingJamRoadOpening,
} from "@/games/parking-jam/puzzle/board";
import { ParkingJamBoardFigure } from "@/games/parking-jam/ui/board/ParkingJamBoardFigure";
import {
  type ParkingJamBoardNotation,
  parseParkingJamBoardNotation,
} from "@/games/parking-jam/ui/board/parking-jam-board-notation";

// 全レベルで同じ4行7列の駐車場を使う。
// 上のレベルは下のレベルの車と道路開口をすべて同じ位置に残し、判定に効くレバーを1つずつ強める。
// 依存を強めるときは塞いでいる車の出口側を塞ぐ車を足し、読み違いを強めるときは、どの車の出庫にも
// 使われない隣の車線に開口を足して、出られそうに見えて出られない車を作る。
// 規模のレバーはこの大きさの図では表せないため、全レベルで同じ小さな駐車場のままにする。
const baseRoadOpenings: readonly ParkingJamRoadOpening[] = [
  { side: "right", startOffset: 0, length: 3 },
  { side: "up", startOffset: 3, length: 3 },
];
// 縦の b の下側の隣の列にある開口。b が下へ出られそうに見える。
const openingBesideVerticalVehicle: ParkingJamRoadOpening = {
  side: "down",
  startOffset: 2,
  length: 1,
};
// 横の a の左側の隣の行にある開口。a が左へ出られそうに見える。
const openingBesideHorizontalVehicle: ParkingJamRoadOpening = {
  side: "left",
  startOffset: 0,
  length: 1,
};

const previewLevelLayouts = {
  "1": {
    rows: [".......", "aa.b...", "cc.b...", "......."],
    roadOpenings: baseRoadOpenings,
  },
  "2": {
    rows: [".......", "aa.b...", "cc.b...", "......."],
    roadOpenings: [...baseRoadOpenings, openingBesideVerticalVehicle],
  },
  "3": {
    rows: ["..dd...", "aa.b...", "cc.b...", "......."],
    roadOpenings: [...baseRoadOpenings, openingBesideVerticalVehicle],
  },
  "4": {
    rows: ["..dd...", "aa.b...", "cc.b...", "......."],
    roadOpenings: [
      ...baseRoadOpenings,
      openingBesideVerticalVehicle,
      openingBesideHorizontalVehicle,
    ],
  },
  "5": {
    rows: ["eeddff.", "aa.b...", "cc.b...", "......."],
    roadOpenings: [
      ...baseRoadOpenings,
      openingBesideVerticalVehicle,
      openingBesideHorizontalVehicle,
    ],
  },
} as const satisfies Record<ParkingJamDifficulty, ParkingJamBoardNotation>;

function createPreviewBoard(difficulty: ParkingJamDifficulty): ParkingJamBoard {
  return parseParkingJamBoardNotation(previewLevelLayouts[difficulty]);
}

type ParkingJamDifficultyPreviewProps = {
  difficulty: ParkingJamDifficulty;
};

export function ParkingJamDifficultyPreview({
  difficulty,
}: ParkingJamDifficultyPreviewProps) {
  return (
    <span
      aria-hidden="true"
      className="flex h-12 w-full items-center lg:w-32 lg:justify-center"
    >
      <ParkingJamBoardFigure board={createPreviewBoard(difficulty)} />
    </span>
  );
}

export const _private = { createPreviewBoard };
