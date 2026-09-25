export const takuzuDifficulties = [
  { id: "1", label: "レベル 1" },
  { id: "2", label: "レベル 2" },
  { id: "3", label: "レベル 3" },
  { id: "4", label: "レベル 4" },
  { id: "5", label: "レベル 5" },
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
