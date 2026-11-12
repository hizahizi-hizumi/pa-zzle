import { memo, useMemo } from "react";

import { listZukanLevelMosaicPaths } from "@/zukan/ui/GameHomeScreen/zukan-level-mosaic";
import {
  getZukanProblemStatusColorClassName,
  zukanProblemStatusOrder,
} from "@/zukan/ui/GameHomeScreen/zukan-problem-appearance";
import type { ZukanProblemStatus } from "@/zukan/zukan-collection";

type ZukanLevelMosaicProps = {
  /** そのレベルの全問の、今示す状態。番号の順。 */
  statuses: readonly ZukanProblemStatus[];
  /** 台紙の列の数。台紙と同じ並びで描く。 */
  columnCount: number;
};

/**
 * 1つのレベルの台紙を遠くから見た縮図。全問を台紙と同じ列の数で1問1マスに並べ、台紙のマスと同じ色で塗って、カードの形に縮める。
 * 台紙を開かなくても、そのレベルのどこをどの出来で解いてきたかの分布が、台紙と同じ位置に見える。文字と数は持たない。
 * 数千のマスを要素にせず、状態ごとに1つのパスで塗る。
 */
function ZukanLevelMosaicContent({
  statuses,
  columnCount,
}: ZukanLevelMosaicProps) {
  const rowCount = Math.max(1, Math.ceil(statuses.length / columnCount));
  const paths = useMemo(
    () => listZukanLevelMosaicPaths(statuses, columnCount),
    [statuses, columnCount],
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
