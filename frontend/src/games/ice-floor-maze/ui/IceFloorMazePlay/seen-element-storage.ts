import type { IceFloorMazeElementRuleId } from "@/games/ice-floor-maze/tutorial/tutorial";

/**
 * 本番で一言を見て、その要素の問題で1手指した要素。記録の完了記録は問題を解き切ったプレイしか残さず、
 * 一言を見たかは分からないので、要素ごとに見たことだけをこの端末に残す。
 */
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
