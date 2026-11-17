import { HowToPlayCaptionLayers } from "@/components/HowToPlayCaptionLayers";
import { HowToPlayExample } from "@/components/HowToPlayExample";
import { HowToPlayMarkLegend } from "@/components/HowToPlayMarkLegend";
import type { HowToPlayPressHintGesture } from "@/components/HowToPlayPressHint";
import { HowToPlayVerdict } from "@/components/HowToPlayVerdict";
import {
  findMinesweeperExampleNextMove,
  isMinesweeperExampleCleared,
  judgeMinesweeperExampleCandidates,
} from "@/games/minesweeper/ui/MinesweeperHowToPlayDialog/example-board";
import type { MinesweeperHowToPlayExample } from "@/games/minesweeper/ui/MinesweeperHowToPlayDialog/figure-boards";
import { HowToPlayBoard } from "@/games/minesweeper/ui/MinesweeperHowToPlayDialog/HowToPlayBoard";

import { ModeToggle } from "@/games/minesweeper/ui/MinesweeperHowToPlayDialog/TouchableExample/ModeToggle";
import { useTouchableExample } from "@/games/minesweeper/ui/MinesweeperHowToPlayDialog/TouchableExample/use-touchable-example";

/**
 * 例の下に添える言葉。
 * - `candidates`: 閉じたマスごとの札（✓ 地雷なし / ✕ 地雷あり）とその凡例。開くと何が起きるかを決める手のルールの例。
 * - `completion`: 完成したかの判定（途中 / ✓ 完成）。完成のルールの例。
 * - `none`: 言葉を添えない操作の例。
 */
type MinesweeperExampleCaption = "candidates" | "completion" | "none";

type TouchableExampleProps = {
  example: MinesweeperHowToPlayExample;
  caption?: MinesweeperExampleCaption;
  /** 盤面の上に、プレイ画面の上と同じ呼び名で、盤面全体の地雷の数を添えるか。 */
  showsMineCount?: boolean;
  /** 盤面の右上に、本番と同じ旗の切り替えのボタンを置くか。旗を置く手の手がかりは、開くのままならボタンに付ける。 */
  showsModeToggle?: boolean;
  /** 手がかりの押し方。旗を置く手を、長押しでは指、右クリックではマウスの右ボタンで示す。 */
  hintPress?: HowToPlayPressHintGesture;
};

const completionLabels = { allowed: "完成", disallowed: "未完成" };

/** 札の意味。開く手の答えではなく、マスに地雷があるかで言う（「✕ 踏む」は「ここを踏め」と読めるため）。 */
const candidateLabels = { allowed: "地雷なし", disallowed: "地雷あり" };

/**
 * 触れる例。本番の盤面部品と同じく、押すと開き（周りに地雷が無ければ続けて開き）、旗に切り替えて押す・長押し・右クリックで旗を置いて外し、
 * 開いた数字を押すと旗の数がそろっていれば周りの残りを開く。地雷を開くと本番と同じに踏んだ地雷が残り、地雷ではないマスをすべて開くと、
 * 本番と同じく閉じたままの地雷を見せて、それ以上は押せなくなる。
 * 押す所の手がかりは、例が見せる手のうちまだ打っていない最初の手に付け、手を打つと次の手へ移し、無くなれば消す。
 */
export function TouchableExample({
  example: definition,
  caption = "none",
  showsMineCount = false,
  showsModeToggle = false,
  hintPress = "press",
}: TouchableExampleProps) {
  const { example, mode, changeMode, revealCell, toggleFlag, chordCell } =
    useTouchableExample(definition.rows);
  const cleared = isMinesweeperExampleCleared(example);
  const nextMove = findMinesweeperExampleNextMove(example, definition.moves);
  const togglesFirst =
    showsModeToggle && nextMove?.action === "flag" && mode === "reveal";
  const hint =
    nextMove === null || togglesFirst
      ? null
      : { cellIndex: nextMove.cellIndex, press: hintPress };
  const candidates =
    caption === "candidates"
      ? judgeMinesweeperExampleCandidates(example)
      : undefined;

  const board = (
    <HowToPlayBoard
      example={example}
      size="example"
      mode={mode}
      candidates={candidates}
      hint={hint}
      interactionDisabled={cleared}
      onRevealCell={revealCell}
      onToggleFlag={toggleFlag}
      onChordCell={chordCell}
    />
  );

  return (
    <HowToPlayExample
      figure={
        showsModeToggle ? (
          // 本番と同じく、旗の切り替えのボタンを盤面の右上に置く。
          <span className="flex flex-col items-end gap-2">
            <ModeToggle
              mode={mode}
              hinted={togglesFirst}
              onChange={changeMode}
            />
            {board}
          </span>
        ) : showsMineCount ? (
          // チュートリアルと同じく、盤面全体の地雷の数を、プレイ画面の上と同じ呼び名で盤面の上に置く。
          <span className="flex flex-col items-center gap-2">
            <span className="whitespace-nowrap text-muted-foreground tabular-nums">
              {`地雷 ${example.board.mineCellIndices.length}`}
            </span>
            {board}
          </span>
        ) : (
          board
        )
      }
      caption={
        caption === "candidates" && candidates !== undefined ? (
          // 地雷ではないマスをすべて開くと札が無くなるので、凡例の代わりに完成したことを同じ場所で言う。
          <HowToPlayCaptionLayers
            layers={[
              {
                id: "legend",
                shown: !cleared,
                content: (
                  <HowToPlayMarkLegend
                    labels={candidateLabels}
                    shownMarks={{
                      allowed: [...candidates.values()].includes("safe"),
                      disallowed: [...candidates.values()].includes("mine"),
                    }}
                  />
                ),
              },
              {
                id: "cleared",
                shown: cleared,
                content: (
                  <HowToPlayVerdict
                    verdict="allowed"
                    labels={completionLabels}
                  />
                ),
              },
            ]}
          />
        ) : caption === "completion" ? (
          <HowToPlayVerdict
            verdict={cleared ? "allowed" : "incomplete"}
            labels={completionLabels}
          />
        ) : undefined
      }
    />
  );
}
