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
