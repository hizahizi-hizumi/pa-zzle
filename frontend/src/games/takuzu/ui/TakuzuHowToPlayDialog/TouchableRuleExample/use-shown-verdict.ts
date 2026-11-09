import { useEffect, useState } from "react";

import { VIOLATION_MARK_DELAY_MS } from "@/games/takuzu/ui/board/violation-mark-timing";
import type {
  TakuzuExampleBoard,
  TakuzuExampleVerdict,
} from "@/games/takuzu/ui/TakuzuHowToPlayDialog/example-board";

/** 判定の言葉に出す、例の姿とその判定。判定に添える数と破ったルールも、この姿から求める。 */
export type TakuzuShownVerdict = {
  example: TakuzuExampleBoard;
  verdict: TakuzuExampleVerdict;
};

/**
 * 判定の言葉に出す例の姿。盤面の違反の印と同じ間合いで替える。
 * 反していない姿からルールに反した姿になったときは、印と同じく `VIOLATION_MARK_DELAY_MS` 待ってから替え、それまでは前の姿を出し続ける。
 * 判定に添える数も同じ姿から求めるので、数だけが先に替わることはない。
 * 反していない姿になったときと、反した姿のまま変わったとき（印が出たままのとき）は、すぐ替える。
 * 素早く2回押して反した姿を通り過ぎたときは、✕ を出さない。
 */
export function useShownVerdict(
  example: TakuzuExampleBoard,
  verdict: TakuzuExampleVerdict,
): TakuzuShownVerdict {
  const [settled, setSettled] = useState<TakuzuShownVerdict>({
    example,
    verdict,
  });
  const waits = verdict === "disallowed" && settled.verdict !== "disallowed";

  if (!waits && settled.example !== example) {
    setSettled({ example, verdict });
  }

  useEffect(() => {
    if (!waits) {
      return;
    }
    const timer = window.setTimeout(
      () => setSettled({ example, verdict }),
      VIOLATION_MARK_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [waits, example, verdict]);

  return waits ? settled : { example, verdict };
}
