import { HowToPlayExample } from "@/components/HowToPlayExample";
import {
  findBridgesExampleHint,
  getBridgesExampleIslandStatuses,
  listBridgesExampleCandidates,
} from "@/games/bridges/ui/BridgesHowToPlayDialog/example-board";
import type { BridgesHowToPlayExample } from "@/games/bridges/ui/BridgesHowToPlayDialog/figure-boards";
import { ConnectionCaption } from "@/games/bridges/ui/BridgesHowToPlayDialog/TouchableExample/ConnectionCaption";
import { CountCaption } from "@/games/bridges/ui/BridgesHowToPlayDialog/TouchableExample/CountCaption";
import { CrossingCaption } from "@/games/bridges/ui/BridgesHowToPlayDialog/TouchableExample/CrossingCaption";
import { ExampleBoard } from "@/games/bridges/ui/BridgesHowToPlayDialog/TouchableExample/ExampleBoard";
import { useTouchableExample } from "@/games/bridges/ui/BridgesHowToPlayDialog/use-touchable-example";

/**
 * 図の下に添える判定。どれも、触った後も今の盤面から本番のルールで出し直す。
 * - `count`: 数字と同じ本数のルール（形のルール）。
 * - `connection`: 全部の島をつなげるルール（形のルール）。
 * - `crossing`: 交差のルール（手のルール）。印を付ける島から出る線に手ごとの印を付けて凡例を添え、手を打った後はその結果を言う。
 */
export type BridgesTouchableExampleCaption =
  | "count"
  | "connection"
  | "crossing";

type TouchableExampleProps = {
  example: BridgesHowToPlayExample;
  /** 渡さない例（操作の例）は、言葉を添えない。 */
  caption?: BridgesTouchableExampleCaption;
};

/**
 * 触れる例。本番の盤面部品で、本番の指・マウス・キーボードの操作と同じに、島の間を押す・島からなぞる・島を選んで相手を押すと
 * 橋が回り、交差する橋があれば阻まれた反応を返す。ルールの例も操作の例も同じに動く。
 * 本番と同じく、島を選んでいる間の Esc は選びを解く（遊び方の層は閉じない）。
 * 図の下の判定と盤面の手ごとの印は、触った後も今の盤面から本番のルールで出し直す。
 * 押す所の手がかりは、触る前の姿から例が見せる手を順に打っていく途中の姿でだけ付ける。
 */
export function TouchableExample({ example, caption }: TouchableExampleProps) {
  const touchable = useTouchableExample(example);
  const { example: board } = touchable;
  const candidates =
    caption === "crossing" ? listBridgesExampleCandidates(board) : [];

  function renderCaption() {
    switch (caption) {
      case undefined:
        return undefined;
      case "count":
        return <CountCaption example={board} />;
      case "connection":
        return <ConnectionCaption example={board} />;
      case "crossing":
        return <CrossingCaption example={board} candidates={candidates} />;
    }
  }

  return (
    <HowToPlayExample
      figure={
        <ExampleBoard
          board={board.definition.board}
          bridges={board.bridges}
          islandStatuses={getBridgesExampleIslandStatuses(board)}
          edgeNotice={board.edgeNotice}
          clearing={touchable.clearing}
          solved={touchable.solved}
          hint={findBridgesExampleHint(board)}
          selectedIsland={board.selectedIsland}
          candidates={candidates.filter(
            ({ edge }) => edge !== touchable.blockedReactionEdge,
          )}
          onCycleEdge={touchable.cycleEdge}
          onSelectIsland={touchable.selectIsland}
          onShowCandidates={touchable.showCandidates}
          onMissPress={touchable.missPress}
          onClearAnimationComplete={touchable.completeClearAnimation}
        />
      }
      caption={renderCaption()}
    />
  );
}
