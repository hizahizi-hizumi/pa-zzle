import { RotateCcw } from "lucide-react";
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";

import { useTouchTap } from "@/components/touch-tap";
import type { SolitaireOperation } from "@/games/solitaire/play/use-solitaire-play";
import {
  isSameSolitairePile,
  type SolitairePile,
} from "@/games/solitaire/puzzle/pile-selection";
import type { SolitaireSource } from "@/games/solitaire/puzzle/rules";
import {
  getSolitaireFoundationTop,
  type SolitaireState,
} from "@/games/solitaire/puzzle/state";
import {
  getSolitaireBoardContentHeight,
  getSolitaireBoardGeometry,
  getSolitaireFixedBoardGeometry,
  getSolitairePileSlotIndex,
  getSolitaireSlotLeft,
  type SolitaireBoardGeometry,
  type SolitaireBoardLayout,
  type SolitaireTopRowPile,
} from "@/games/solitaire/ui/board/board-geometry";
import {
  getSolitaireCardMotionKey,
  type SolitaireCardMotionKey,
} from "@/games/solitaire/ui/board/card-motion";
import { SolitaireCardBack } from "@/games/solitaire/ui/board/SolitaireCardBack";
import { SolitaireCardFace } from "@/games/solitaire/ui/board/SolitaireCardFace";
import { SolitaireEmptySlot } from "@/games/solitaire/ui/board/SolitaireEmptySlot";
import {
  getSolitaireColumnSelectionFrame,
  getSolitaireSelectionFrameStyle,
} from "@/games/solitaire/ui/board/selection-frame";
import { useSolitaireBoardMotion } from "@/games/solitaire/ui/board/use-solitaire-board-motion";
import {
  formatSolitaireCardName,
  solitaireSuitSymbols,
} from "@/games/solitaire/ui/card-text";

/**
 * 決まった大きさの札で描く盤面（遊び方の例など）の大きさ。
 * - `layout`: 並べる山。
 * - `cardWidth`: 札の幅（px）。
 * - `columnCardCapacity`: 列に取る高さ（札の枚数）。
 */
export type SolitaireFixedBoardSize = {
  layout: SolitaireBoardLayout;
  cardWidth: number;
  columnCardCapacity: number;
};

type SolitaireBoardProps = {
  state: SolitaireState;
  selectedSource: SolitaireSource | null;
  operation: SolitaireOperation | null;
  interactionDisabled: boolean;
  onSelectPile: (pile: SolitairePile) => void;
  onClearAnimationComplete?: () => void;
  /** 渡すと、盤面の大きさを測らず、その山だけをその大きさの札で描く。渡さなければ、プレイ画面と同じく測った大きさに全部の山を収める。 */
  fixedSize?: SolitaireFixedBoardSize;
  /** 盤面の山に重ねて描く物（遊び方の押す所の手がかりなど）。盤面の寸法から、置く所を求められる。 */
  renderOverlay?: (geometry: SolitaireBoardGeometry) => ReactNode;
};

function getPileKey(pile: SolitairePile): string {
  switch (pile.pile) {
    case "stock":
    case "waste":
      return pile.pile;
    case "column":
      return `column-${pile.columnIndex}`;
    case "foundation":
      return `foundation-${pile.suit}`;
  }
}

function describeStock(state: SolitaireState): string {
  return `山札、残り${state.stock.length}枚`;
}

function describeWaste(state: SolitaireState): string {
  const top = state.waste.at(-1);
  return `捨て札、${top === undefined ? "なし" : formatSolitaireCardName(top)}`;
}

function describeFoundation(
  state: SolitaireState,
  pile: Extract<SolitairePile, { pile: "foundation" }>,
): string {
  const top = getSolitaireFoundationTop(state.foundations, pile.suit);
  return `${solitaireSuitSymbols[pile.suit]}の組札、${top === null ? "なし" : formatSolitaireCardName(top)}`;
}

