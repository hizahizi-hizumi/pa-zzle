import type { PlayAttempt } from "@/records/play-attempt";
import {
  abandonPlayAttempt,
  readPlayAttempts,
  readPlayAttemptsSnapshot,
  removeClearedPlayAttempts,
  resumePlayAttempt,
  startPlayAttempt,
  subscribePlayAttempts,
} from "@/records/play-attempt-storage";
import type { PlayRecord } from "@/records/play-record";
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

function createAttempt(startedAt: number): PlayAttempt {
  return {
    id: `test-game:${startedAt}`,
    gameId: "test-game",
    startedAt,
    payloadVersion: 1,
    start: { difficulty: "3" },
    abandonment: null,
  };
}

const attempt = createAttempt(1_000);

const abandonment = { abandonedAt: 5_000, progress: { elapsedMs: 4_000 } };

const laterAbandonment = { abandonedAt: 8_000, progress: { elapsedMs: 7_000 } };

const recordOfAttempt: PlayRecord = {
  id: "test-game:1000:4000",
  gameId: "test-game",
  startedAt: 1_000,
  completedAt: 4_000,
  payloadVersion: 1,
  payload: {},
};

let storage: PlayRecordStorage;

beforeEach(() => {
  storage = createMemoryStorage();
});

describe("startPlayAttempt", () => {
  test("始めたプレイを読み出せること", () => {
    const status = startPlayAttempt(attempt, storage);
    const attempts = readPlayAttempts(storage);

    expect(status).toBe("saved");
    expect(attempts).toEqual([attempt]);
  });

  describe("同じプレイを始めている場合", () => {
    beforeEach(() => {
      startPlayAttempt(attempt, storage);
    });

    test("重ねて保存しないこと", () => {
      const status = startPlayAttempt(attempt, storage);
      const attempts = readPlayAttempts(storage);

      expect(status).toBe("duplicate");
      expect(attempts).toHaveLength(1);
    });
  });
});

describe("abandonPlayAttempt", () => {
  describe("始めたプレイの場合", () => {
    beforeEach(() => {
      startPlayAttempt(attempt, storage);
    });

    test("離れたときの進み具合を保存すること", () => {
      const status = abandonPlayAttempt(attempt.id, abandonment, storage);
      const attempts = readPlayAttempts(storage);

      expect(status).toBe("saved");
      expect(attempts).toEqual([{ ...attempt, abandonment }]);
    });
  });

  describe("離脱を記録済みの場合", () => {
    beforeEach(() => {
      startPlayAttempt(attempt, storage);
      abandonPlayAttempt(attempt.id, abandonment, storage);
    });

    test("最初の離脱を残すこと", () => {
      const status = abandonPlayAttempt(attempt.id, laterAbandonment, storage);
      const stored = readPlayAttempts(storage)[0]?.abandonment;

      expect(status).toBe("ignored");
      expect(stored).toEqual(abandonment);
    });
  });

  describe("完了記録がある場合", () => {
    beforeEach(() => {
      startPlayAttempt(attempt, storage);
      appendPlayRecord(recordOfAttempt, storage);
    });

    test("離脱を保存しないこと", () => {
      const status = abandonPlayAttempt(attempt.id, abandonment, storage);
      const stored = readPlayAttempts(storage)[0]?.abandonment;

      expect(status).toBe("ignored");
      expect(stored).toBeNull();
    });
  });

  describe("始めた記録が無い場合", () => {
    test("離脱を保存しないこと", () => {
      const status = abandonPlayAttempt(attempt.id, abandonment, storage);
      const attempts = readPlayAttempts(storage);

      expect(status).toBe("ignored");
      expect(attempts).toEqual([]);
    });
  });
});

