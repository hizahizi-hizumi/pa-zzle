export const minesweeperDifficulties = [
  { id: "1", label: "難易度 1" },
  { id: "2", label: "難易度 2" },
  { id: "3", label: "難易度 3" },
  { id: "4", label: "難易度 4" },
  { id: "5", label: "難易度 5" },
] as const;

export type MinesweeperDifficulty =
  (typeof minesweeperDifficulties)[number]["id"];

export function parseMinesweeperDifficulty(
  value: string | undefined,
): MinesweeperDifficulty | undefined {
  return minesweeperDifficulties.find((difficulty) => difficulty.id === value)
    ?.id;
}
