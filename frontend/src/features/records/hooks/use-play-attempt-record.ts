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
 * プレイを始めたことを保存し、解き終える前に離れたら進み具合を離脱として保存する。
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
    startPlayAttempt({
      ...play,
      start: latest.current.start,
      abandonment: null,
    });

    function captureAbandonment(): PlayAttemptAbandonment | null {
      const { finished, getProgress } = latest.current;
      const abandonedAt = Date.now();
      return finished
        ? null
        : { abandonedAt, progress: getProgress(abandonedAt) };
    }
    function handlePageHide() {
      const abandonment = captureAbandonment();
      if (abandonment) {
        abandonPlayAttempt(play, abandonment);
      }
    }
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);

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
