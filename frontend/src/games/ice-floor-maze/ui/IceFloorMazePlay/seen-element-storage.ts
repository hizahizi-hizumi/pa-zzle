import type { IceFloorMazeElementRuleId } from "@/games/ice-floor-maze/tutorial/tutorial";

/** 一言を見たものとして残した要素（SPEC-025）。 */
const storageKey = "pa-zzle.ice-floor-maze.seen-elements.v1";

function isStringList(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

export function readIceFloorMazeSeenElements(): ReadonlySet<string> {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored === null) return new Set();
    const parsed: unknown = JSON.parse(stored);
    return new Set(isStringList(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

export function markIceFloorMazeElementsSeen(
  ruleIds: readonly IceFloorMazeElementRuleId[],
): void {
  if (ruleIds.length === 0) return;
  const seen = new Set([...readIceFloorMazeSeenElements(), ...ruleIds]);
  try {
    window.localStorage.setItem(storageKey, JSON.stringify([...seen]));
  } catch {
    // 保存できない環境では、次の問題でもう一度一言を出すだけで、遊ぶのは妨げない。
  }
}
