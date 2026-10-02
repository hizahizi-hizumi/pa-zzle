import type { PlayAttempt } from "@/records/play-attempt";
import {
  abandonPlayAttempt,
  readPlayAttempts,
  resumePlayAttempt,
  startPlayAttempt,
} from "@/records/play-attempt-storage";
import { appendPlayRecord, type PlayRecordStorage } from "@/records/storage";

function createMemoryStorage(): PlayRecordStorage {
  const values = new Map<string, string>();
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

const attempt: PlayAttempt = {
  id: "test-game:1000",
  gameId: "test-game",
  startedAt: 1_000,
  payloadVersion: 1,
  start: { difficulty: "3" },
  abandonment: null,
};

const abandonment = { abandonedAt: 5_000, progress: { elapsedMs: 4_000 } };

describe("startPlayAttempt", () => {
  test("始めたプレイを読み出せること", () => {
    const storage = createMemoryStorage();

    const status = startPlayAttempt(attempt, storage);

    expect(status).toBe("saved");
    expect(readPlayAttempts(storage)).toEqual([attempt]);
  });

  test("同じプレイを重ねて保存しないこと", () => {
    const storage = createMemoryStorage();
    startPlayAttempt(attempt, storage);

    const status = startPlayAttempt(attempt, storage);

    expect(status).toBe("duplicate");
    expect(readPlayAttempts(storage)).toHaveLength(1);
  });
});

describe("abandonPlayAttempt", () => {
  test("離れたときの進み具合を保存すること", () => {
    const storage = createMemoryStorage();
    startPlayAttempt(attempt, storage);

    const status = abandonPlayAttempt(attempt.id, abandonment, storage);

    expect(status).toBe("saved");
    expect(readPlayAttempts(storage)).toEqual([{ ...attempt, abandonment }]);
  });

  test("離脱を記録済みのプレイでは最初の離脱を残すこと", () => {
    const storage = createMemoryStorage();
    startPlayAttempt(attempt, storage);
    abandonPlayAttempt(attempt.id, abandonment, storage);

    const status = abandonPlayAttempt(
      attempt.id,
      { abandonedAt: 8_000, progress: { elapsedMs: 7_000 } },
      storage,
    );

    expect(status).toBe("ignored");
    expect(readPlayAttempts(storage)[0]?.abandonment).toEqual(abandonment);
  });

  test("完了記録があるプレイには離脱を保存しないこと", () => {
    const storage = createMemoryStorage();
    startPlayAttempt(attempt, storage);
    appendPlayRecord(
      {
        id: "test-game:1000:4000",
        gameId: "test-game",
        startedAt: 1_000,
        completedAt: 4_000,
        payloadVersion: 1,
        payload: {},
      },
      storage,
    );

    const status = abandonPlayAttempt(attempt.id, abandonment, storage);

    expect(status).toBe("ignored");
    expect(readPlayAttempts(storage)[0]?.abandonment).toBeNull();
  });

  test("始めた記録が無いプレイには離脱を保存しないこと", () => {
    const storage = createMemoryStorage();

    const status = abandonPlayAttempt(attempt.id, abandonment, storage);

    expect(status).toBe("ignored");
    expect(readPlayAttempts(storage)).toEqual([]);
  });
});

describe("resumePlayAttempt", () => {
  test("同じ時刻に記録した離脱を取り消すこと", () => {
    const storage = createMemoryStorage();
    startPlayAttempt(attempt, storage);
    abandonPlayAttempt(attempt.id, abandonment, storage);

    const status = resumePlayAttempt(attempt.id, 5_000, storage);

    expect(status).toBe("saved");
    expect(readPlayAttempts(storage)).toEqual([attempt]);
  });

  test("別の時刻に記録した離脱は取り消さないこと", () => {
    const storage = createMemoryStorage();
    startPlayAttempt(attempt, storage);
    abandonPlayAttempt(attempt.id, abandonment, storage);

    const status = resumePlayAttempt(attempt.id, 6_000, storage);

    expect(status).toBe("ignored");
    expect(readPlayAttempts(storage)[0]?.abandonment).toEqual(abandonment);
  });
});

test("保存領域へアクセスできなくてもプレイを妨げないこと", () => {
  const localStorage = vi
    .spyOn(window, "localStorage", "get")
    .mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });

  expect(startPlayAttempt(attempt)).toBe("failed");
  expect(abandonPlayAttempt(attempt.id, abandonment)).toBe("failed");
  expect(readPlayAttempts()).toEqual([]);
  localStorage.mockRestore();
});
