import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import type { GameHomeLayerControl } from "@/zukan/ui/GameHomeScreen/use-game-home-layers";
import {
  getZukanProblemStatusColorClassName,
  zukanProblemStatusLabels,
  zukanProblemStatusOrder,
} from "@/zukan/ui/GameHomeScreen/zukan-problem-appearance";

/**
 * マスの塗りが、どの評価段階・状態を表すかの見本。台紙を広く見せるよう、常には出さず、見出しのメニューの「見方」を選んだときだけ、メニューのボタンから出す。
 */
export function ZukanLegend({
  open,
  onOpenChange,
  anchorRef,
}: GameHomeLayerControl) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor virtualRef={anchorRef} />
      <PopoverContent align="end">
        <ul
          aria-label="マスの見方"
          className="grid grid-cols-2 gap-x-4 gap-y-2 text-supporting"
        >
          {zukanProblemStatusOrder.map((status) => (
            <li key={status} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={`size-4 shrink-0 bg-current ${getZukanProblemStatusColorClassName(status)}`}
              />
              {zukanProblemStatusLabels[status]}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
