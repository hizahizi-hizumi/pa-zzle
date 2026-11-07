import type { PlayRecordStorage } from "@/records/storage";
import type { ZukanViewedStatuses } from "@/zukan/zukan-last-viewed";
import {
  readZukanLastViewed,
  writeZukanLastViewed,
} from "@/zukan/zukan-last-viewed-storage";

const STORAGE_KEY = "pa-zzle.zukan-last-viewed.v1";

function createMemoryStorage(
  initial: Record<string, string> = {},
): PlayRecordStorage {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

const nanpureLevels: ZukanViewedStatuses = {
  "1": { a: "perfect", d: "attempted" },
  "3": { b: "clear" },
};

const waterSortLevels: ZukanViewedStatuses = { "2": { c: "good" } };

describe("readZukanLastViewed", () => {
  describe("一度も図鑑を見ていない場合", () => {
    const storage = createMemoryStorage();

    test("前回の状態を無しとすること", () => {
      const lastViewed = readZukanLastViewed("nanpure", storage);

      expect(lastViewed).toBeNull();
    });
  });

  describe("ほかのゲームの図鑑だけを見たことがある場合", () => {
    const storage = createMemoryStorage({
      [STORAGE_KEY]: JSON.stringify({ "water-sort": waterSortLevels }),
    });

    test("前回の状態を無しとすること", () => {
      const lastViewed = readZukanLastViewed("nanpure", storage);

      expect(lastViewed).toBeNull();
    });
  });

  describe("保存全体が壊れている場合", () => {
    const storedValues: readonly (readonly [string, string])[] = [
      ["JSON として読めない", "{"],
      ["ゲームごとの対応でない", "[]"],
      ["ゲームの状態が難易度ごとの対応でない", JSON.stringify({ nanpure: [] })],
    ];
    const cases = storedValues.map(
      ([name, stored]) =>
        [name, createMemoryStorage({ [STORAGE_KEY]: stored })] as const,
    );

    test.each(cases)("前回の状態を無しとすること: %s", (_, storage) => {
      const lastViewed = readZukanLastViewed("nanpure", storage);

      expect(lastViewed).toBeNull();
    });
  });

  describe("読めない難易度や状態が混ざっている場合", () => {
    const storage = createMemoryStorage({
      [STORAGE_KEY]: JSON.stringify({
        nanpure: {
          easy: { x: "perfect" },
          "1": { a: "perfect", b: "excellent", c: "attempted" },
          "2": ["a"],
          "3": { d: "clear" },
        },
      }),
    });

    test("読めない難易度と問題だけを飛ばし、ほかの状態を読むこと", () => {
      const lastViewed = readZukanLastViewed("nanpure", storage);

      expect(lastViewed).toEqual({
        "1": { a: "perfect", c: "attempted" },
        "3": { d: "clear" },
      });
    });
  });

  describe("挑戦中の問題を残す前の形で保存している場合", () => {
    const storage = createMemoryStorage({
      [STORAGE_KEY]: JSON.stringify({ nanpure: { "1": { a: "great" } } }),
    });

    test("解いた問題の評価段階を読み、挑戦中の問題は無いものとすること", () => {
      const lastViewed = readZukanLastViewed("nanpure", storage);

      expect(lastViewed).toEqual({ "1": { a: "great" } });
    });
  });

  describe("保存を読めない場合", () => {
    const storage: PlayRecordStorage = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {},
    };

    test("前回の状態を無しとすること", () => {
      const lastViewed = readZukanLastViewed("nanpure", storage);

      expect(lastViewed).toBeNull();
    });
  });
});

describe("writeZukanLastViewed", () => {
  describe("ほかのゲームの状態を保存している場合", () => {
    let storage: PlayRecordStorage;

    beforeEach(() => {
      storage = createMemoryStorage();
      writeZukanLastViewed("water-sort", waterSortLevels, storage);
      writeZukanLastViewed("nanpure", { "1": {} }, storage);
    });

    test("そのゲームの難易度の状態を置き換え、ほかのゲームの状態を保つこと", () => {
      writeZukanLastViewed("nanpure", nanpureLevels, storage);
      const saved = [
        readZukanLastViewed("nanpure", storage),
        readZukanLastViewed("water-sort", storage),
      ];

      expect(saved).toEqual([nanpureLevels, waterSortLevels]);
    });
  });

  describe("そのゲームのほかの難易度の状態を保存している場合", () => {
    let storage: PlayRecordStorage;

    beforeEach(() => {
      storage = createMemoryStorage();
      writeZukanLastViewed("nanpure", nanpureLevels, storage);
    });

    test("渡した難易度だけを置き換え、渡していない難易度の前回の状態を残すこと", () => {
      writeZukanLastViewed("nanpure", { "3": { b: "great" } }, storage);
      const saved = readZukanLastViewed("nanpure", storage);

      expect(saved).toEqual({
        "1": { a: "perfect", d: "attempted" },
        "3": { b: "great" },
      });
    });
  });

  describe("保存が壊れている場合", () => {
    let storage: PlayRecordStorage;

    beforeEach(() => {
      storage = createMemoryStorage({ [STORAGE_KEY]: "{" });
    });

    test("元の保存値を上書きしないこと", () => {
      writeZukanLastViewed("nanpure", nanpureLevels, storage);
      const persisted = storage.getItem(STORAGE_KEY);

      expect(persisted).toBe("{");
    });
  });

  describe("保存できない場合", () => {
    const storage: PlayRecordStorage = {
      getItem() {
        return null;
      },
      setItem() {
        throw new Error("quota");
      },
    };

    test("失敗を外へ投げないこと", () => {
      const act = () => writeZukanLastViewed("nanpure", nanpureLevels, storage);

      expect(act).not.toThrow();
    });
  });
});

describe("writeZukanLastViewed", () => {
  const invalidGameValues = [
    ["ゲームの状態が配列", []],
    ["難易度の状態が配列", { "1": ["a"] }],
    ["読めない問題の状態が含まれる", { "1": { a: "unknown" } }],
  ] as const;
  const cases = invalidGameValues.map(([name, game]) => {
    const raw = JSON.stringify({ nanpure: game });
    return { name, raw, storage: createMemoryStorage({ [STORAGE_KEY]: raw }) };
  });

  test.each(cases)(
    "一部が壊れたゲームの状態を上書きしないこと: $name",
    ({ raw, storage }) => {
      writeZukanLastViewed("nanpure", nanpureLevels, storage);
      const persisted = storage.getItem(STORAGE_KEY);

      expect(persisted).toBe(raw);
    },
  );

  const previousOtherGame = { "water-sort": waterSortLevels };
  const updatedWaterSort: ZukanViewedStatuses = { "3": { e: "great" } };
  const preservedOtherGame = createMemoryStorage({
    [STORAGE_KEY]: JSON.stringify({ ...previousOtherGame, nanpure: [] }),
  });

  test("別のゲームの壊れた値を残して正常なゲームを更新できること", () => {
    writeZukanLastViewed("water-sort", updatedWaterSort, preservedOtherGame);
    const persisted = preservedOtherGame.getItem(STORAGE_KEY);

    expect(JSON.parse(persisted ?? "{}")).toEqual({
      ...previousOtherGame,
      "water-sort": { ...waterSortLevels, ...updatedWaterSort },
      nanpure: [],
    });
  });
});
