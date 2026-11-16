import { useCallback, useEffect, useRef, useState } from "react";

import { useReportHowToPlayExampleChange } from "@/components/HowToPlayExamplePanel";
import { useHowToPlayExampleSelection } from "@/components/how-to-play-example-selection";
import {
  type BridgesExampleBoard,
  type BridgesExampleCycle,
  createBridgesExampleBoard,
  cycleBridgesExampleEdge,
  isBridgesExampleChanged,
  isBridgesExampleSolved,
  missBridgesExamplePress,
  selectBridgesExampleIsland,
  showBridgesExampleCandidates,
} from "@/games/bridges/ui/BridgesHowToPlayDialog/example-board";
import type { BridgesHowToPlayExample } from "@/games/bridges/ui/BridgesHowToPlayDialog/figure-boards";
import { BLOCKED_REACTION_MS } from "@/games/bridges/ui/board/flash-blocking-bridges";
import { useBridgesSoundEffects } from "@/games/bridges/ui/use-bridges-sound-effects";
import type { GameProgress } from "@/games/play";

/** 盤面へ渡す、例の今の姿と手。 */
export type BridgesTouchableExample = {
  example: BridgesExampleBoard;
  solved: boolean;
  /** 完成してから、本番のクリア演出を終えるまで `true`。 */
  clearing: boolean;
  /** 交わる橋に阻まれた手の、本番の反応を見せている間だけ持つ、押した辺。その辺の手ごとの印を消すのに使う。 */
  blockedReactionEdge: number | null;
  cycleEdge: (cycle: BridgesExampleCycle) => void;
  selectIsland: (island: number | null) => void;
  showCandidates: () => void;
  missPress: () => void;
  completeClearAnimation: () => void;
};

/**
 * 触れる例の状態。盤面から届いた手を本番のルールの遷移で打つので、本番と同じに、押すたびに 1本 → 2本 → なし と回り、
 * 交わる橋があれば阻まれる。全部の島がちょうどで1つにつながったら、本番のクリア演出を返し、それからは受け付けない。
 * 音は本番と同じフックで鳴らすので、動きを減らす設定でも本番と同じ音になる。
 * 橋を回したか阻まれた手のたびに、橋が触る前と違うかを例を並べる面に知らせ、最初の姿に戻すときは、面が例を作り直す。
 * `definition` は最初の描画のときだけ読み、変わっても例を作り直さない。
 */
export function useTouchableExample(
  definition: BridgesHowToPlayExample,
): BridgesTouchableExample {
  const [example, setExample] = useState(() =>
    createBridgesExampleBoard(definition),
  );
  // 盤面は、選んだ島の相手を押すと、選びを解いた知らせと橋を回す手を描き直しを待たずに続けて送る。次の手を今の姿へ当てるため、姿を同時に持つ。
  const exampleRef = useRef(example);
  // 最初から完成した姿の例（ルールのできる形）は、本番の完成した盤面の見た目で静止させ、クリア演出を返さない。
  const [clearAnimationDone, setClearAnimationDone] = useState(() =>
    isBridgesExampleSolved(example),
  );
  const reportChange = useReportHowToPlayExampleChange();
  const solved = isBridgesExampleSolved(example);
  const clearing = solved && !clearAnimationDone;
  const progress: GameProgress = !solved
    ? "playing"
    : clearing
      ? "clearing"
      : "result";

  // 本番の盤面は Esc で島の選びを解くので、選んでいる間を遊び方の層に知らせ、層の Esc で選びを解く。
  useHowToPlayExampleSelection(example.selectedIsland !== null, () =>
    apply(selectBridgesExampleIsland(exampleRef.current, null)),
  );

  useBridgesSoundEffects(
    example.edgeNotice,
    progress,
    example.definition.board,
    example.bridges,
  );

  // 阻まれた反応は短く点いて消えるので、点いている間だけ押した辺を渡す。消えた手の番号を覚え、時間が来たら渡すのをやめる。
  const [expiredNoticeId, setExpiredNoticeId] = useState<number | null>(null);
  const blockedNotice =
    example.edgeNotice?.change === "blocked" ? example.edgeNotice : null;
  useEffect(() => {
    if (blockedNotice === null) {
      return;
    }
    const timer = window.setTimeout(
      () => setExpiredNoticeId(blockedNotice.id),
      BLOCKED_REACTION_MS,
    );
    return () => window.clearTimeout(timer);
  }, [blockedNotice]);
  const blockedReactionEdge =
    blockedNotice !== null && blockedNotice.id !== expiredNoticeId
      ? blockedNotice.edge
      : null;

  const completeClearAnimation = useCallback(() => {
    setClearAnimationDone(true);
  }, []);

  function apply(next: BridgesExampleBoard): void {
    exampleRef.current = next;
    setExample(next);
  }

  return {
    example,
    solved,
    clearing,
    blockedReactionEdge,
    cycleEdge(cycle) {
      const next = cycleBridgesExampleEdge(exampleRef.current, cycle);
      apply(next);
      reportChange(isBridgesExampleChanged(next));
    },
    selectIsland(island) {
      apply(selectBridgesExampleIsland(exampleRef.current, island));
    },
    showCandidates() {
      apply(showBridgesExampleCandidates(exampleRef.current));
    },
    missPress() {
      apply(missBridgesExamplePress(exampleRef.current));
    },
    completeClearAnimation,
  };
}
