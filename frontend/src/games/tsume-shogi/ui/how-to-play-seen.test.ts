import {
  type HowToPlaySeenStorage,
  readTsumeShogiHowToPlaySeen,
  writeTsumeShogiHowToPlaySeen,
} from "@/games/tsume-shogi/ui/how-to-play-seen";

function createMemoryStorage(): HowToPlaySeenStorage {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
  };
}

const unavailableStorage: HowToPlaySeenStorage = {
  getItem: () => {
    throw new Error("unavailable");
  },
  setItem: () => {
    throw new Error("unavailable");
  },
};

describe("readTsumeShogiHowToPlaySeen", () => {
  test("まだ閉じていなければ見ていない扱いにすること", () => {
    const seen = readTsumeShogiHowToPlaySeen(createMemoryStorage());

    expect(seen).toBe(false);
  });

  test("閉じたことを記録した後は見た扱いにすること", () => {
    const storage = createMemoryStorage();
    writeTsumeShogiHowToPlaySeen(storage);

    const seen = readTsumeShogiHowToPlaySeen(storage);

    expect(seen).toBe(true);
  });

  test("保存先が使えなければ、毎回開かないよう見た扱いにすること", () => {
    const seen = readTsumeShogiHowToPlaySeen(unavailableStorage);

    expect(seen).toBe(true);
  });
});

describe("writeTsumeShogiHowToPlaySeen", () => {
  test("保存先が使えなくても例外を投げないこと", () => {
    expect(() =>
      writeTsumeShogiHowToPlaySeen(unavailableStorage),
    ).not.toThrow();
  });
});
