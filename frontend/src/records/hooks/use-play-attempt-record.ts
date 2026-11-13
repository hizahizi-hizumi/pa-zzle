import { useEffect, useRef } from "react";

import {
  isSamePlayStart,
  type PlayAttempt,
  type PlayAttemptAbandonment,
  type PlayAttemptProgress,
  type PlayAttemptStart,
} from "@/records/play-attempt";
import {
  abandonPlayAttempt,
  discardPlayAttempt,
  startPlayAttempt,
} from "@/records/play-attempt-storage";

type PlayAttemptSource = Pick<PlayAttempt, "gameId" | "startedAt"> & {
  start: PlayAttemptStart;
  finished: boolean;
  /** 盤面の状態。始めたときから一度も置き換わっていなければ、盤面を操作していないプレイとする。 */
  boardState: unknown;
  getProgress: (abandonedAt: number) => PlayAttemptProgress;
};

type PendingAbandonment = {
  play: Pick<PlayAttempt, "gameId" | "startedAt">;
  cancelled: boolean;
};

/** 離れたときに残すもの。操作しないまま離れたプレイは、始めた記録ごと除く。 */
type Departure =
  | { kind: "abandoned"; abandonment: PlayAttemptAbandonment }
  | { kind: "untouched" };

function saveDeparture(
  play: Pick<PlayAttempt, "gameId" | "startedAt">,
  departure: Departure,
): void {
  if (departure.kind === "abandoned") {
    abandonPlayAttempt(play, departure.abandonment);
  } else {
    discardPlayAttempt(play);
  }
}

/**
 * プレイを始めたことを保存し、解き終える前に離れたら進み具合を離脱として保存する。
 * 一度も盤面を操作しないまま離れたときは、離脱として残さず、始めた記録も除く。
 * `gameId`・`startedAt` が変わると別のプレイとして扱う。
 */
export function usePlayAttemptRecord(source: PlayAttemptSource): void {
  const latest = useRef(source);
  const pendingAbandonment = useRef<PendingAbandonment | null>(null);
  const startBoardState = useRef<unknown>(source.boardState);
  const operated = useRef(false);

  // 別のプレイへ置き換えたときのクリーンアップは、前のプレイの最後に確定した状態で離脱を保存する。
  // useEffectEvent はクリーンアップより前に置き換え後の値へ切り替わるため使わず、確定後の effect で更新する。
  // 後続の effect より先に宣言し、新しいプレイの開始時にはそのプレイの状態を読めるようにする。
  useEffect(() => {
    latest.current = source;
    if (source.boardState !== startBoardState.current) {
      operated.current = true;
    }
  });

  const { gameId, startedAt } = source;
  useEffect(() => {
    const play = { gameId, startedAt };
    const pending = pendingAbandonment.current;
    if (pending && isSamePlayStart(pending.play, play)) {
      pending.cancelled = true;
      pendingAbandonment.current = null;
    }
    // StrictMode の張り直しでは、張り直す前に操作していないので、数え直しても変わらない。
    startBoardState.current = latest.current.boardState;
    operated.current = false;
    startPlayAttempt({
      ...play,
      start: latest.current.start,
      abandonment: null,
    });

    function captureDeparture(): Departure | null {
      const { finished, getProgress } = latest.current;
      if (finished) {
        return null;
      }
      if (!operated.current) {
        return { kind: "untouched" };
      }
      const abandonedAt = Date.now();
      return {
        kind: "abandoned",
        abandonment: { abandonedAt, progress: getProgress(abandonedAt) },
      };
    }
    function handlePageHide(event: PageTransitionEvent) {
      const departure = captureDeparture();
      // bfcache に入ったページは、戻ると effect を張り直さずにこのプレイを続けるので、始めた記録を残す。
      if (!departure || (departure.kind === "untouched" && event.persisted)) {
        return;
      }
      saveDeparture(play, departure);
    }
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);

      const departure = captureDeparture();
      if (!departure) {
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
          saveDeparture(play, departure);
        }
      });
    };
  }, [gameId, startedAt]);
}