describe("resumePlayAttempt", () => {
  describe("離脱を記録済みの場合", () => {
    beforeEach(() => {
      startPlayAttempt(attempt, storage);
      abandonPlayAttempt(attempt.id, abandonment, storage);
    });

    test("同じ時刻に記録した離脱を取り消すこと", () => {
      const status = resumePlayAttempt(
        attempt.id,
        abandonment.abandonedAt,
        storage,
      );
      const attempts = readPlayAttempts(storage);

      expect(status).toBe("saved");
      expect(attempts).toEqual([attempt]);
    });

    test("別の時刻に記録した離脱は取り消さないこと", () => {
      const status = resumePlayAttempt(
        attempt.id,
        laterAbandonment.abandonedAt,
        storage,
      );
      const stored = readPlayAttempts(storage)[0]?.abandonment;

      expect(status).toBe("ignored");
      expect(stored).toEqual(abandonment);
    });
  });
});

describe("removeClearedPlayAttempts", () => {
  const abandonedAttempt = createAttempt(2_000);
  const unfinishedAttempt = createAttempt(3_000);

  beforeEach(() => {
    startPlayAttempt(attempt, storage);
    startPlayAttempt(abandonedAttempt, storage);
    abandonPlayAttempt(abandonedAttempt.id, laterAbandonment, storage);
    startPlayAttempt(unfinishedAttempt, storage);
  });

  describe("完了記録がある試行を含む場合", () => {
    beforeEach(() => {
      appendPlayRecord(recordOfAttempt, storage);
    });

    test("クリアした試行だけを除き、離脱と未完了の試行を残すこと", () => {
      const status = removeClearedPlayAttempts(storage);
      const remainingIds = readPlayAttempts(storage).map(({ id }) => id);

      expect(status).toBe("saved");
      expect(remainingIds).toEqual([abandonedAttempt.id, unfinishedAttempt.id]);
    });
  });

  describe("完了記録がある試行を含まない場合", () => {
    test("保存し直さないこと", () => {
      const status = removeClearedPlayAttempts(storage);
      const remainingIds = readPlayAttempts(storage).map(({ id }) => id);

      expect(status).toBe("ignored");
      expect(remainingIds).toEqual([
        attempt.id,
        abandonedAttempt.id,
        unfinishedAttempt.id,
      ]);
    });
  });
});

describe("subscribePlayAttempts", () => {
  let listener: () => void;
  let unsubscribe: () => void;

  beforeEach(() => {
    listener = vi.fn<() => void>();
    unsubscribe = subscribePlayAttempts(listener);
  });

  afterEach(() => {
    unsubscribe();
  });

  test("試行を保存し直すたびに通知すること", () => {
    startPlayAttempt(attempt, storage);
    abandonPlayAttempt(attempt.id, abandonment, storage);

    expect(listener).toHaveBeenCalledTimes(2);
  });

  test("保存し直さなかった操作では通知しないこと", () => {
    abandonPlayAttempt(attempt.id, abandonment, storage);

    expect(listener).not.toHaveBeenCalled();
  });

  describe("購読をやめた場合", () => {
    beforeEach(() => {
      unsubscribe();
    });

    test("通知しないこと", () => {
      startPlayAttempt(attempt, storage);

      expect(listener).not.toHaveBeenCalled();
    });
  });
});

describe("readPlayAttemptsSnapshot", () => {
  let previous: readonly PlayAttempt[];

  beforeEach(() => {
    window.localStorage.clear();
    startPlayAttempt(attempt);
    previous = readPlayAttemptsSnapshot();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  test("保存内容が変わるまで同じ配列を返すこと", () => {
    const snapshot = readPlayAttemptsSnapshot();

    expect(snapshot).toBe(previous);
  });

  test("保存内容が変わると新しい内容を返すこと", () => {
    abandonPlayAttempt(attempt.id, abandonment);
    const snapshot = readPlayAttemptsSnapshot();

    expect(snapshot).not.toBe(previous);
    expect(snapshot).toEqual([{ ...attempt, abandonment }]);
  });
});

describe("保存領域へアクセスできない場合", () => {
  beforeEach(() => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("プレイを妨げないこと", () => {
    const startStatus = startPlayAttempt(attempt);
    const abandonStatus = abandonPlayAttempt(attempt.id, abandonment);
    const attempts = readPlayAttempts();
    const snapshot = readPlayAttemptsSnapshot();

    expect(startStatus).toBe("failed");
    expect(abandonStatus).toBe("failed");
    expect(attempts).toEqual([]);
    expect(snapshot).toEqual([]);
  });
});
