import type { HamiltonianPathDirection } from "@/games/hamiltonian-path/puzzle/board";

const directionByArrowKey: Readonly<Record<string, HamiltonianPathDirection>> =
  {
    ArrowUp: "up",
    ArrowRight: "right",
    ArrowDown: "down",
    ArrowLeft: "left",
  };

/** 矢印キーが指す盤面の向き。矢印キーでなければ `null`。 */
export function findArrowKeyDirection(
  key: string,
): HamiltonianPathDirection | null {
  return directionByArrowKey[key] ?? null;
}
