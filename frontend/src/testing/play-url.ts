import type { GameCatalogEntry } from "@/app/game-integration/game-catalog-entry";
import { parseDifficultyLevel } from "@/games/difficulty";
import type { ProblemId } from "@/games/problem-id";

/** 以前のレベル指定や問題ID指定のテストケースから、実際の問題URLを作る。 */
export function testPlayUrl(
  game: GameCatalogEntry,
  input: string,
  selectProblemId?: (
    difficulty: NonNullable<ReturnType<typeof parseDifficultyLevel>>,
  ) => ProblemId,
): string {
  const url = new URL(input, "https://example.test");
  const segments = url.pathname.split("/");
  const levelOrId = segments.at(-1) ?? "";
  const requestedId = url.searchParams.get("problem");
  const difficulty = parseDifficultyLevel(levelOrId);
  const problemId =
    requestedId ??
    (difficulty
      ? (selectProblemId?.(difficulty) ??
        game.listPoolProblemIds(difficulty)[0])
      : undefined);
  return `${game.homePath}/play/${problemId ?? levelOrId}`;
}
