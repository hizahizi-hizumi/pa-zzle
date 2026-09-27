import {
  type HowToPlaySeenStorage,
  readTakuzuHowToPlaySeen,
  writeTakuzuHowToPlaySeen,
} from "@/games/takuzu/ui/how-to-play-seen";

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

describe("readTakuzuHowToPlaySeen", () => {
  test("まだ閉じていなければ見ていない扱いにすること", () => {
    const seen = readTakuzuHowToPlaySeen(createMemoryStorage());

    expect(seen).toBe(false);
  });

  test("閉じたことを記録した後は見た扱いにすること", () => {
    const storage = createMemoryStorage();
    writeTakuzuHowToPlaySeen(storage);

    const seen = readTakuzuHowToPlaySeen(storage);

    expect(seen).toBe(true);
  });

  test("保存先が使えなければ、毎回開かないよう見た扱いにすること", () => {
    const seen = readTakuzuHowToPlaySeen(unavailableStorage);

    expect(seen).toBe(true);
  });
});

describe("writeTakuzuHowToPlaySeen", () => {
  test("保存先が使えなくても例外を投げないこと", () => {
    expect(() => writeTakuzuHowToPlaySeen(unavailableStorage)).not.toThrow();
  });
});
