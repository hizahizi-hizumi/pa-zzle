import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation, useNavigationType } from "react-router";

import {
  useProblemIdQuerySync,
  useRequestedProblem,
} from "@/game-catalog/problem-id-query";
import { createProblemId, type ProblemIdentity } from "@/games/problem-id";

const playPath = "/puzzles/test/play/1";
const identity = { generatorVersion: "1", seed: "a" };
const otherIdentity = { generatorVersion: "1", seed: "b" };
const problemId = createProblemId(identity);
const otherProblemId = createProblemId(otherIdentity);

function createWrapper(path: string) {
  return function RouterWrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>;
  };
}

function useSyncedLocation(problemIdentity: ProblemIdentity | null) {
  useProblemIdQuerySync(problemIdentity);
  return {
    searchParams: new URLSearchParams(useLocation().search),
    navigationType: useNavigationType(),
  };
}

describe("useRequestedProblem", () => {
  const problemsById: Record<string, string> = { [problemId]: "問題A" };

  function findProblemById(requestedProblemId: string): string | null {
    return problemsById[requestedProblemId] ?? null;
  }

  describe("問題集にある問題IDを指すURLの場合", () => {
    const wrapper = createWrapper(`${playPath}?problem=${problemId}`);

    test("その問題を返すこと", () => {
      const { result } = renderHook(
        () => useRequestedProblem(findProblemById),
        { wrapper },
      );

      expect(result.current).toBe("問題A");
    });
  });

  const unresolvedCases = [
    ["問題IDの無い", playPath],
    ["引けない問題IDを指す", `${playPath}?problem=unknown`],
  ] as const;

  test.each(unresolvedCases)("%s URL では undefined を返すこと", (_, path) => {
    const { result } = renderHook(() => useRequestedProblem(findProblemById), {
      wrapper: createWrapper(path),
    });

    expect(result.current).toBeUndefined();
  });
});

describe("useProblemIdQuerySync", () => {
  describe("問題IDの無いURLの場合", () => {
    const wrapper = createWrapper(`${playPath}?from=home`);

    test("ほかのクエリを残したまま、問題IDを履歴を増やさずに加えること", () => {
      const { result } = renderHook(() => useSyncedLocation(identity), {
        wrapper,
      });

      expect(result.current.searchParams.get("problem")).toBe(problemId);
      expect(result.current.searchParams.get("from")).toBe("home");
      expect(result.current.navigationType).toBe("REPLACE");
    });
  });

  describe("遊んでいる問題と同じ問題IDのURLの場合", () => {
    const wrapper = createWrapper(`${playPath}?problem=${problemId}`);

    test("URLを置き換えないこと", () => {
      const { result } = renderHook(() => useSyncedLocation(identity), {
        wrapper,
      });

      expect(result.current.searchParams.get("problem")).toBe(problemId);
      expect(result.current.navigationType).toBe("POP");
    });
  });

  describe("遊んでいる問題が変わった場合", () => {
    const wrapper = createWrapper(`${playPath}?problem=${problemId}`);

    test("URLの問題IDを新しい問題のIDへ置き換えること", () => {
      const { result, rerender } = renderHook(
        (problemIdentity: ProblemIdentity) =>
          useSyncedLocation(problemIdentity),
        { wrapper, initialProps: identity },
      );
      rerender(otherIdentity);

      expect(result.current.searchParams.get("problem")).toBe(otherProblemId);
      expect(result.current.navigationType).toBe("REPLACE");
    });
  });

  describe("同じ内容の identity で遊び直した場合", () => {
    const wrapper = createWrapper(`${playPath}?problem=${problemId}`);

    test("URLを置き換えないこと", () => {
      const { result, rerender } = renderHook(
        (problemIdentity: ProblemIdentity) =>
          useSyncedLocation(problemIdentity),
        { wrapper, initialProps: identity },
      );
      rerender({ ...identity });

      expect(result.current.searchParams.get("problem")).toBe(problemId);
      expect(result.current.navigationType).toBe("POP");
    });
  });

  describe("null を渡した場合", () => {
    const wrapper = createWrapper(`${playPath}?seed=a`);

    test("URLに触れないこと", () => {
      const { result } = renderHook(() => useSyncedLocation(null), {
        wrapper,
      });

      expect(result.current.searchParams.toString()).toBe("seed=a");
      expect(result.current.navigationType).toBe("POP");
    });
  });
});
