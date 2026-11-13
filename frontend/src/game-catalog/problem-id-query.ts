import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";

import {
  createProblemId,
  type ProblemId,
  type ProblemIdentity,
} from "@/games/problem-id";

/**
 * プレイ画面の URL で遊んでいる問題を、ゲームのホームの URL で選んでおく問題を、問題 ID で表すクエリ。
 * 例: `/puzzles/minesweeper/play/1?problem=0123456789`、`/puzzles/minesweeper?problem=0123456789`
 */
const problemIdQueryKey = "problem";

export function createProblemIdSearch(problemId: ProblemId): string {
  return `?${new URLSearchParams({ [problemIdQueryKey]: problemId })}`;
}

export function hasProblemIdQuery(search: string): boolean {
  return new URLSearchParams(search).has(problemIdQueryKey);
}

/**
 * ゲームのホームを開いたときの URL が指す問題 ID。指定が無ければ `null`。最初に選んでおく問題を決めるためだけに使い、以後 URL が変わっても読み直さない。
 * 読んだら履歴を増やさずに URL から外し、選びを変えたあとの再読み込みやブックマークで、開いたときの問題を選び直さないようにする。
 */
export function useRequestedProblemId(): ProblemId | null {
  const [searchParams, setSearchParams] = useSearchParams();
  const [problemId] = useState(() => searchParams.get(problemIdQueryKey));
  const hasProblemIdQuery = searchParams.has(problemIdQueryKey);

  useEffect(() => {
    if (!hasProblemIdQuery) {
      return;
    }
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete(problemIdQueryKey);
        return next;
      },
      { replace: true },
    );
  }, [hasProblemIdQuery, setSearchParams]);

  return problemId;
}

/**
 * プレイ画面を開いたときの URL が問題 ID で指す問題を引く。最初の問題を決めるためだけに使い、以後 URL が変わっても引き直さない。
 * 指定が無い・引けない ID なら `undefined` を返す。そのときは新しく選んだ問題の ID で `useProblemIdQuerySync` が URL を置き換える。
 */
export function useRequestedProblem<Problem>(
  findProblemById: (problemId: string) => Problem | null,
): Problem | undefined {
  const [searchParams] = useSearchParams();
  const [requestedProblem] = useState(() => {
    const problemId = searchParams.get(problemIdQueryKey);
    return problemId === null
      ? undefined
      : (findProblemById(problemId) ?? undefined);
  });
  return requestedProblem;
}

export function useProblemIdQuerySync(
  problemIdentity: ProblemIdentity | null,
): void {
  const [searchParams, setSearchParams] = useSearchParams();
  const problemId = useMemo(
    () => (problemIdentity ? createProblemId(problemIdentity) : null),
    [problemIdentity],
  );
  const queriedProblemId = searchParams.get(problemIdQueryKey);

  useEffect(() => {
    if (problemId === null || problemId === queriedProblemId) {
      return;
    }
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set(problemIdQueryKey, problemId);
        return next;
      },
      { replace: true },
    );
  }, [problemId, queriedProblemId, setSearchParams]);
}
