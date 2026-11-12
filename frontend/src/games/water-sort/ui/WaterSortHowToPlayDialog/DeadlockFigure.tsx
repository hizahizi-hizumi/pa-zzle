import { DeadlockNotice } from "@/games/water-sort/ui/DeadlockNotice";
import { waterSortGroundClassName } from "@/games/water-sort/ui/WaterSortGround";
import { BottleSizeScope } from "@/games/water-sort/ui/WaterSortHowToPlayDialog/BottleSizeScope";
import { deadlockFigure } from "@/games/water-sort/ui/WaterSortHowToPlayDialog/figure-boards";
import { HowToPlayFigure } from "@/games/water-sort/ui/WaterSortHowToPlayDialog/HowToPlayFigure";
import { cn } from "@/lib/utils";

function ignoreNoticePress() {}

/**
 * 手詰まりの盤面と、その下にプレイ画面と同じ手詰まりの知らせを、押しても何も起きない静止の図で並べる。
 * 盤面は例と同じ大きさのボトルで描く。ルールの例と同じ面に置く。
 */
export function DeadlockFigure() {
  return (
    // 押せない1枚の絵として、読み上げでは名前だけを伝える。
    <div
      role="img"
      aria-label="手詰まりの盤面と知らせ"
      className="flex flex-col items-center gap-2"
    >
      <BottleSizeScope size="example">
        <HowToPlayFigure frame={deadlockFigure} />
      </BottleSizeScope>
      {/* 知らせのボタンの面は例の面と同じ色で見えなくなるので、プレイ画面と同じ地の上に置く。 */}
      {/* ほかの押せない図と同じく、本番の見た目のまま押せなくし、指を重ねても押せる形のカーソルを出さない。 */}
      <span
        aria-hidden="true"
        inert
        className={cn("flex rounded-md", waterSortGroundClassName)}
      >
        <DeadlockNotice
          canUndo
          onUndo={ignoreNoticePress}
          onRestart={ignoreNoticePress}
        />
      </span>
    </div>
  );
}
