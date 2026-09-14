export const waterSortDifficulties = [
  {
    id: "easy",
    label: "かんたん",
    description: "まずは操作とルールに慣れる難易度です。",
  },
  {
    id: "normal",
    label: "ふつう",
    description: "何手か先を考えながら進める難易度です。",
  },
  {
    id: "hard",
    label: "むずかしい",
    description: "手順を慎重に組み立てる難易度です。",
  },
] as const;

export type WaterSortDifficulty = (typeof waterSortDifficulties)[number]["id"];

export function parseWaterSortDifficulty(
  value: string | undefined,
): WaterSortDifficulty | undefined {
  return waterSortDifficulties.find((difficulty) => difficulty.id === value)
    ?.id;
}

export function getWaterSortDifficultyLabel(
  difficulty: WaterSortDifficulty,
): string {
  return (
    waterSortDifficulties.find((option) => option.id === difficulty)?.label ??
    difficulty
  );
}
