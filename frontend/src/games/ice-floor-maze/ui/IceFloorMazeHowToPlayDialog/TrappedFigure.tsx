import { trappedFigure } from "@/games/ice-floor-maze/ui/IceFloorMazeHowToPlayDialog/figure-boards";
import { iceFloorMazeFigureCellClassNames } from "@/games/ice-floor-maze/ui/IceFloorMazeHowToPlayDialog/figure-size";
import { HowToPlayFigure } from "@/games/ice-floor-maze/ui/IceFloorMazeHowToPlayDialog/HowToPlayFigure";
import {
  IceFloorMazeTrappedNotice,
  TRAPPED_NOTICE_LABEL,
} from "@/games/ice-floor-maze/ui/IceFloorMazeTrappedNotice";
import { iceFloorMazeTone } from "@/games/ice-floor-maze/ui/ice-floor-maze-tone";
import { cn } from "@/lib/utils";

function ignoreNoticePress() {}

/**
 * もうゴールに止まれない盤面と、その下にプレイ画面と同じ知らせを、押しても何も起きない静止の図で並べる。
 * 盤面は例と同じ大きさのマスで描く。知らせのボタンの面は例の面と見分けにくいので、プレイ画面と同じ雪原の地の上に置く。
 */
export function TrappedFigure() {
  return (
    // 押せない1枚の絵として、読み上げでは名前だけを伝える。
    <div
      role="img"
      aria-label={`${TRAPPED_NOTICE_LABEL}盤面と知らせ`}
      className={cn(
        "flex flex-col items-center gap-2",
        iceFloorMazeFigureCellClassNames.example,
      )}
    >
      <HowToPlayFigure
        board={trappedFigure.board}
        state={trappedFigure.state}
        goal={trappedFigure.goal}
        trail={trappedFigure.trail}
      />
      {/* ほかの押せない図と同じく、本番の見た目のまま押せなくし、指を重ねても押せる形のカーソルを出さない。 */}
      <span
        aria-hidden="true"
        inert
        className="flex rounded-md"
        style={{ backgroundColor: iceFloorMazeTone.snowfield }}
      >
        <IceFloorMazeTrappedNotice
          canUndo
          onUndo={ignoreNoticePress}
          onRestart={ignoreNoticePress}
        />
      </span>
    </div>
  );
}
