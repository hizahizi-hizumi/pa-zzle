import {
  ChartLine,
  CircleHelp,
  InfoIcon,
  ListFilterIcon,
  MenuIcon,
} from "lucide-react";
import { type RefObject, useRef } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { GameHomeLayer } from "@/zukan/ui/GameHomeScreen/use-game-home-layers";

type GameHomeMenuProps = {
  /** メニューのボタン。開いた層を寄せて出し、層を閉じたらフォーカスを戻すのに使う。 */
  buttonRef: RefObject<HTMLButtonElement | null>;
  filterConditionCount: number;
  onOpenLayer: (layer: GameHomeLayer) => void;
};

/**
 * 見出しの補助の操作は、どの画面幅でも同じ1つのボタンから開く。
 * チュートリアルは遊び方の中からだけ開く。
 */
export function GameHomeMenu({
  buttonRef,
  filterConditionCount,
  onOpenLayer,
}: GameHomeMenuProps) {
  // 選んだ層は、メニューが閉じ切ってから開く。閉じていくメニューがフォーカスを取り戻すと、開いたばかりのポップオーバーが外へのフォーカスで閉じるため。
  const chosenLayerRef = useRef<GameHomeLayer | null>(null);
  const isFiltering = filterConditionCount > 0;
  const filterLabel = isFiltering
    ? `絞り込み、条件${filterConditionCount}つ`
    : "絞り込み";

  function chooseLayer(layer: GameHomeLayer) {
    chosenLayerRef.current = layer;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          ref={buttonRef}
          type="button"
          variant="quiet"
          size="sm"
          aria-label={
            isFiltering
              ? `メニュー、絞り込みの条件${filterConditionCount}つ`
              : "メニュー"
          }
        >
          {/* 条件を付け外ししてもボタンの大きさとアイコンの位置を変えないよう、条件の数の印はアイコンの前に常に置き、条件が無い間は見えなくする。 */}
          <span
            aria-hidden="true"
            data-condition-count-mark=""
            className={isFiltering ? "inline-flex" : "invisible inline-flex"}
          >
            <Badge>
              <span className="tabular-nums">{filterConditionCount}</span>
            </Badge>
          </span>
          <MenuIcon aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onCloseAutoFocus={(event) => {
          const layer = chosenLayerRef.current;
          if (layer !== null) {
            chosenLayerRef.current = null;
            // フォーカスはボタンへ戻さず、開く層へ渡す。
            event.preventDefault();
            onOpenLayer(layer);
          }
        }}
      >
        <DropdownMenuItem onSelect={() => chooseLayer("howToPlay")}>
          <CircleHelp aria-hidden="true" />
          遊び方
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => chooseLayer("legend")}>
          <InfoIcon aria-hidden="true" />
          見方
        </DropdownMenuItem>
        <DropdownMenuItem
          aria-label={filterLabel}
          onSelect={() => chooseLayer("filter")}
        >
          <ListFilterIcon aria-hidden="true" />
          絞り込み
          {isFiltering && (
            <span aria-hidden="true" className="ms-auto inline-flex ps-4">
              <Badge>
                <span className="tabular-nums">{filterConditionCount}</span>
              </Badge>
            </span>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => chooseLayer("performance")}>
          <ChartLine aria-hidden="true" />
          成績
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
