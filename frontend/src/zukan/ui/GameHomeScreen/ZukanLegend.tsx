import { CircleQuestionMarkIcon } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ZukanHeaderButton } from "@/zukan/ui/GameZukanScreen/ZukanHeaderButton";
import {
  getZukanProblemStatusClassName,
  zukanProblemStatusLabels,
  zukanProblemStatusOrder,
} from "@/zukan/ui/GameZukanScreen/zukan-problem-appearance";

/**
 * マスの塗りと枠が、どの評価段階・状態を表すかの見本。台紙を広く見せるよう、常には出さず「見方」を押したときだけ出す。
 */
export function ZukanLegend() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <ZukanHeaderButton
          icon={<CircleQuestionMarkIcon aria-hidden="true" />}
          label="見方"
        />
      </PopoverTrigger>
      <PopoverContent align="end">
        <ul
          aria-label="マスの見方"
          className="grid grid-cols-2 gap-x-4 gap-y-2 text-supporting"
        >
          {zukanProblemStatusOrder.map((status) => (
            <li key={status} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={`size-4 shrink-0 ${getZukanProblemStatusClassName(status)}`}
              />
              {zukanProblemStatusLabels[status]}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
