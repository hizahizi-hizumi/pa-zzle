import type { ParkingJamDifficulty } from "@/games/parking-jam/difficulty";
import type {
  ParkingJamBoard,
  ParkingJamRoadOpening,
  ParkingJamSide,
  ParkingJamVehicle,
} from "@/games/parking-jam/puzzle/board";
import { ParkingJamBoardDefs } from "@/games/parking-jam/ui/board/ParkingJamBoardDefs";
import { ParkingJamCar } from "@/games/parking-jam/ui/board/ParkingJamCar";
import { ParkingJamLot } from "@/games/parking-jam/ui/board/ParkingJamLot";
import { PARKING_JAM_CELL } from "@/games/parking-jam/ui/board/parking-jam-board-geometry";
import { useParkingJamBoardPaint } from "@/games/parking-jam/ui/board/parking-jam-board-paint";

import "@/games/parking-jam/ui/board/parking-jam-board.css";

// 全レベルで同じ4行7列の駐車場を使う。英小文字1字が1台の車で、同じ文字のマスが車の占める範囲になる。
// 上のレベルは下のレベルの車と道路開口をすべて同じ位置に残し、判定に効くレバーを1つずつ強める。
// 依存を強めるときは塞いでいる車の出口側を塞ぐ車を足し、読み違いを強めるときは、どの車の出庫にも
// 使われない隣の車線に開口を足して、出られそうに見えて出られない車を作る。
// 規模のレバーはこの大きさの図では表せないため、全レベルで同じ小さな駐車場のままにする。
type PreviewLevelLayout = {
  vehicles: readonly string[];
  roadOpenings: readonly ParkingJamRoadOpening[];
};

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
    vehicles: [".......", "aa.b...", "cc.b...", "......."],
    roadOpenings: baseRoadOpenings,
  },
  "2": {
    vehicles: [".......", "aa.b...", "cc.b...", "......."],
    roadOpenings: [...baseRoadOpenings, openingBesideVerticalVehicle],
  },
  "3": {
    vehicles: ["..dd...", "aa.b...", "cc.b...", "......."],
    roadOpenings: [...baseRoadOpenings, openingBesideVerticalVehicle],
  },
  "4": {
    vehicles: ["..dd...", "aa.b...", "cc.b...", "......."],
    roadOpenings: [
      ...baseRoadOpenings,
      openingBesideVerticalVehicle,
      openingBesideHorizontalVehicle,
    ],
  },
  "5": {
    vehicles: ["eeddff.", "aa.b...", "cc.b...", "......."],
    roadOpenings: [
      ...baseRoadOpenings,
      openingBesideVerticalVehicle,
      openingBesideHorizontalVehicle,
    ],
  },
} as const satisfies Record<ParkingJamDifficulty, PreviewLevelLayout>;

// 開口のある辺は道路が外へ続いて見える幅を、ない辺は縁石が収まる幅だけを残す。
const PREVIEW_ROAD_MARGIN = 50;
const PREVIEW_CURB_MARGIN = 20;

type PreviewCell = {
  row: number;
  column: number;
};

function toPreviewVehicle(
  id: string,
  cells: readonly PreviewCell[],
): ParkingJamVehicle {
  const [first] = cells;
  const length = cells.length;
  if (!first || (length !== 2 && length !== 3)) {
    throw new RangeError(`Invalid parking jam preview vehicle: ${id}`);
  }
  const horizontal = cells.every(function isSameRow(cell) {
    return cell.row === first.row;
  });
  return {
    id,
    row: Math.min(...cells.map((cell) => cell.row)),
    column: Math.min(...cells.map((cell) => cell.column)),
    orientation: horizontal ? "horizontal" : "vertical",
    length,
  };
}

function toPreviewBoard(layout: PreviewLevelLayout): ParkingJamBoard {
  const cellsByVehicleId = new Map<string, PreviewCell[]>();
  layout.vehicles.forEach(function collectRowCells(rowMarks, row) {
    Array.from(rowMarks).forEach(function collectCell(mark, column) {
      if (mark === ".") return;
      const cells = cellsByVehicleId.get(mark) ?? [];
      cells.push({ row, column });
      cellsByVehicleId.set(mark, cells);
    });
  });

  return {
    width: layout.vehicles[0]?.length ?? 0,
    height: layout.vehicles.length,
    vehicles: [...cellsByVehicleId].map(function toVehicle([id, cells]) {
      return toPreviewVehicle(id, cells);
    }),
    fixedAreas: [],
    roadOpenings: layout.roadOpenings,
  };
}

function createPreviewBoard(difficulty: ParkingJamDifficulty): ParkingJamBoard {
  return toPreviewBoard(previewLevelLayouts[difficulty]);
}

function getPreviewMargin(board: ParkingJamBoard, side: ParkingJamSide) {
  return board.roadOpenings.some((opening) => opening.side === side)
    ? PREVIEW_ROAD_MARGIN
    : PREVIEW_CURB_MARGIN;
}

type ParkingJamDifficultyPreviewProps = {
  difficulty: ParkingJamDifficulty;
};

export function ParkingJamDifficultyPreview({
  difficulty,
}: ParkingJamDifficultyPreviewProps) {
  const board = createPreviewBoard(difficulty);
  const paint = useParkingJamBoardPaint();
  const left = getPreviewMargin(board, "left");
  const top = getPreviewMargin(board, "up");
  const viewWidth =
    board.width * PARKING_JAM_CELL + left + getPreviewMargin(board, "right");
  const viewHeight =
    board.height * PARKING_JAM_CELL + top + getPreviewMargin(board, "down");

  return (
    <span
      aria-hidden="true"
      className="flex h-12 w-32 shrink-0 items-center lg:justify-center"
    >
      <svg
        focusable="false"
        viewBox={`${-left} ${-top} ${viewWidth} ${viewHeight}`}
        className="pointer-events-none h-full w-auto"
      >
        <ParkingJamBoardDefs board={board} paint={paint} />
        <ParkingJamLot board={board} paint={paint} />
        <g clipPath={paint.vehicleSpaceClipPath}>
          {board.vehicles.map((vehicle) => (
            <ParkingJamCar
              key={vehicle.id}
              vehicle={vehicle}
              glassFill={paint.glassFill}
            />
          ))}
        </g>
      </svg>
    </span>
  );
}

export const _private = { createPreviewBoard };
