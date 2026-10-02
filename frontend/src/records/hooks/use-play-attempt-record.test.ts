import { act, cleanup, renderHook } from "@testing-library/react";
import { StrictMode } from "react";

import { usePlayAttemptRecord } from "@/records/hooks/use-play-attempt-record";
import type { PlayAttempt } from "@/records/play-attempt";
import { readPlayAttempts } from "@/records/play-attempt-storage";

type HookProps = {
  attempt: PlayAttempt | null;
  finished: boolean;
  moveCount: number;
};

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

type AttemptHook = ReturnType<typeof renderAttemptHook>;

function renderAttemptHook(initialProps: HookProps) {
  return renderHook(
    ({ attempt, finished, moveCount }: HookProps) =>
      usePlayAttemptRecord(attempt, {
        finished,
        getProgress(abandonedAt) {
          return { moveCount, abandonedAt };
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

describe("プレイを始めた場合", () => {
  beforeEach(() => {
    renderAttemptHook({
      attempt: createAttempt(1_000),
      finished: false,
      moveCount: 0,
    });
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
      progress: { moveCount: 0, abandonedAt: 9_000 },
    });
  });
});

describe("ページを離れた場合", () => {
  beforeEach(() => {
    renderAttemptHook({
      attempt: createAttempt(1_000),
      finished: false,
      moveCount: 2,
    });
    window.dispatchEvent(new PageTransitionEvent("pagehide"));
  });

  test("同じページへ戻ると離脱を取り消すこと", () => {
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true }),
    );
    const abandonment = readPlayAttempts()[0]?.abandonment;

    expect(abandonment).toBeNull();
  });
});

describe("プレイを進めた場合", () => {
  let hook: AttemptHook;

  beforeEach(() => {
    hook = renderAttemptHook({
      attempt: createAttempt(1_000),
      finished: false,
      moveCount: 0,
    });
    hook.rerender({
      attempt: createAttempt(1_000),
      finished: false,
      moveCount: 3,
    });
  });

  test("プレイ画面を離れると、その時点の進み具合を離脱として記録すること", async () => {
    hook.unmount();
    await flushAbandonment();
    const abandonment = readPlayAttempts()[0]?.abandonment;

    expect(abandonment).toEqual({
      abandonedAt: 9_000,
      progress: { moveCount: 3, abandonedAt: 9_000 },
    });
  });

  test("別のプレイに置き換えると、前のプレイの進み具合で離脱を記録し次のプレイを始めること", async () => {
    hook.rerender({
      attempt: createAttempt(2_000),
      finished: false,
      moveCount: 0,
    });
    await flushAbandonment();
    const [previous, next] = readPlayAttempts();

    expect(previous?.abandonment?.progress).toEqual({
      moveCount: 3,
      abandonedAt: 9_000,
    });
    expect(next).toEqual(createAttempt(2_000));
  });
});

describe("プレイを記録から除いた場合", () => {
  let hook: AttemptHook;

  beforeEach(async () => {
    hook = renderAttemptHook({
      attempt: createAttempt(1_000),
      finished: false,
      moveCount: 0,
    });
    await flushAbandonment();
    act(() => {
      hook.result.current.discard();
    });
  });

  test("別のプレイに置き換えても前のプレイを離脱にせず、次のプレイだけを記録すること", async () => {
    hook.rerender({
      attempt: createAttempt(2_000),
      finished: false,
      moveCount: 0,
    });
    await flushAbandonment();
    const attempts = readPlayAttempts();

    expect(attempts).toEqual([createAttempt(2_000)]);
  });

  test("ページを離れても離脱を記録しないこと", () => {
    window.dispatchEvent(new PageTransitionEvent("pagehide"));
    const attempts = readPlayAttempts();

    expect(attempts).toEqual([]);
  });
});

describe("解き終えた場合", () => {
  let hook: AttemptHook;

  beforeEach(() => {
    hook = renderAttemptHook({
      attempt: createAttempt(1_000),
      finished: false,
      moveCount: 0,
    });
    hook.rerender({
      attempt: createAttempt(1_000),
      finished: true,
      moveCount: 5,
    });
  });

  test("プレイ画面を離れても離脱にしないこと", async () => {
    hook.unmount();
    await flushAbandonment();
    const abandonment = readPlayAttempts()[0]?.abandonment;

    expect(abandonment).toBeNull();
  });
});

describe("記録しないプレイの場合", () => {
  let hook: AttemptHook;

  beforeEach(() => {
    hook = renderAttemptHook({
      attempt: null,
      finished: false,
      moveCount: 0,
    });
  });

  test("始めたことも離れたことも記録しないこと", async () => {
    hook.unmount();
    await flushAbandonment();
    const attempts = readPlayAttempts();

    expect(attempts).toEqual([]);
  });
});
