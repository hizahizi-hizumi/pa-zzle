export const tsumeShogiDifficulties = [
  { id: "1", label: "レベル 1" },
  { id: "2", label: "レベル 2" },
  { id: "3", label: "レベル 3" },
  { id: "4", label: "レベル 4" },
  { id: "5", label: "レベル 5" },
] as const;

export type TsumeShogiDifficulty =
  (typeof tsumeShogiDifficulties)[number]["id"];

export function parseTsumeShogiDifficulty(
  value: string | undefined,
): TsumeShogiDifficulty | undefined {
  return tsumeShogiDifficulties.find((difficulty) => difficulty.id === value)
    ?.id;
}

export function getTsumeShogiDifficultyLabel(
  difficulty: TsumeShogiDifficulty,
): string {
  return (
    tsumeShogiDifficulties.find((option) => option.id === difficulty)?.label ??
    difficulty
  );
}
