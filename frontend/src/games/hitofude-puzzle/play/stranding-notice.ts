import type { HitofudePuzzleDifficulty } from "@/games/hitofude-puzzle/difficulty";
import type { HitofudePuzzleBoard } from "@/games/hitofude-puzzle/puzzle/board";
import {
  findHitofudePuzzleStranding,
  isHitofudePuzzleDeadEnd,
} from "@/games/hitofude-puzzle/puzzle/rules";

/**
 * 取り残しを盤面で知らせるレベル（仮決定）。取り残しはこの先の手詰まりを示す補助（SPEC-019）。
 * レベル1〜2 は角・通路・袋小路から道が決まり、先読みは1か所だけなので、失敗が確定した道を長く引き続けないよう知らせる。
 * レベル3 以上は数手先の取り残しを読むことが挑戦なので、知らせると先読みの答えになる。
 */
const strandingNoticeDifficulties: ReadonlySet<HitofudePuzzleDifficulty> =
  new Set(["1", "2"]);

export function showsHitofudePuzzleStranding(
  difficulty: HitofudePuzzleDifficulty,
): boolean {
  return strandingNoticeDifficulties.has(difficulty);
}

/**
 * 取り残し（孤立マス・2つ以上の袋小路・先端から届かないマス）のマスを、盤面の番号順に並べる。
 * 先端が行き止まりのときは、残りのマスがすべて届かなくなり行き止まりの印と同じことを伝えるので、挙げない。
 */
export function listHitofudePuzzleStrandedCells(
  board: HitofudePuzzleBoard,
  path: readonly number[],
): number[] {
  if (isHitofudePuzzleDeadEnd(board, path)) {
    return [];
  }
  const stranding = findHitofudePuzzleStranding(board, path);
  if (stranding === null) {
    return [];
  }
  const cells = new Set([
    ...stranding.isolatedCells,
    ...stranding.deadEndCells,
    ...stranding.separatedCells,
  ]);
  return [...cells].sort((left, right) => left - right);
}
