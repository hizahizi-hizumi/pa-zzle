import { useEffect, useState } from "react";

import {
  isTsumeShogiProblemPoolLoaded,
  loadTsumeShogiProblemPool,
} from "@/games/tsume-shogi/problem/problem-pool";

/** 問題集の本体の読み込み。`failed` は読み込めなかった（通信が切れたなど）。 */
export type TsumeShogiProblemPoolStatus = "loading" | "loaded" | "failed";

/**
 * 詰将棋の画面を開いたときに問題集の本体を読み込み、その状態を返す。読み込み済みなら最初から `loaded` を返す。
 * 問題を選ぶ・復元するのは `loaded` になってから。
 */
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
