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

test("始めたプレイを1件だけ記録し、StrictMode の張り直しを離脱にしないこと", async () => {
  renderAttemptHook({
    attempt: createAttempt(1_000),
    finished: false,
    moveCount: 0,
  });
  await flushAbandonment();

  expect(readPlayAttempts()).toEqual([createAttempt(1_000)]);
});

test("プレイ画面を離れたときの進み具合を離脱として記録すること", async () => {
  const hook = renderAttemptHook({
    attempt: createAttempt(1_000),
    finished: false,
    moveCount: 0,
  });
  hook.rerender({
    attempt: createAttempt(1_000),
    finished: false,
    moveCount: 3,
  });

  hook.unmount();
  await flushAbandonment();

  expect(readPlayAttempts()[0]?.abandonment).toEqual({
    abandonedAt: 9_000,
    progress: { moveCount: 3, abandonedAt: 9_000 },
  });
});

test("解き終えたプレイを離れても離脱にしないこと", async () => {
  const hook = renderAttemptHook({
    attempt: createAttempt(1_000),
    finished: false,
    moveCount: 0,
  });
  hook.rerender({
    attempt: createAttempt(1_000),
    finished: true,
    moveCount: 5,
  });

  hook.unmount();
  await flushAbandonment();

  expect(readPlayAttempts()[0]?.abandonment).toBeNull();
});

test("別のプレイに置き換えたとき前のプレイの進み具合で離脱を記録すること", async () => {
  const hook = renderAttemptHook({
    attempt: createAttempt(1_000),
    finished: false,
    moveCount: 4,
  });

  hook.rerender({
    attempt: createAttempt(2_000),
    finished: false,
    moveCount: 0,
  });
  await flushAbandonment();

  const [previous, next] = readPlayAttempts();
  expect(previous?.abandonment?.progress).toEqual({
    moveCount: 4,
    abandonedAt: 9_000,
  });
  expect(next).toEqual(createAttempt(2_000));
});

test("ページを離れたとき離脱を記録し、同じページへ戻ったら取り消すこと", () => {
  renderAttemptHook({
    attempt: createAttempt(1_000),
    finished: false,
    moveCount: 2,
  });

  window.dispatchEvent(new PageTransitionEvent("pagehide"));
  const hidden = readPlayAttempts()[0]?.abandonment;
  window.dispatchEvent(
    new PageTransitionEvent("pageshow", { persisted: true }),
  );

  expect(hidden).toEqual({
    abandonedAt: 9_000,
    progress: { moveCount: 2, abandonedAt: 9_000 },
  });
  expect(readPlayAttempts()[0]?.abandonment).toBeNull();
});

test("記録しないプレイは始めたことも記録しないこと", async () => {
  const hook = renderAttemptHook({
    attempt: null,
    finished: false,
    moveCount: 0,
  });

  hook.unmount();
  await flushAbandonment();

  expect(readPlayAttempts()).toEqual([]);
});
