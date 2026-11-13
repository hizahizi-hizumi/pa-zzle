import { useEffect, useState } from "react";

import type {
  HakoiriMusumeLayout,
  HakoiriMusumePiece,
} from "@/games/hakoiri-musume/puzzle/board";
import {
  findHakoiriMusumeElementHint,
  type HakoiriMusumeElementHint,
} from "@/games/hakoiri-musume/ui/element-hints";
import {
  markHakoiriMusumeElementHintSeen,
  readSeenHakoiriMusumeElementHints,
} from "@/games/hakoiri-musume/ui/HakoiriMusumePlay/element-hint-storage";

type ProblemHint = {
  layout: HakoiriMusumeLayout;
  hint: HakoiriMusumeElementHint | null;
  dismissed: boolean;
};

function findHint(
  layout: HakoiriMusumeLayout,
  pieces: readonly HakoiriMusumePiece[],
): ProblemHint {
  return {
    layout,
    hint: findHakoiriMusumeElementHint(
      layout,
      pieces,
      readSeenHakoiriMusumeElementHints(),
    ),
    dismissed: false,
  };
}

/**
 * 遊んでいる問題の、新しい要素の案内。問題（盤の作り）が替わったときに、そのときの駒の並びで1回だけ決め、出したら出したことを残す。
 * 閉じるか、別の問題になるまで出しておく。
 */
export function useHakoiriMusumeElementHint(
  layout: HakoiriMusumeLayout,
  pieces: readonly HakoiriMusumePiece[],
): { hint: HakoiriMusumeElementHint | null; dismiss: () => void } {
  const [current, setCurrent] = useState(() => findHint(layout, pieces));
  let shown = current;
  if (current.layout !== layout) {
    shown = findHint(layout, pieces);
    setCurrent(shown);
  }
  const hintId = shown.hint?.id;
  useEffect(() => {
    if (hintId) {
      markHakoiriMusumeElementHintSeen(hintId);
    }
  }, [hintId]);
  return {
    hint: shown.dismissed ? null : shown.hint,
    dismiss: () => setCurrent((previous) => ({ ...previous, dismissed: true })),
  };
}
