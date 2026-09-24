export const fifteenPuzzleDifficulties = [
  {
    id: "1",
    label: "レベル 1",
    description: "近いタイルから順に滑らせれば揃います",
  },
  {
    id: "2",
    label: "レベル 2",
    description: "ときどき、揃えかけたタイルを一度どかす必要があります",
  },
  {
    id: "3",
    label: "レベル 3",
    description: "タイル同士が道をふさぎ、回り込む順番を考える必要があります",
  },
  {
    id: "4",
    label: "レベル 4",
    description: "何枚ものタイルの退避と送り込みを組み合わせて計画します",
  },
  {
    id: "5",
    label: "レベル 5",
    description: "盤面全体が入り組み、長い先読みで無駄の少ない手順を探します",
  },
] as const;

export type FifteenPuzzleDifficulty =
  (typeof fifteenPuzzleDifficulties)[number]["id"];

export function parseFifteenPuzzleDifficulty(
  value: string | undefined,
): FifteenPuzzleDifficulty | undefined {
  return fifteenPuzzleDifficulties.find((difficulty) => difficulty.id === value)
    ?.id;
}

export function getFifteenPuzzleDifficultyLabel(
  difficulty: FifteenPuzzleDifficulty,
): string {
  return (
    fifteenPuzzleDifficulties.find((option) => option.id === difficulty)
      ?.label ?? difficulty
  );
}
