import { useMemo } from "react";

import type { TsumeShogiSession } from "@/games/tsume-shogi/session/session";
import {
  getTsumeShogiExampleView,
  type TsumeShogiExampleView,
} from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog/example-board";

/**
 * 例の盤面に見せる値を、session が変わったときだけ求め直す。
 * 盤の升は、渡された最後の手が替わるたびに駒の着地の動きを始めから流すので、最後の手の組が同じ間は同じ手を渡し続ける。
 */
export function useTsumeShogiExampleView(
  session: TsumeShogiSession,
): TsumeShogiExampleView {
  const lastTurn = session.turns.at(-1);
  const { defenderReplyPending } = session;
  const view = useMemo(() => getTsumeShogiExampleView(session), [session]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 見せる手は最後の手の組と応手を待つかだけで決まるので、駒を選ぶ・弾かれるなどで session が替わっても作り直さない
  const shownMoves = useMemo(
    () => view.shownMoves,
    [lastTurn, defenderReplyPending],
  );
  return useMemo(() => ({ ...view, shownMoves }), [view, shownMoves]);
}
