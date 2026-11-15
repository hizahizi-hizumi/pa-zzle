import type { NavigateFunction } from "react-router";
import { isRecordObject } from "@/lib/type-guards";

export type GameGuide = "tutorial" | "how-to";

export function openGameGuide(
  navigate: NavigateFunction,
  gameId: string,
  guide: GameGuide,
  returnTo: string,
  difficulty?: string,
): void {
  navigate(`/puzzles/${gameId}/${guide}`, {
    state: { returnTo, difficulty },
  });
}

export function readGameGuideReturnTo(
  state: unknown,
  gameId: string,
): string | null {
  if (!isRecordObject(state) || typeof state.returnTo !== "string") return null;
  const returnTo = state.returnTo;
  const prefix = `/puzzles/${gameId}`;
  return returnTo === prefix ||
    returnTo.startsWith(`${prefix}?`) ||
    returnTo.startsWith(`${prefix}/play/`)
    ? returnTo
    : null;
}

export function readGameGuideDifficulty(state: unknown): string | null {
  return isRecordObject(state) && typeof state.difficulty === "string"
    ? state.difficulty
    : null;
}
