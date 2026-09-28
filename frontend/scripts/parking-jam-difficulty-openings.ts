/**
 * 依存構造を変えずに「読み違いの誘発」だけを動かす、調査用の道路開口の変換。
 * 右・左の開口は同じ行の横向きの車、上・下の開口は同じ列の縦向きの車の出庫にしか効かないので、
 * そうした車がいない車線の開口を足しても削っても、どの車がいつ出せるかは変わらない。
 * 本番生成器には入れていない（採用するなら生成器版の更新が要る）。
 */
import type {
  ParkingJamBoard,
  ParkingJamRoadOpening,
  ParkingJamSide,
} from "@/games/parking-jam/puzzle/board";
import { type ProblemRandom, shuffleProblemValues } from "@/games/problem-seed";

const sides: readonly ParkingJamSide[] = ["up", "right", "down", "left"];

function laneCount(board: ParkingJamBoard, side: ParkingJamSide): number {
  return side === "left" || side === "right" ? board.height : board.width;
}

/** その辺のその車線の開口で出庫できる車が盤面にあるか。 */
function isLaneUsed(
  board: ParkingJamBoard,
  side: ParkingJamSide,
  lane: number,
): boolean {
  return board.vehicles.some((vehicle) =>
    side === "left" || side === "right"
      ? vehicle.orientation === "horizontal" && vehicle.row === lane
      : vehicle.orientation === "vertical" && vehicle.column === lane,
  );
}

function openingsOverlapOrTouch(
  left: ParkingJamRoadOpening,
  right: ParkingJamRoadOpening,
): boolean {
  if (left.side !== right.side) return false;
  return (
    left.startOffset <= right.startOffset + right.length &&
    right.startOffset <= left.startOffset + left.length
  );
}

/**
 * 使われていない車線に、既存の車の車線と1車線ずれて接する開口を足す。
 * 足した開口は既存の開口と重ならず接しない。足せる候補がなければ元の盤面を返す。
 */
export function addDecoyOpenings(
  board: ParkingJamBoard,
  count: number,
  span: number,
  random: ProblemRandom,
): ParkingJamBoard {
  const openings = [...board.roadOpenings];
  const candidates: ParkingJamRoadOpening[] = [];
  for (const side of sides)
    for (const length of [span, 1])
      for (
        let startOffset = 0;
        startOffset + length <= laneCount(board, side);
        startOffset += 1
      ) {
        const lanes = Array.from(
          { length },
          (_, offset) => startOffset + offset,
        );
        if (lanes.some((lane) => isLaneUsed(board, side, lane))) continue;
        const touchesUsedLane =
          isLaneUsed(board, side, startOffset - 1) ||
          isLaneUsed(board, side, startOffset + length);
        if (!touchesUsedLane) continue;
        candidates.push({ side, startOffset, length });
      }
  for (const candidate of shuffleProblemValues(candidates, random)) {
    if (openings.length - board.roadOpenings.length >= count) break;
    if (openings.some((opening) => openingsOverlapOrTouch(opening, candidate)))
      continue;
    openings.push(candidate);
  }
  return { ...board, roadOpenings: openings };
}

/** どの車の出庫にも使われない開口を取り除く（読み違いの誘発を減らす）。 */
export function removeUnusedOpenings(board: ParkingJamBoard): ParkingJamBoard {
  return {
    ...board,
    roadOpenings: board.roadOpenings.filter((opening) =>
      Array.from({ length: opening.length }, (_, offset) =>
        isLaneUsed(board, opening.side, opening.startOffset + offset),
      ).some(Boolean),
    ),
  };
}

export function hasSameOpeningsAs(
  board: ParkingJamBoard,
  other: ParkingJamBoard,
): boolean {
  return (
    JSON.stringify(board.roadOpenings) === JSON.stringify(other.roadOpenings)
  );
}
