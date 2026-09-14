export const sudokuDifficulties = [
  {
    id: "easy",
    label: "かんたん",
    description: "基本的な候補の絞り込みで解ける難易度です。",
  },
  {
    id: "normal",
    label: "ふつう",
    description: "複数の考え方を組み合わせる難易度です。",
  },
  {
    id: "hard",
    label: "むずかしい",
    description: "より深い推論が必要になる難易度です。",
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
