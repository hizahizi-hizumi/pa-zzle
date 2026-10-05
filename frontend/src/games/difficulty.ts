/** 全ゲームが提供する5段階の難易度レベル。 */
export const difficultyLevels = [
  { id: "1", label: "レベル 1" },
  { id: "2", label: "レベル 2" },
  { id: "3", label: "レベル 3" },
  { id: "4", label: "レベル 4" },
  { id: "5", label: "レベル 5" },
] as const;

export type DifficultyLevel = (typeof difficultyLevels)[number]["id"];

// 5段階になる前の3段階の区分。その時代の記録を、旧区分のまま読み込み表示するためだけに残す。
const legacyDifficulties = [
  { id: "easy", label: "かんたん" },
  { id: "normal", label: "ふつう" },
  { id: "hard", label: "むずかしい" },
] as const;

export type LegacyDifficulty = (typeof legacyDifficulties)[number]["id"];

/** 記録に残っている難易度。3段階の時代があったゲームの記録は、旧区分も持つ。 */
export type RecordedDifficulty = DifficultyLevel | LegacyDifficulty;

export function parseDifficultyLevel(
  value: string | undefined,
): DifficultyLevel | undefined {
  return difficultyLevels.find((level) => level.id === value)?.id;
}

export function parseLegacyDifficulty(
  value: string | undefined,
): LegacyDifficulty | undefined {
  return legacyDifficulties.find((difficulty) => difficulty.id === value)?.id;
}

export function parseRecordedDifficulty(
  value: string | undefined,
): RecordedDifficulty | undefined {
  return parseDifficultyLevel(value) ?? parseLegacyDifficulty(value);
}

export function getDifficultyLabel(difficulty: RecordedDifficulty): string {
  return (
    [...difficultyLevels, ...legacyDifficulties].find(
      (option) => option.id === difficulty,
    )?.label ?? difficulty
  );
}
