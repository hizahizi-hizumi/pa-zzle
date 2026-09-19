import { expect, test, vi } from "vitest";

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
