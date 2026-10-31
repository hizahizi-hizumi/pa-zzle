import type { PlayRecord } from "@/records/play-record";
import {
  appendPlayRecord,
  findPlayRecord,
  type PlayRecordStorage,
  readPlayRecords,
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
