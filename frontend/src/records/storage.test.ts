import type { PlayRecord } from "./play-record";
import {
  appendPlayRecord,
  type PlayRecordStorage,
  readPlayRecords,
} from "./storage";

function createMemoryStorage(
  initialValue: string | null = null,
): PlayRecordStorage {
  let value = initialValue;
  return {
    getItem() {
      return value;
    },
    setItem(_key, nextValue) {
      value = nextValue;
    },
  };
}

function createRecord(id: string): PlayRecord {
  return {
    id,
    gameId: "test-game",
    startedAt: 1_000,
    completedAt: 2_000,
    payloadVersion: 1,
    payload: { value: 1 },
  };
}

describe("メモリ保存領域を使う場合", () => {
  let storage: PlayRecordStorage;
  let record: PlayRecord;

  beforeEach(() => {
    storage = createMemoryStorage();
    record = createRecord("record-1");
  });

  test("保存したプレイ記録を読み出せること", () => {
    const saveStatus = appendPlayRecord(record, storage);
    const records = readPlayRecords(storage);

    expect(saveStatus).toBe("saved");
    expect(records).toEqual([record]);
  });

  describe("同じプレイ記録を保存済みの場合", () => {
    beforeEach(() => {
      appendPlayRecord(record, storage);
    });

    test("重複保存しないこと", () => {
      const saveStatus = appendPlayRecord(record, storage);
      const records = readPlayRecords(storage);

      expect(saveStatus).toBe("duplicate");
      expect(records).toHaveLength(1);
    });
  });
});

describe("readPlayRecords", () => {
  const brokenStorage = createMemoryStorage("not-json");

  test("壊れた保存値を履歴として扱わないこと", () => {
    const records = readPlayRecords(brokenStorage);

    expect(records).toEqual([]);
  });

  describe("ブラウザ保存領域へアクセスできない場合", () => {
    beforeEach(() => {
      vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
        throw new DOMException("denied", "SecurityError");
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    test("画面用の読み出しを継続できること", () => {
      const records = readPlayRecords();

      expect(records).toEqual([]);
    });
  });
});
