import { useEffect, useState } from "react";

import {
  isTsumeShogiProblemPoolLoaded,
  loadTsumeShogiProblemPool,
} from "@/games/tsume-shogi/problem/problem-pool";

export type TsumeShogiProblemPoolStatus = "loading" | "loaded" | "failed";

/** 問題を選ぶ・復元するのは `loaded` になってから。 */
export function useTsumeShogiProblemPool(): TsumeShogiProblemPoolStatus {
  const [status, setStatus] = useState<TsumeShogiProblemPoolStatus>(() =>
    isTsumeShogiProblemPoolLoaded() ? "loaded" : "loading",
  );

  useEffect(() => {
    if (status !== "loading") return;

    let active = true;
    loadTsumeShogiProblemPool().then(
      function markLoaded() {
        if (active) setStatus("loaded");
      },
      function markFailed() {
        if (active) setStatus("failed");
      },
    );
    return () => {
      active = false;
    };
  }, [status]);

  return status;
}

export function usePreloadTsumeShogiProblemPool(): void {
  useEffect(() => {
    // 読み込めなくても知らせず、プレイ画面を開いたときに読み込み直す。
    loadTsumeShogiProblemPool().catch(function ignorePreloadFailure() {});
  }, []);
}
