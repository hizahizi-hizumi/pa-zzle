import {
  createHowToPlaySeenStore,
  type HowToPlaySeenStorage,
} from "@/components/how-to-play-seen";

function createMemoryStorage(): HowToPlaySeenStorage & {
  keys: () => string[];
} {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
    keys: () => [...items.keys()],
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

const store = createHowToPlaySeenStore("example-game");

describe("createHowToPlaySeenStore", () => {
  describe("read", () => {
    test("まだ閉じていなければ見ていない扱いにすること", () => {
      const seen = store.read(createMemoryStorage());

      expect(seen).toBe(false);
    });

    test("閉じたことを記録した後は見た扱いにすること", () => {
      const storage = createMemoryStorage();
      store.write(storage);

      const seen = store.read(storage);

      expect(seen).toBe(true);
    });

    test("保存先が使えなければ、毎回開かないよう見た扱いにすること", () => {
      const seen = store.read(unavailableStorage);

      expect(seen).toBe(true);
    });

    test("別のゲームで閉じた記録を見ないこと", () => {
      const storage = createMemoryStorage();
      createHowToPlaySeenStore("other-game").write(storage);

      const seen = store.read(storage);

      expect(seen).toBe(false);
    });
  });

  describe("write", () => {
    test("ゲームごとの保存先のキーへ記録すること", () => {
      const storage = createMemoryStorage();

      store.write(storage);

      expect(storage.keys()).toEqual([
        "pa-zzle.example-game.how-to-play-seen.v1",
      ]);
    });

    test("保存先が使えなくても例外を投げないこと", () => {
      expect(() => store.write(unavailableStorage)).not.toThrow();
    });
  });
});
