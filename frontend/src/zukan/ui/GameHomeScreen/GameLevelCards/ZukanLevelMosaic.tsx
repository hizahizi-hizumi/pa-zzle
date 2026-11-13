import { memo, useMemo } from "react";

import { listZukanLevelMosaicPaths } from "@/zukan/ui/GameHomeScreen/zukan-level-mosaic";
import {
  getZukanProblemStatusColorClassName,
  zukanProblemStatusOrder,
} from "@/zukan/ui/GameHomeScreen/zukan-problem-appearance";
import type { ZukanProblemStatus } from "@/zukan/zukan-collection";

type ZukanLevelMosaicProps = {
  /** そのレベルの全問を番号の順に並べる。 */
  shownStatuses: readonly ZukanProblemStatus[];
  columnCount: number;
};

function ZukanLevelMosaicContent({
  shownStatuses,
  columnCount,
}: ZukanLevelMosaicProps) {
  const rowCount = Math.max(1, Math.ceil(shownStatuses.length / columnCount));
  const paths = useMemo(
    () => listZukanLevelMosaicPaths(shownStatuses, columnCount),
    [shownStatuses, columnCount],
  );

  return (
    <svg
      aria-hidden="true"
      data-level-mosaic=""
      viewBox={`0 0 ${columnCount} ${rowCount}`}
      preserveAspectRatio="none"
      className="block aspect-2/1 w-full"
    >
      {zukanProblemStatusOrder.map((status) => {
        const path = paths.get(status);
        return path === undefined ? null : (
          <path
            key={status}
            d={path}
            fill="currentColor"
            className={getZukanProblemStatusColorClassName(status)}
          />
        );
      })}
    </svg>
  );
}

export const ZukanLevelMosaic = memo(ZukanLevelMosaicContent);
