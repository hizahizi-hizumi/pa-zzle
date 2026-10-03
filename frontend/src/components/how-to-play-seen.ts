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
 * 1つのゲームの、遊び方を一度閉じたかどうかの記録。初めて遊ぶときだけ遊び方を自動で開くために使う。
 * - `read`: 閉じたことがあるか。保存先が使えないときは閉じた扱いにし、毎回開いて邪魔をしない。
 * - `write`: 閉じたことを記録する。保存先が使えなくても例外を投げない。
 */
export type HowToPlaySeenStore = {
  read: (storage?: HowToPlaySeenStorage | null) => boolean;
  write: (storage?: HowToPlaySeenStorage | null) => void;
};

/** `gameId` のゲームの記録を作る。保存先のキーはゲームごとに分ける。 */
export function createHowToPlaySeenStore(gameId: string): HowToPlaySeenStore {
  const storageKey = `pa-zzle.${gameId}.how-to-play-seen.v1`;

  return {
    read(storage = getDefaultStorage()) {
      if (!storage) {
        return true;
      }

      try {
        return storage.getItem(storageKey) !== null;
      } catch {
        return true;
      }
    },
    write(storage = getDefaultStorage()) {
      try {
        storage?.setItem(storageKey, "1");
      } catch {
        // 保存できなくても遊び方は閉じられる。次に遊ぶときにもう一度開くだけ。
      }
    },
  };
}
