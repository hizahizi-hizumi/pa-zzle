import type { PlayAttempt } from "@/records/play-attempt";
import {
  abandonPlayAttempt,
  readPlayAttempts,
  removeClearedPlayAttempts,
  startPlayAttempt,
} from "@/records/play-attempt-storage";
import type { PlayRecord } from "@/records/play-record";
import { appendPlayRecord, type PlayRecordStorage } from "@/records/storage";

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

function createAttempt(startedAt: number): PlayAttempt {
  return {
    gameId: "test-game",
    startedAt,
    start: { difficulty: "3", problemIdentity: { seed: "a" } },
    abandonment: null,
  };
}

const attempt = createAttempt(1_000);

const abandonment = { abandonedAt: 5_000, progress: { elapsedMs: 4_000 } };

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
  describe("同じプレイを始めている場合", () => {
    beforeEach(() => {
      startPlayAttempt(attempt, storage);
    });

    test("重ねて保存しないこと", () => {
      startPlayAttempt(attempt, storage);
      const attempts = readPlayAttempts(storage);

      expect(attempts).toEqual([attempt]);
    });
  });
});

describe("abandonPlayAttempt", () => {
  describe("離脱を記録済みの場合", () => {
    beforeEach(() => {
      startPlayAttempt(attempt, storage);
      abandonPlayAttempt(attempt, abandonment, storage);
    });

    test("最初に離れたときの進み具合を残すこと", () => {
      abandonPlayAttempt(
        attempt,
        { abandonedAt: 8_000, progress: { elapsedMs: 7_000 } },
        storage,
      );
      const attempts = readPlayAttempts(storage);

      expect(attempts).toEqual([{ ...attempt, abandonment }]);
    });
  });

  describe("完了記録がある場合", () => {
    beforeEach(() => {
      startPlayAttempt(attempt, storage);
      appendPlayRecord(recordOfAttempt, storage);
    });

    test("離脱を保存しないこと", () => {
      abandonPlayAttempt(attempt, abandonment, storage);
      const stored = readPlayAttempts(storage)[0]?.abandonment;

      expect(stored).toBeNull();
    });
  });
});

describe("removeClearedPlayAttempts", () => {
  const abandonedAttempt = createAttempt(2_000);
  const unfinishedAttempt = createAttempt(3_000);

  beforeEach(() => {
    startPlayAttempt(attempt, storage);
    startPlayAttempt(abandonedAttempt, storage);
    abandonPlayAttempt(abandonedAttempt, abandonment, storage);
    startPlayAttempt(unfinishedAttempt, storage);
    appendPlayRecord(recordOfAttempt, storage);
  });

  test("クリアした試行だけを除き、離脱と未完了の試行を残すこと", () => {
    removeClearedPlayAttempts(storage);
    const remaining = readPlayAttempts(storage).map(
      ({ startedAt }) => startedAt,
    );

    expect(remaining).toEqual([2_000, 3_000]);
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
    startPlayAttempt(attempt);
    abandonPlayAttempt(attempt, abandonment);
    const attempts = readPlayAttempts();

    expect(attempts).toEqual([]);
  });
});

const PLAY_ATTEMPTS_KEY = "pa-zzle.play-attempts.v1";

describe("壊れたプレイ試行を保持した保存先の場合", () => {
  const invalidValues = [
    ["不正なJSON", "not-json"],
    ["配列ではない値", "{}"],
    ["一部が不正な試行", JSON.stringify([attempt, { gameId: "broken" }])],
  ] as const;
  const cases = invalidValues.map(([name, value]) => ({
    name,
    value,
    storage: createMemoryStorage({ [PLAY_ATTEMPTS_KEY]: value }),
  }));

  test.each(cases)(
    "通常のプレイ開始で元の値を上書きしないこと: $name",
    ({ value, storage }) => {
      startPlayAttempt(nextAttempt, storage);
      const persisted = storage.getItem(PLAY_ATTEMPTS_KEY);

      expect(persisted).toBe(value);
    },
  );

  const nextAttempt = createAttempt(2_000);
  const invalidStorage = createMemoryStorage({ [PLAY_ATTEMPTS_KEY]: "{" });

  test("離脱や完了の保存処理でも壊れた試行を上書きしないこと", () => {
    abandonPlayAttempt(attempt, abandonment, invalidStorage);
    removeClearedPlayAttempts(invalidStorage);
    const persisted = invalidStorage.getItem(PLAY_ATTEMPTS_KEY);

    expect(persisted).toBe("{");
  });
});
