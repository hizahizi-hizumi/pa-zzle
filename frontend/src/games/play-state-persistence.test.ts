import {
  restorePlayState,
  savePlayState,
} from "@/games/play-state-persistence";
import { createProblemId } from "@/games/problem-id";

const identity = { seed: "saved-problem" };
const problemId = createProblemId(identity);

function newPlay(startedAt: number) {
  return {
    problemIdentity: identity,
    progress: "playing" as const,
    session: {
      problem: { number: 42 },
      puzzleState: [0, 0],
      status: "playing" as const,
      startedAt,
      clearedAt: null,
      history: [] as number[][],
      undoCount: 0,
    },
  };
}

describe("restorePlayState / savePlayState", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  describe("同じ問題を再び開く場合", () => {
    const played = {
      ...newPlay(1000),
      session: {
        ...newPlay(1000).session,
        puzzleState: [1, 0],
        history: [[0, 0]],
        undoCount: 3,
      },
    };

    test("再読み込みを挟んでも盤面、待った履歴、計数、開始時刻を維持すること", () => {
      savePlayState("test-game", problemId, played);
      const resumed = restorePlayState("test-game", problemId, () =>
        newPlay(9000),
      );

      expect(resumed.session).toMatchObject({
        startedAt: 1000,
        puzzleState: [1, 0],
        history: [[0, 0]],
        undoCount: 3,
      });
    });

    test("別問題を開いたときは以前の状態を引き継がないこと", () => {
      savePlayState("test-game", problemId, played);
      const next = restorePlayState("test-game", "different-id", () =>
        newPlay(2000),
      );

      expect(next.session.startedAt).toBe(2000);
    });
  });

  describe("保存内容が破損している場合", () => {
    beforeEach(() => {
      window.sessionStorage.setItem(
        "pa-zzle.active-play.v1.test-game",
        "{broken",
      );
    });

    test("新しい盤面を開始すること", () => {
      const next = restorePlayState("test-game", problemId, () =>
        newPlay(3000),
      );

      expect(next.session.startedAt).toBe(3000);
    });
  });

  describe("保存領域へ書き込めない場合", () => {
    beforeEach(() => {
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("quota exceeded");
      });
    });

    test("プレイを継続できること", () => {
      savePlayState("test-game", problemId, newPlay(4000));
      const next = restorePlayState("test-game", problemId, () =>
        newPlay(4000),
      );

      expect(next.session.startedAt).toBe(4000);
    });
  });
});
