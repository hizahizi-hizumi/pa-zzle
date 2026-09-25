export const slidePuzzleDifficulties = [
  {
    id: "1",
    label: "レベル 1",
    description: "小さな盤面で、ときどき回り込みながら揃えます",
  },
  {
    id: "2",
    label: "レベル 2",
    description:
      "盤面が広がり、ときどき揃えかけたタイルを一度どかす必要があります",
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
    description:
      "広い盤面を見渡し、外側から順に小さな盤面へ落とし込みながら、入り組んだ手順を読みます",
  },
] as const;

export type SlidePuzzleDifficulty =
  (typeof slidePuzzleDifficulties)[number]["id"];

export function parseSlidePuzzleDifficulty(
  value: string | undefined,
): SlidePuzzleDifficulty | undefined {
  return slidePuzzleDifficulties.find((difficulty) => difficulty.id === value)
    ?.id;
}

export function getSlidePuzzleDifficultyLabel(
  difficulty: SlidePuzzleDifficulty,
): string {
  return (
    slidePuzzleDifficulties.find((option) => option.id === difficulty)?.label ??
    difficulty
  );
}
