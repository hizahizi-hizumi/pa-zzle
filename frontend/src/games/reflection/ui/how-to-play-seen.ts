const HOW_TO_PLAY_SEEN_STORAGE_KEY = "pa-zzle.reflection.how-to-play-seen.v1";

export type HowToPlaySeenStorage = Pick<Storage, "getItem" | "setItem">;

function getDefaultStorage(): HowToPlaySeenStorage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * 遊び方を一度閉じたかどうか。初めて遊ぶときだけ遊び方を自動で開くために使う。
 * 保存先が使えないときは閉じた扱いにし、毎回開いて邪魔をしない。
 */
export function readReflectionHowToPlaySeen(
  storage: HowToPlaySeenStorage | null = getDefaultStorage(),
): boolean {
  if (!storage) {
    return true;
  }

  try {
    return storage.getItem(HOW_TO_PLAY_SEEN_STORAGE_KEY) !== null;
  } catch {
    return true;
  }
}

export function writeReflectionHowToPlaySeen(
  storage: HowToPlaySeenStorage | null = getDefaultStorage(),
): void {
  try {
    storage?.setItem(HOW_TO_PLAY_SEEN_STORAGE_KEY, "1");
  } catch {
    // 保存できなくても遊び方は閉じられる。次に遊ぶときにもう一度開くだけ。
  }
}
