import { useEffect, useRef } from "react";

import {
  isSamePlayStart,
  type PlayAttempt,
  type PlayAttemptAbandonment,
  type PlayAttemptProgress,
  type PlayAttemptStart,
} from "@/features/records/play-attempt";
import {
  abandonPlayAttempt,
  startPlayAttempt,
} from "@/features/records/play-attempt-storage";

type PlayAttemptSource = Pick<PlayAttempt, "gameId" | "startedAt"> & {
  start: PlayAttemptStart;
  finished: boolean;
  getProgress: (abandonedAt: number) => PlayAttemptProgress;
};

type PendingAbandonment = {
  play: Pick<PlayAttempt, "gameId" | "startedAt">;
  cancelled: boolean;
};

/**
 * プレイ開始と離脱時の進み具合を記録し、復帰した同じ挑戦の離脱を解除する。
 * `gameId`・`startedAt` が変わると別のプレイとして扱う。
 */
export function usePlayAttemptRecord(source: PlayAttemptSource): void {
  const latest = useRef(source);
  const pendingAbandonment = useRef<PendingAbandonment | null>(null);

  // 別のプレイへ置き換えたときのクリーンアップは、前のプレイの最後に確定した状態で離脱を保存する。
  // useEffectEvent はクリーンアップより前に置き換え後の値へ切り替わるため使わず、確定後の effect で更新する。
  // 後続の effect より先に宣言し、新しいプレイの開始時にはそのプレイの状態を読めるようにする。
  useEffect(() => {
    latest.current = source;
  });

  const { gameId, startedAt } = source;
  useEffect(() => {
    const play = { gameId, startedAt };
    const pending = pendingAbandonment.current;
    if (pending && isSamePlayStart(pending.play, play)) {
      pending.cancelled = true;
      pendingAbandonment.current = null;
    }
    function resumeAttempt() {
      startPlayAttempt({
        ...play,
        start: latest.current.start,
        abandonment: null,
      });
    }
    resumeAttempt();

    function captureAbandonment(): PlayAttemptAbandonment | null {
      const { finished, getProgress } = latest.current;
      const abandonedAt = Date.now();
      return finished
        ? null
        : { abandonedAt, progress: getProgress(abandonedAt) };
    }
    function handlePageHide(event: PageTransitionEvent) {
      if (event.persisted) return;
      const abandonment = captureAbandonment();
      if (abandonment) {
        abandonPlayAttempt(play, abandonment);
      }
    }
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted && !latest.current.finished) {
        resumeAttempt();
      }
    }
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);

      const abandonment = captureAbandonment();
      if (!abandonment) {
        return;
      }

      // StrictMode の開発時は effect を外してすぐ張り直すので、張り直されなかったときだけ保存する。
      const pending: PendingAbandonment = { play, cancelled: false };
      pendingAbandonment.current = pending;
      queueMicrotask(() => {
        if (pendingAbandonment.current === pending) {
          pendingAbandonment.current = null;
        }
        if (!pending.cancelled) {
          abandonPlayAttempt(play, abandonment);
        }
      });
    };
  }, [gameId, startedAt]);
}
