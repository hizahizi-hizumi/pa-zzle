export const takuzuDifficulties = [
  { id: "1", label: "難易度 1" },
  { id: "2", label: "難易度 2" },
  { id: "3", label: "難易度 3" },
  { id: "4", label: "難易度 4" },
  { id: "5", label: "難易度 5" },
] as const;

export type TakuzuDifficulty = (typeof takuzuDifficulties)[number]["id"];

export function parseTakuzuDifficulty(
  value: string | undefined,
): TakuzuDifficulty | undefined {
  return takuzuDifficulties.find((difficulty) => difficulty.id === value)?.id;
}

export function getTakuzuDifficultyLabel(difficulty: TakuzuDifficulty): string {
  return (
    takuzuDifficulties.find((option) => option.id === difficulty)?.label ??
    difficulty
  );
}
