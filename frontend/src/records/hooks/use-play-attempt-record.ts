import { useEffect, useRef } from "react";

import type {
  PlayAttempt,
  PlayAttemptAbandonment,
} from "@/records/play-attempt";
import {
  abandonPlayAttempt,
  resumePlayAttempt,
  startPlayAttempt,
} from "@/records/play-attempt-storage";

type PlayAttemptProgressSource = {
  /** そのプレイを解き終えたか。解き終えたプレイは完了記録で扱うので、離脱を保存しない。 */
  finished: boolean;
  /** 離れた時刻までの進み具合を返す。 */
  getProgress: (abandonedAt: number) => unknown;
};

type TrackedPlayAttempt = PlayAttemptProgressSource & {
  attempt: PlayAttempt | null;
};

type PendingAbandonment = {
  attemptId: string;
  cancelled: boolean;
};

function captureAbandonment(
  { finished, getProgress }: PlayAttemptProgressSource,
  abandonedAt: number,
): PlayAttemptAbandonment | null {
  return finished ? null : { abandonedAt, progress: getProgress(abandonedAt) };
}

/**
 * プレイを始めたことを保存し、解き終える前に離れたら進み具合を離脱として保存する。
 * 離脱として扱うのは、プレイ画面を離れたとき・別のプレイに置き換えたとき・ページを離れたとき。
 * `attempt` が `null` のプレイは記録しない。`attempt.id` が変わると別のプレイとして扱う。
 */
export function usePlayAttemptRecord(
  attempt: PlayAttempt | null,
  { finished, getProgress }: PlayAttemptProgressSource,
): void {
  const tracked = useRef<TrackedPlayAttempt>({
    attempt,
    finished,
    getProgress,
  });
  const pendingAbandonment = useRef<PendingAbandonment | null>(null);

  // 別のプレイへ置き換えたときのクリーンアップは、前のプレイの最後に確定した状態で離脱を保存する。
  // useEffectEvent はクリーンアップより前に置き換え後の値へ切り替わるため使わず、確定後の effect で更新する。
  // 後続の effect より先に宣言し、新しいプレイの開始時にはそのプレイの状態を読めるようにする。
  useEffect(() => {
    tracked.current = { attempt, finished, getProgress };
  });

  const attemptId = attempt?.id ?? null;
  useEffect(() => {
    const current = tracked.current.attempt;
    if (!current || current.id !== attemptId) {
      return;
    }
    const currentId = current.id;

    const pending = pendingAbandonment.current;
    if (pending?.attemptId === currentId) {
      pending.cancelled = true;
      pendingAbandonment.current = null;
    }
    startPlayAttempt(current);

    let pageHiddenAbandonedAt: number | null = null;
    function handlePageHide() {
      const abandonment = captureAbandonment(tracked.current, Date.now());
      if (
        abandonment &&
        abandonPlayAttempt(currentId, abandonment) === "saved"
      ) {
        pageHiddenAbandonedAt = abandonment.abandonedAt;
      }
    }
    function handlePageShow(event: PageTransitionEvent) {
      // bfcache から戻るとプレイが続くので、ページを離れたときの離脱を取り消す。
      if (event.persisted && pageHiddenAbandonedAt !== null) {
        resumePlayAttempt(currentId, pageHiddenAbandonedAt);
      }
      pageHiddenAbandonedAt = null;
    }
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);

      const abandonment = captureAbandonment(tracked.current, Date.now());
      if (!abandonment) {
        return;
      }

      // StrictMode の開発時は effect を外してすぐ張り直すので、張り直されなかったときだけ保存する。
      const pending: PendingAbandonment = {
        attemptId: currentId,
        cancelled: false,
      };
      pendingAbandonment.current = pending;
      queueMicrotask(() => {
        if (pendingAbandonment.current === pending) {
          pendingAbandonment.current = null;
        }
        if (!pending.cancelled) {
          abandonPlayAttempt(currentId, abandonment);
        }
      });
    };
  }, [attemptId]);
}
