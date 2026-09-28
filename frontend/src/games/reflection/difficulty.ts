export const reflectionDifficulties = [
  { id: "1", label: "レベル 1" },
  { id: "2", label: "レベル 2" },
  { id: "3", label: "レベル 3" },
  { id: "4", label: "レベル 4" },
  { id: "5", label: "レベル 5" },
] as const;

export type ReflectionDifficulty =
  (typeof reflectionDifficulties)[number]["id"];

export function parseReflectionDifficulty(
  value: string | undefined,
): ReflectionDifficulty | undefined {
  return reflectionDifficulties.find((difficulty) => difficulty.id === value)
    ?.id;
}

export function getReflectionDifficultyLabel(
  difficulty: ReflectionDifficulty,
): string {
  return (
    reflectionDifficulties.find((option) => option.id === difficulty)?.label ??
    difficulty
  );
}
