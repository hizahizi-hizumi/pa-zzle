import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";

import {
  createProblemId,
  type ProblemId,
  type ProblemIdentity,
} from "@/games/problem-id";

/** プレイ画面の URL で、遊んでいる問題を問題 ID で表すクエリ。例: `/puzzles/minesweeper/play/1?problem=0123456789` */
const problemIdQueryKey = "problem";

/** プレイ画面を問題 ID の問題で開くための URL のクエリ文字列（`?problem=<問題ID>`）を作る。 */
export function createProblemIdSearch(problemId: ProblemId): string {
  return `?${new URLSearchParams({ [problemIdQueryKey]: problemId })}`;
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

/**
 * 遊んでいる問題の ID を、履歴を増やさずに URL のクエリへ反映し続ける。
 * 再読み込みしても `useRequestedProblem` が同じ問題を引けるようにする。`null` を渡すと URL に触れない。
 */
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
