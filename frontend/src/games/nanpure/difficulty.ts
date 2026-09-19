export const nanpureDifficulties = [
  {
    id: "easy",
    label: "かんたん",
  },
  {
    id: "normal",
    label: "ふつう",
  },
  {
    id: "hard",
    label: "むずかしい",
  },
] as const;

export type NanpureDifficulty = (typeof nanpureDifficulties)[number]["id"];

export function parseNanpureDifficulty(
  value: string | undefined,
): NanpureDifficulty | undefined {
  return nanpureDifficulties.find((difficulty) => difficulty.id === value)?.id;
}

export function getNanpureDifficultyLabel(
  difficulty: NanpureDifficulty,
): string {
  return (
    nanpureDifficulties.find((option) => option.id === difficulty)?.label ??
    difficulty
  );
}
