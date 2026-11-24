import type { CSSProperties } from "react";

import { HowToPlayPressHint } from "@/components/HowToPlayPressHint";
import type { SolitaireOperation } from "@/games/solitaire/play/use-solitaire-play";
import type { SolitairePile } from "@/games/solitaire/puzzle/pile-selection";
import type { SolitaireSource } from "@/games/solitaire/puzzle/rules";
import type { SolitaireState } from "@/games/solitaire/puzzle/state";
import {
  getSolitairePileTopPosition,
  type SolitaireBoardLayout,
} from "@/games/solitaire/ui/board/board-geometry";
import { SolitaireBoard } from "@/games/solitaire/ui/board/SolitaireBoard";
import { solitaireToneClassNames } from "@/games/solitaire/ui/solitaire-tone";
import { cn } from "@/lib/utils";

type HowToPlayBoardProps = {
  state: SolitaireState;
  layout: SolitaireBoardLayout;
  cardWidth: number;
  columnCardCapacity: number;
  selectedSource: SolitaireSource | null;
  operation: SolitaireOperation | null;
  /** 渡すと、山を本番の盤面と同じく押せる。渡さない盤面は、本番の盤面と同じく押せない山にする。 */
  onSelectPile?: (pile: SolitairePile) => void;
  /** 押す所の手がかりを付ける山。山のいちばん上（列はいちばん手前）の札に付ける。 */
  hintedPile?: SolitairePile | null;
  /** 卓の地の、盤面の周りの幅。採点の流れの図のコマは、狭い面に3つ並べるので詰める。 */
  groundPadding?: "regular" | "compact";
  onClearAnimationComplete?: () => void;
};

/** 卓の地の、盤面の周りの幅（px）。図の札の幅を置き場所から決めるときに、この幅を除く。 */
const HOW_TO_PLAY_GROUND_PADDING_PX = {
  regular: 8,
  compact: 4,
} as const;

function ignorePileSelection() {}

/**
 * 本番の盤面部品で描く、遊び方の盤面。例が使う山だけを、決まった大きさの札で並べ、本番と同じく選び・移し・当てて戻す。
 * 札の無い山の跡は卓の地を透かして描くので、プレイ画面と同じ卓の地を盤面の下に敷く。
 * 手がかりの破線の枠は札の縁に沿わせ、指は札の左下の内側に置く。札の左上には数とマーク、右下には大きなマークがあり、
 * 左下だけが空いているため。
 */
export function HowToPlayBoard({
  state,
  layout,
  cardWidth,
  columnCardCapacity,
  selectedSource,
  operation,
  onSelectPile,
  hintedPile = null,
  groundPadding = "regular",
  onClearAnimationComplete,
}: HowToPlayBoardProps) {
  return (
    <div
      className={cn("w-fit rounded-md", solitaireToneClassNames.ground)}
      style={{ padding: HOW_TO_PLAY_GROUND_PADDING_PX[groundPadding] }}
    >
      <SolitaireBoard
        state={state}
        selectedSource={selectedSource}
        operation={operation}
        interactionDisabled={onSelectPile === undefined}
        onSelectPile={onSelectPile ?? ignorePileSelection}
        onClearAnimationComplete={onClearAnimationComplete}
        fixedSize={{ layout, cardWidth, columnCardCapacity }}
        renderOverlay={(geometry) => {
          if (hintedPile === null) {
            return null;
          }
          const { left, top } = getSolitairePileTopPosition(
            geometry,
            state,
            hintedPile,
          );
          return (
            <span
              data-hinted-pile={hintedPile.pile}
              className="pointer-events-none absolute"
              style={
                {
                  left,
                  top,
                  width: geometry.cardWidth,
                  height: geometry.cardHeight,
                  "--how-to-play-unit": `${geometry.cardWidth}px`,
                } as CSSProperties
              }
            >
              <HowToPlayPressHint
                frame="edge"
                outline="square"
                pointer="inside-corner"
                corner="bottom-left"
              />
            </span>
          );
        }}
      />
    </div>
  );
}
