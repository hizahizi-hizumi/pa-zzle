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

// 全難易度で同じ3行7列の駐車場に、右（上2行）と上（中央2列）の道路開口を置く。
// 英小文字1字が1台の車で、同じ文字のマスが車の占める範囲になる。
// 上のレベルは下のレベルの車をすべて同じ位置に残したまま、その出口側を塞ぐ車を足す。
// easy は全車がそのまま出られ、normal は1台に塞がれた車が増え、
// hard は2台以上に塞がれた車と出口から遠い車が加わる。
const previewRoadOpenings: readonly ParkingJamRoadOpening[] = [
  { side: "right", startOffset: 0, length: 2 },
  { side: "up", startOffset: 2, length: 2 },
];

const previewVehicleLayouts = {
  easy: [".......", "..abcc.", "..ab..."],
  normal: ["ddee...", "..abcc.", "..ab..."],
  hard: ["ddeeff.", "ggabcc.", "..ab..."],
} satisfies Record<ParkingJamDifficulty, readonly string[]>;

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

function toPreviewBoard(layout: readonly string[]): ParkingJamBoard {
  const cellsByVehicleId = new Map<string, PreviewCell[]>();
  layout.forEach(function collectRowCells(rowMarks, row) {
    Array.from(rowMarks).forEach(function collectCell(mark, column) {
      if (mark === ".") return;
      const cells = cellsByVehicleId.get(mark) ?? [];
      cells.push({ row, column });
      cellsByVehicleId.set(mark, cells);
    });
  });

  return {
    width: layout[0]?.length ?? 0,
    height: layout.length,
    vehicles: [...cellsByVehicleId].map(function toVehicle([id, cells]) {
      return toPreviewVehicle(id, cells);
    }),
    fixedAreas: [],
    roadOpenings: previewRoadOpenings,
  };
}

function createPreviewBoard(difficulty: ParkingJamDifficulty): ParkingJamBoard {
  return toPreviewBoard(previewVehicleLayouts[difficulty]);
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

export const _private = { previewVehicleLayouts, createPreviewBoard };
