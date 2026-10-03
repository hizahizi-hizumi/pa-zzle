import { act, cleanup, renderHook } from "@testing-library/react";
import { StrictMode } from "react";

import { usePlayAttemptRecord } from "@/records/hooks/use-play-attempt-record";
import { readPlayAttempts } from "@/records/play-attempt-storage";

type HookProps = {
  startedAt: number;
  finished: boolean;
  moveCount: number;
};

const start = { difficulty: "3", problemIdentity: { seed: "a" } };

function createAttempt(startedAt: number) {
  return { gameId: "test-game", startedAt, start, abandonment: null };
}

type AttemptHook = ReturnType<typeof renderAttemptHook>;

function renderAttemptHook(initialProps: HookProps) {
  return renderHook(
    ({ startedAt, finished, moveCount }: HookProps) =>
      usePlayAttemptRecord({
        gameId: "test-game",
        startedAt,
        start,
        finished,
        getProgress(abandonedAt) {
          return { moveCount, elapsedMs: abandonedAt - startedAt };
        },
      }),
    { initialProps, wrapper: StrictMode },
  );
}

async function flushAbandonment() {
  await act(async () => {});
}

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(Date, "now").mockReturnValue(9_000);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("プレイを進めた場合", () => {
  let hook: AttemptHook;

  beforeEach(() => {
    hook = renderAttemptHook({
      startedAt: 1_000,
      finished: false,
      moveCount: 0,
    });
    hook.rerender({ startedAt: 1_000, finished: false, moveCount: 3 });
  });

  test("始めたプレイを1件だけ記録し、StrictMode の張り直しを離脱にしないこと", async () => {
    await flushAbandonment();
    const attempts = readPlayAttempts();

    expect(attempts).toEqual([createAttempt(1_000)]);
  });

  test("ページを離れると、その時点の進み具合を離脱として記録すること", () => {
    window.dispatchEvent(new PageTransitionEvent("pagehide"));
    const abandonment = readPlayAttempts()[0]?.abandonment;

    expect(abandonment).toEqual({
      abandonedAt: 9_000,
      progress: { moveCount: 3, elapsedMs: 8_000 },
    });
  });

  test("プレイ画面を離れると、その時点の進み具合を離脱として記録すること", async () => {
    hook.unmount();
    await flushAbandonment();
    const abandonment = readPlayAttempts()[0]?.abandonment;

    expect(abandonment?.progress).toEqual({ moveCount: 3, elapsedMs: 8_000 });
  });

  test("別のプレイに置き換えると、前のプレイの進み具合で離脱を記録し次のプレイを始めること", async () => {
    hook.rerender({ startedAt: 2_000, finished: false, moveCount: 0 });
    await flushAbandonment();
    const [previous, next] = readPlayAttempts();

    expect(previous?.abandonment?.progress).toEqual({
      moveCount: 3,
      elapsedMs: 8_000,
    });
    expect(next).toEqual(createAttempt(2_000));
  });
});

describe("解き終えた場合", () => {
  let hook: AttemptHook;

  beforeEach(() => {
    hook = renderAttemptHook({
      startedAt: 1_000,
      finished: false,
      moveCount: 0,
    });
    hook.rerender({ startedAt: 1_000, finished: true, moveCount: 5 });
  });

  test("プレイ画面を離れても離脱にしないこと", async () => {
    hook.unmount();
    await flushAbandonment();
    const abandonment = readPlayAttempts()[0]?.abandonment;

    expect(abandonment).toBeNull();
  });
});
