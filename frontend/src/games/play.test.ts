import {
  act,
  cleanup,
  type RenderHookResult,
  renderHook,
} from "@testing-library/react";

import {
  applyPlaySession,
  completePlayClearAnimation,
  type GameProgress,
  startPlaySession,
  useSessionElapsedMs,
} from "@/games/play";
import type { GameSessionStatus } from "@/games/session";

type TestSession = {
  status: GameSessionStatus;
  startedAt: number;
  finishedAt: number | null;
};

type TestPlayState = {
  session: TestSession;
  progress: GameProgress;
  selected: boolean;
};

const playing: TestSession = {
  status: "playing",
  startedAt: 10_000,
  finishedAt: null,
};
const cleared: TestSession = {
  status: "cleared",
  startedAt: 10_000,
  finishedAt: 12_500,
};

describe("applyPlaySession", () => {
  const state: TestPlayState = {
    session: playing,
    progress: "playing",
    selected: true,
  };
  const moved: TestSession = { ...playing };

  test("session が変わらなければ同じ state を返すこと", () => {
    const next = applyPlaySession(state, playing);

    expect(next).toBe(state);
  });

  test("プレイ中にクリアした session なら完成演出へ進むこと", () => {
    const next = applyPlaySession(state, cleared);

    expect(next).toEqual({
      session: cleared,
      progress: "clearing",
      selected: true,
    });
  });

  test("プレイ中の session なら進行を変えないこと", () => {
    const next = applyPlaySession(state, moved);

    expect(next).toEqual({
      session: moved,
      progress: "playing",
      selected: true,
    });
  });
});

describe("startPlaySession", () => {
  const state: TestPlayState = {
    session: cleared,
    progress: "result",
    selected: false,
  };

  test("結果表示中でも、新しい session でプレイ中へ戻ること", () => {
    const next = startPlaySession(state, playing);

    expect(next).toEqual({
      session: playing,
      progress: "playing",
      selected: false,
    });
  });
});

describe("completePlayClearAnimation", () => {
  const clearing: { progress: GameProgress } = { progress: "clearing" };
  const notClearingCases = [
    ["プレイ中", { progress: "playing" }],
    ["結果表示中", { progress: "result" }],
  ] as const;

  test("完成演出中なら結果表示へ進むこと", () => {
    const next = completePlayClearAnimation(clearing);

    expect(next.progress).toBe("result");
  });

  test.each(notClearingCases)(
    "完成演出中でなければ同じ state を返すこと: %s",
    (_, state) => {
      const next = completePlayClearAnimation(state);

      expect(next).toBe(state);
    },
  );
});

describe("useSessionElapsedMs", () => {
  let hook: RenderHookResult<number, TestSession>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(playing.startedAt);
    hook = renderHook((session: TestSession) => useSessionElapsedMs(session), {
      initialProps: playing,
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  test("プレイ中は1秒ごとに経過時間を進めること", () => {
    act(() => vi.advanceTimersByTime(3_000));

    expect(hook.result.current).toBe(3_000);
  });

  describe("クリアした場合", () => {
    beforeEach(() => {
      act(() => vi.advanceTimersByTime(2_000));
      hook.rerender(cleared);
    });

    test("クリアまでの経過時間で止めること", () => {
      act(() => vi.advanceTimersByTime(5_000));

      expect(hook.result.current).toBe(2_500);
    });
  });
});
