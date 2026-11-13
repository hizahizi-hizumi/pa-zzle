import { HowToPlayExample } from "@/components/HowToPlayExample";
import type { TakuzuHowToPlayFigureBoard } from "@/games/takuzu/ui/TakuzuHowToPlayDialog/figure-boards";
import { HowToPlayFigure } from "@/games/takuzu/ui/TakuzuHowToPlayDialog/HowToPlayFigure";
import { TileLegend } from "@/games/takuzu/ui/TakuzuHowToPlayDialog/TouchableGivenTileExample/TileLegend";
import { useTouchableExample } from "@/games/takuzu/ui/TakuzuHowToPlayDialog/use-touchable-example";
import {
  VerdictCaption,
  type VerdictLabels,
} from "@/games/takuzu/ui/TakuzuHowToPlayDialog/VerdictCaption";

type TouchableGivenTileExampleProps = {
  /** 最初からあるタイルと置いたタイルを混ぜた盤面。押す所の手がかりは、最初からあるタイルに付ける。 */
  board: TakuzuHowToPlayFigureBoard;
};

const changeLabels: VerdictLabels = {
  allowed: "変えられる",
  disallowed: "変えられない",
};

/**
 * 「最初からあるタイルは変えられない」を手のルールとして見せる触れる例。
 * 判定は、最後に押したタイルを変えられたか（✓ 変えられる / ✕ 変えられない）を出す。
 * 押す前は、手がかりを付けた最初からあるタイルを押す手の答え（✕ 変えられない）を出す。
 * 最初からあるタイルは本番と同じく揺れて変わらず、置いたタイルは本番と同じ順に変わる。
 * 手がかりは、何か押したら消す。手の続きが無いため。最初からあるタイルと置いたタイルの色の凡例を判定の下に添える。
 */
export function TouchableGivenTileExample({
  board,
}: TouchableGivenTileExampleProps) {
  const { example, lastTap, tap } = useTouchableExample(board, "tap");
  const rejected = lastTap === null || lastTap.rejected;

  return (
    <HowToPlayExample
      figure={
        <HowToPlayFigure
          example={example}
          size="example"
          pressedCells={lastTap === null ? board.pressedCells : undefined}
          onTapCell={tap}
        />
      }
      caption={
        <span className="flex w-full flex-col items-center gap-2">
          <VerdictCaption
            verdict={rejected ? "disallowed" : "allowed"}
            labels={changeLabels}
          />
          <TileLegend />
        </span>
      }
    />
  );
}