function describeColumn(state: SolitaireState, columnIndex: number): string {
  const column = state.columns[columnIndex] ?? [];
  return `列${columnIndex + 1}、${column.length === 0 ? "空" : column.map(formatSolitaireCardName).join(" ")}`;
}

/** 盤面の大きさを測る。測れない環境と、測らない盤面では 0 のまま。 */
function useBoardSize(measured: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const element = ref.current;
    if (!measured || !element || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        setSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [measured]);
  return { ref, size };
}

/**
 * ソリティアの盤面。上の段に左から山札・捨て札・空き・組札4つ（マークの順）を、その下に7列を、同じ格子に並べる。
 * 山（山札・捨て札・組札・列）を押すと `onSelectPile` で知らせる。列は札の無い所を含む列の範囲全体が押す所。
 * 置き元に選んだ山は、持ち上げずに、動かせる札を枠で囲んで示す。
 */
export function SolitaireBoard({
  state,
  selectedSource,
  operation,
  interactionDisabled,
  onSelectPile,
  onClearAnimationComplete,
  fixedSize,
  renderOverlay,
}: SolitaireBoardProps) {
  const { ref: boardRef, size } = useBoardSize(fixedSize === undefined);
  const pileRefs = useRef(new Map<string, HTMLButtonElement>());
  const cardElements = useRef(new Map<SolitaireCardMotionKey, HTMLElement>());
  const selectionFrameRef = useRef<HTMLSpanElement>(null);
  const { getTapHandlers } = useTouchTap();

  function getGeometry(columnLengths: readonly number[]) {
    return fixedSize === undefined
      ? getSolitaireBoardGeometry({ ...size, columnLengths })
      : getSolitaireFixedBoardGeometry(fixedSize);
  }
  const geometry = getGeometry(state.columns.map((column) => column.length));
  const { cardWidth, cardHeight } = geometry;
  const contentLeft =
    fixedSize === undefined
      ? Math.max(0, (size.width - geometry.contentWidth) / 2)
      : 0;

  useSolitaireBoardMotion({
    state,
    selectedSource,
    operation,
    geometry,
    getGeometry,
    getCardElement: (key) => cardElements.current.get(key),
    getPileElement: (pile) => pileRefs.current.get(getPileKey(pile)),
    getSelectionFrameElement: () => selectionFrameRef.current ?? undefined,
    onClearAnimationComplete,
  });

  function registerCard(key: SolitaireCardMotionKey) {
    return (element: HTMLElement | null) => {
      if (element) {
        cardElements.current.set(key, element);
      } else {
        cardElements.current.delete(key);
      }
    };
  }

  function registerPile(pile: SolitairePile) {
    return (element: HTMLButtonElement | null) => {
      const key = getPileKey(pile);
      if (element) {
        pileRefs.current.set(key, element);
      } else {
        pileRefs.current.delete(key);
      }
    };
  }

  function getPileProps(pile: SolitairePile, label: string) {
    const selected =
      selectedSource !== null && isSameSolitairePile(selectedSource, pile);
    return {
      ref: registerPile(pile),
      type: "button" as const,
      "aria-label": label,
      "aria-pressed": pile.pile === "stock" ? undefined : selected,
      disabled: interactionDisabled,
      className:
        "absolute cursor-pointer touch-manipulation select-none outline-none disabled:cursor-default focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      ...getTapHandlers(() => onSelectPile(pile)),
    };
  }

  const selectionFrameStyle = getSolitaireSelectionFrameStyle(cardWidth);

  function renderTopRowPile(pile: SolitaireTopRowPile) {
    const style = {
      left: getSolitaireSlotLeft(
        geometry,
        getSolitairePileSlotIndex(geometry, pile),
      ),
      top: 0,
      width: cardWidth,
      height: cardHeight,
    };
    const selectionFrame =
      selectedSource !== null && isSameSolitairePile(selectedSource, pile) ? (
        <span
          ref={selectionFrameRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={selectionFrameStyle}
        />
      ) : null;
    switch (pile.pile) {
      case "stock":
        return (
          <button
            key={getPileKey(pile)}
            {...getPileProps(pile, describeStock(state))}
            style={style}
          >
            {state.stock.length > 0 ? (
              <span ref={registerCard("stock")} className="relative block">
                <SolitaireCardBack width={cardWidth} />
              </span>
            ) : (
              <SolitaireEmptySlot width={cardWidth}>
                {state.waste.length > 0 ? (
                  <RotateCcw
                    style={{
                      width: cardWidth * 0.45,
                      height: cardWidth * 0.45,
                    }}
                  />
                ) : null}
              </SolitaireEmptySlot>
            )}
          </button>
        );
      case "waste":
      case "foundation": {
        const top =
          pile.pile === "waste"
            ? (state.waste.at(-1) ?? null)
            : getSolitaireFoundationTop(state.foundations, pile.suit);
        return (
          <button
            key={getPileKey(pile)}
            {...getPileProps(
              pile,
              pile.pile === "waste"
                ? describeWaste(state)
                : describeFoundation(state, pile),
            )}
            style={style}
          >
            {top === null ? (
              <SolitaireEmptySlot width={cardWidth}>
                {pile.pile === "foundation"
                  ? solitaireSuitSymbols[pile.suit]
                  : null}
              </SolitaireEmptySlot>
            ) : (
              <span
                key={top}
                ref={registerCard(getSolitaireCardMotionKey(top))}
                className="relative block"
              >
                <SolitaireCardFace card={top} width={cardWidth} />
              </span>
            )}
            {selectionFrame}
          </button>
        );
      }
    }
  }

  function renderColumn(columnIndex: number) {
    const pile: SolitairePile = { pile: "column", columnIndex };
    const column = state.columns[columnIndex] ?? [];
    const offset = geometry.columnOffsets[columnIndex] ?? 0;
    const selected =
      selectedSource?.pile === "column" &&
      selectedSource.columnIndex === columnIndex;
    return (
      <button
        key={getPileKey(pile)}
        {...getPileProps(pile, describeColumn(state, columnIndex))}
        style={{
          left: getSolitaireSlotLeft(
            geometry,
            getSolitairePileSlotIndex(geometry, pile),
          ),
          top: geometry.columnTop,
          width: cardWidth,
          height: geometry.columnHeight,
        }}
      >
        {column.length === 0 ? (
          <span className="absolute top-0 left-0">
            <SolitaireEmptySlot width={cardWidth} />
          </span>
        ) : (
          column.map((card, cardIndex) => (
            <span
              key={card}
              ref={registerCard(getSolitaireCardMotionKey(card))}
              className="absolute left-0"
              style={{ top: cardIndex * offset }}
            >
              <SolitaireCardFace card={card} width={cardWidth} />
            </span>
          ))
        )}
        {selected && column.length > 0 ? (
          <span
            ref={selectionFrameRef}
            aria-hidden="true"
            className="pointer-events-none absolute left-0"
            style={{
              ...selectionFrameStyle,
              ...getSolitaireColumnSelectionFrame({
                column,
                offset,
                cardHeight,
              }),
              width: cardWidth,
            }}
          />
        ) : null}
      </button>
    );
  }

  return (
    <div
      ref={boardRef}
      className={fixedSize === undefined ? "relative size-full" : "relative"}
      style={
        fixedSize === undefined
          ? undefined
          : {
              width: geometry.contentWidth,
              height: getSolitaireBoardContentHeight(geometry),
            }
      }
    >
      <div
        className="absolute inset-y-0"
        style={{ left: contentLeft, width: geometry.contentWidth }}
      >
        {geometry.layout.topRow.map((pile) =>
          pile === null ? null : renderTopRowPile(pile),
        )}
        {geometry.layout.columns.map(renderColumn)}
        {renderOverlay?.(geometry)}
      </div>
    </div>
  );
}
