import { act, cleanup, renderHook } from "@testing-library/react";
import { useEffect, useState } from "react";
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

function useTestPlay(id: string | undefined, startedAt: number) {
  const [state, setState] = useState(() =>
    restorePlayState("test-game", id, () => newPlay(startedAt)),
  );
  useEffect(() => savePlayState("test-game", id, state), [id, state]);
  return [state, setState] as const;
}

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});

test("再描画・再マウントを挟んでも盤面、待った履歴、計数、開始時刻を維持する", () => {
  const first = renderHook(() => useTestPlay(problemId, 1000));
  act(() =>
    first.result.current[1]((current) => ({
      ...current,
      session: {
        ...current.session,
        puzzleState: [1, 0],
        history: [[0, 0]],
        undoCount: 3,
      },
    })),
  );
  first.unmount();
  const resumed = renderHook(() => useTestPlay(problemId, 9000));
  expect(resumed.result.current[0].session).toMatchObject({
    startedAt: 1000,
    puzzleState: [1, 0],
    history: [[0, 0]],
    undoCount: 3,
  });
});

test("別問題を開いたときは以前の状態を引き継がない", () => {
  const first = renderHook(() => useTestPlay(problemId, 1000));
  first.unmount();
  const next = renderHook(() => useTestPlay("different-id", 2000));
  expect(next.result.current[0].session.startedAt).toBe(2000);
});

test("破損した保存内容からは新しい盤面を開始する", () => {
  window.sessionStorage.setItem("pa-zzle.active-play.v1.test-game", "{broken");
  const next = renderHook(() => useTestPlay(problemId, 3000));
  expect(next.result.current[0].session.startedAt).toBe(3000);
});

test("保存できない環境でもプレイを開始できる", () => {
  const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("quota exceeded");
  });
  const next = renderHook(() => useTestPlay(problemId, 4000));
  expect(next.result.current[0].session.startedAt).toBe(4000);
  set.mockRestore();
});
