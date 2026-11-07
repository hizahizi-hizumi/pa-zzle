import type { PlayRecord } from "@/records/play-record";
import {
  appendPlayRecord,
  findPlayRecord,
  type PlayRecordStorage,
  readPlayRecords,
  writePlayRecords,
} from "@/records/storage";

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

test("保存したプレイ記録を読み出せること", () => {
  const storage = createMemoryStorage();
  const record = createRecord("record-1");

  const saveStatus = appendPlayRecord(record, storage);
  const records = readPlayRecords(storage);

  expect(saveStatus).toBe("saved");
  expect(records).toEqual([record]);
});

test("同じプレイ記録を重複保存しないこと", () => {
  const storage = createMemoryStorage();
  const record = createRecord("record-1");
  appendPlayRecord(record, storage);

  const saveStatus = appendPlayRecord(record, storage);
  const records = readPlayRecords(storage);

  expect(saveStatus).toBe("duplicate");
  expect(records).toHaveLength(1);
});

test("壊れた保存値を履歴として扱わないこと", () => {
  const storage = createMemoryStorage("not-json");

  const records = readPlayRecords(storage);

  expect(records).toEqual([]);
});

test("保存領域へアクセスできなくても画面用の読み出しを継続できること", () => {
  const localStorage = vi
    .spyOn(window, "localStorage", "get")
    .mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });

  const records = readPlayRecords();

  expect(records).toEqual([]);
  localStorage.mockRestore();
});

describe("findPlayRecord", () => {
  const records = [createRecord("record-1"), createRecord("record-2")];
  const storage = createMemoryStorage(JSON.stringify(records));

  test("記録 ID の記録を返すこと", () => {
    const record = findPlayRecord("record-2", storage);

    expect(record).toEqual(records[1]);
  });

  test("保存されていない記録 ID には null を返すこと", () => {
    const record = findPlayRecord("record-3", storage);

    expect(record).toBeNull();
  });
});

const PLAY_RECORDS_KEY = "pa-zzle.play-records.v1";

describe("appendPlayRecord", () => {
  const record = createRecord("new-record");
  const preservedRecord = createRecord("existing-record");
  const invalidValues = [
    ["不正なJSON", "not-json"],
    ["配列以外の値", "{}"],
    ["部分的に壊れた履歴", JSON.stringify([preservedRecord, { id: "broken" }])],
  ] as const;
  const cases = invalidValues.map(([name, value]) => ({
    name,
    value,
    storage: createMemoryStorage(value),
  }));

  test.each(cases)(
    "壊れた保存値を上書きしないこと: $name",
    ({ value, storage }) => {
      const saveStatus = appendPlayRecord(record, storage);
      const persisted = storage.getItem(PLAY_RECORDS_KEY);

      expect(saveStatus).toBe("failed");
      expect(persisted).toBe(value);
    },
  );

  const inaccessibleStorage: PlayRecordStorage = {
    getItem() {
      throw new Error("access denied");
    },
    setItem() {
      throw new Error("should not be called");
    },
  };

  test("保存済みの履歴が読めないとき書き込まないこと", () => {
    const saveStatus = appendPlayRecord(record, inaccessibleStorage);

    expect(saveStatus).toBe("failed");
  });
});

describe("writePlayRecords", () => {
  const invalidValue = "not-json";
  const storage = createMemoryStorage(invalidValue);
  const replacementRecord = createRecord("new-record");

  test("明示的な保存でも壊れた既存値を上書きしないこと", () => {
    const saved = writePlayRecords([replacementRecord], storage);
    const persisted = storage.getItem(PLAY_RECORDS_KEY);

    expect(saved).toBe(false);
    expect(persisted).toBe(invalidValue);
  });
});
