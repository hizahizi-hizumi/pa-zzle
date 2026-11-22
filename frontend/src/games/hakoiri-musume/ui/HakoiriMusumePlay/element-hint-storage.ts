import {
  type HakoiriMusumeElementHintId,
  hakoiriMusumeElementHintIds,
} from "@/games/hakoiri-musume/ui/element-hints";

const storageKey = "pa-zzle.hakoiri-musume.element-hints.v1";

/** 読めなければ、まだどれも出していないとみなす。 */
export function readSeenHakoiriMusumeElementHints(): Set<HakoiriMusumeElementHintId> {
  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem(storageKey) ?? "[]",
    );
    return new Set(
      Array.isArray(parsed)
        ? hakoiriMusumeElementHintIds.filter((id) => parsed.includes(id))
        : [],
    );
  } catch {
    return new Set();
  }
}

/** 残せなくても遊ぶのは止めない。 */
export function markHakoiriMusumeElementHintSeen(
  id: HakoiriMusumeElementHintId,
) {
  try {
    const seen = readSeenHakoiriMusumeElementHints();
    seen.add(id);
    window.localStorage.setItem(storageKey, JSON.stringify([...seen]));
  } catch {
    // 残せない環境（プライベートブラウズなど）では、次も同じ案内を出す。
  }
}
