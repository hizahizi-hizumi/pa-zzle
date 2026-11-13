import { Pointer } from "lucide-react";
import type { CSSProperties, Ref } from "react";

import type { WaterSortOperation } from "@/games/water-sort/play/use-water-sort-play";
import type { WaterSortState } from "@/games/water-sort/puzzle/state";
import {
  WATER_SORT_BOTTLE_ASPECT_RATIO,
  WATER_SORT_HOW_TO_PLAY_GAP_PROPERTY,
  WaterSortBoard,
} from "@/games/water-sort/ui/board/WaterSortBoard";
import {
  getBottleRowGap,
  getBottleRowWidth,
} from "@/games/water-sort/ui/WaterSortHowToPlayDialog/bottle-size";
import { cn } from "@/lib/utils";

type HowToPlayBoardProps = {
  bottles: WaterSortState;
  /**
   * - `example`: ルールと操作の例。ゴールの盤面と同じ大きさに見えるボトルで描く。
   * - `goal`: 入口のゴールの盤面。ボトルの幅は置き場所が `--water-sort-figure-bottle` で決める。
   */
  size: "example" | "goal";
  sourceBottleIndex: number | null;
  operation: WaterSortOperation | null;
  /** 渡すと、ボトルを本番の盤面と同じく押せる。渡さない盤面は、本番の盤面と同じく押せないボトルにする（カーソルも普通の形）。 */
  onSelectBottle?: (bottleIndex: number) => void;
  /** 押す所の手がかりを付けるボトル。ボトルの形に沿う破線の枠と指のアイコンを、動かさずに描く。 */
  hintedBottleIndex?: number | null;
  onClearAnimationComplete?: () => void;
  ref?: Ref<HTMLDivElement>;
};

function ignoreBottleSelection() {}

/**
 * 本番の盤面部品で描く、遊び方の盤面。ボトルを1段に並べ、本番と同じく選んだボトルを持ち上げ、注ぐ動きと揺れで応える。
 * ボトルの間は、本番のプレイ画面と同じ、ボトルの幅に対する比にする。
 * 注ぐボトルは注ぎ先の口の上へ移って傾き、注ぎ先の上へボトルの幅の約2倍まで届く。
 * ゴールの盤面は、その高さを盤面の上に取り、一文に重ならないようにする。
 * 例は、動きの無いときに上が空かないよう、選んだボトルの持ち上げ（本番の盤面と同じ 14px）だけを盤面の上に取り、面の上の余白をその上の余白にする。
 * 注ぐ間の傾いたボトルは面の上へはみ出して描き、遊び方の送る領域が帯の下で切る。周りの並びは動かさない。
 */
export function HowToPlayBoard({
  bottles,
  size,
  sourceBottleIndex,
  operation,
  onSelectBottle,
  hintedBottleIndex = null,
  onClearAnimationComplete,
  ref,
}: HowToPlayBoardProps) {
  const gap = getBottleRowGap(bottles.length);
  const columns: CSSProperties = {
    gridTemplateColumns: `repeat(${bottles.length}, minmax(0, 1fr))`,
    columnGap: gap,
  };
  return (
    <div
      ref={ref}
      className={cn(
        "relative box-content shrink-0",
        size === "goal" && "pt-[calc(var(--water-sort-figure-bottle)*2)]",
        // 注ぐボトルは注ぎ先の口の上で傾き、傾いた角が口からボトルの幅の約2倍上まで届く。その高さに 8px を足した分を、面の上の余白と合わせて取り、
        // 動きを面の中に収める（選んだボトルの持ち上げもこの高さに収まる）。
        size === "example" &&
          "pt-[calc(var(--water-sort-figure-bottle)*2+8px-var(--how-to-play-panel-padding-block,0px))]",
      )}
      style={
        {
          width: getBottleRowWidth(bottles.length),
          // 本番の盤面部品に、遊び方の図と同じボトルの間を渡す。
          [WATER_SORT_HOW_TO_PLAY_GAP_PROPERTY]: gap,
        } as CSSProperties
      }
    >
      <WaterSortBoard
        state={bottles}
        sourceBottleIndex={sourceBottleIndex}
        operation={operation}
        onSelectBottle={onSelectBottle ?? ignoreBottleSelection}
        interactionDisabled={onSelectBottle === undefined}
        onClearAnimationComplete={onClearAnimationComplete}
        layout="single-row"
        spacing="howToPlay"
      />
      {hintedBottleIndex === null ? null : (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 grid"
          style={columns}
        >
          <span
            data-hinted-bottle={hintedBottleIndex}
            className="relative"
            style={{
              gridColumn: hintedBottleIndex + 1,
              aspectRatio: WATER_SORT_BOTTLE_ASPECT_RATIO,
            }}
          >
            <span className="absolute -inset-1 rounded-b-[1.7rem] border border-muted-foreground border-dashed" />
            <Pointer className="absolute -right-2.5 -bottom-2 size-5 fill-background text-muted-foreground" />
          </span>
        </span>
      )}
    </div>
  );
}
