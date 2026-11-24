import { HowToPlayExample } from "@/components/HowToPlayExample";
import {
  HowToPlayVerdict,
  type HowToPlayVerdictLabels,
} from "@/components/HowToPlayVerdict";
import { canPlaceSolitaireCardOnColumn } from "@/games/solitaire/puzzle/rules";
import type { SolitaireColumn } from "@/games/solitaire/puzzle/state";
import { SolitaireEmptySlot } from "@/games/solitaire/ui/board/SolitaireEmptySlot";
import {
  FIGURE_CARD_WIDTH,
  FigureColumn,
} from "@/games/solitaire/ui/SolitaireHowToPlayDialog/FigureColumn";
import { PlacementFigure } from "@/games/solitaire/ui/SolitaireHowToPlayDialog/PlacementFigure";

type ColumnPlacementExampleProps = {
  base: SolitaireColumn;
  placed: SolitaireColumn;
  labels: HowToPlayVerdictLabels;
};

/** 列 `base` の一番手前に `placed` の並びを置こうとする姿と、置けるかの判定。判定はプレイと同じ規則で求める。 */
export function ColumnPlacementExample({
  base,
  placed,
  labels,
}: ColumnPlacementExampleProps) {
  const [first] = placed;
  const allowed =
    first !== undefined && canPlaceSolitaireCardOnColumn(first, base);
  return (
    <HowToPlayExample
      figure={
        <PlacementFigure
          destination={
            base.length === 0 ? (
              <SolitaireEmptySlot width={FIGURE_CARD_WIDTH} />
            ) : (
              <FigureColumn cards={base} />
            )
          }
          moved={<FigureColumn cards={placed} />}
        />
      }
      caption={
        <HowToPlayVerdict
          verdict={allowed ? "allowed" : "disallowed"}
          labels={labels}
        />
      }
    />
  );
}
