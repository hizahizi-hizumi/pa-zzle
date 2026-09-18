export const sudokuDifficulties = [
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

export type SudokuDifficulty = (typeof sudokuDifficulties)[number]["id"];

export function parseSudokuDifficulty(
  value: string | undefined,
): SudokuDifficulty | undefined {
  return sudokuDifficulties.find((difficulty) => difficulty.id === value)?.id;
}

export function getSudokuDifficultyLabel(difficulty: SudokuDifficulty): string {
  return (
    sudokuDifficulties.find((option) => option.id === difficulty)?.label ??
    difficulty
  );
}
