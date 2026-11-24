import { RotateCcw } from "lucide-react";
import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { useTouchTap } from "@/components/touch-tap";
import type { SolitaireOperation } from "@/games/solitaire/play/use-solitaire-play";
import { solitaireSuits } from "@/games/solitaire/puzzle/card";
import {
  isSameSolitairePile,
  type SolitairePile,
} from "@/games/solitaire/puzzle/pile-selection";
import type { SolitaireSource } from "@/games/solitaire/puzzle/rules";
import {
  findSolitaireRunStart,
  getSolitaireFoundationTop,
  type SolitaireState,
} from "@/games/solitaire/puzzle/state";
import {
  getSolitaireBoardGeometry,
  getSolitaireSlotLeft,
  type SolitaireBoardGeometry,
} from "@/games/solitaire/ui/board/board-geometry";
import { SolitaireCardBack } from "@/games/solitaire/ui/board/SolitaireCardBack";
import { SolitaireCardFace } from "@/games/solitaire/ui/board/SolitaireCardFace";
import { SolitaireEmptySlot } from "@/games/solitaire/ui/board/SolitaireEmptySlot";
import { getSolitaireSelectionFrameStyle } from "@/games/solitaire/ui/board/selection-frame";
import {
  formatSolitaireCardName,
  solitaireSuitSymbols,
} from "@/games/solitaire/ui/card-text";
import {
  playAnimations,
  playRejectionShake,
  type RejectionShakeTiming,
} from "@/lib/motion";

type SolitaireBoardProps = {
  state: SolitaireState;
  selectedSource: SolitaireSource | null;
  operation: SolitaireOperation | null;
  interactionDisabled: boolean;
  onSelectPile: (pile: SolitairePile) => void;
  onClearAnimationComplete?: () => void;
};

const invalidPileShakeKeyframes: Keyframe[] = [
  { transform: "translateX(0)" },
  { transform: "translateX(-4px)" },
  { transform: "translateX(4px)" },
  { transform: "translateX(-2px)" },
  { transform: "translateX(0)" },
];

const invalidPileShakeTiming: RejectionShakeTiming = {
  durationMs: 220,
  easing: "ease-out",
};

/** クリアしたとき、組札をマークの順に1つずつ照らす。 */
const clearGlowKeyframes: Keyframe[] = [
  { transform: "scale(1)", filter: "brightness(1)" },
  { transform: "scale(1.08)", filter: "brightness(1.2)" },
  { transform: "scale(1)", filter: "brightness(1)" },
];
const clearGlowDurationMs = 360;
const clearGlowStaggerMs = 140;
const clearHoldMs = 400;

const topRowSlots = {
  stock: 0,
  waste: 1,
  firstFoundation: 3,
} as const;

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

/** 盤面の大きさを測る。測れない環境では 0 のまま。 */
function useBoardSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") {
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
  }, []);
  return { ref, size };
}

/** 選んだ置き元で、動かせる札を囲む枠の位置と高さ（列の中の座標）。列は手前から続く並び全体を囲む。 */
function getColumnSelectionFrame(
  state: SolitaireState,
  columnIndex: number,
  geometry: SolitaireBoardGeometry,
) {
  const column = state.columns[columnIndex] ?? [];
  const runStart = findSolitaireRunStart(column);
  const offset = geometry.columnOffsets[columnIndex] ?? 0;
  return {
    top: runStart * offset,
    height: (column.length - 1 - runStart) * offset + geometry.cardHeight,
  };
}

/**
 * ソリティアの盤面。上の段に左から山札・捨て札・空き・組札4つ（マークの順）を、その下に7列を、同じ7列の格子に並べる。
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
}: SolitaireBoardProps) {
  const { ref: boardRef, size } = useBoardSize();
  const pileRefs = useRef(new Map<string, HTMLButtonElement>());
  const { getTapHandlers } = useTouchTap();
  const geometry = getSolitaireBoardGeometry({
    width: size.width,
    height: size.height,
    columnLengths: state.columns.map((column) => column.length),
  });
  const { cardWidth, cardHeight } = geometry;
  const contentLeft = Math.max(0, (size.width - geometry.contentWidth) / 2);

  useLayoutEffect(() => {
    if (operation?.type === "invalid") {
      playRejectionShake(
        pileRefs.current.get(getPileKey(operation.pile)),
        invalidPileShakeKeyframes,
        invalidPileShakeTiming,
      );
    }
  }, [operation]);

  const clearingOperationId =
    operation?.type === "moved" && operation.isClearingMove
      ? operation.id
      : null;
  const finishClearAnimation = useEffectEvent(function finishClearAnimation() {
    onClearAnimationComplete?.();
  });
  useEffect(() => {
    if (clearingOperationId === null) {
      return;
    }
    return playAnimations({
      animate: () =>
        solitaireSuits.flatMap((suit, index) => {
          const element = pileRefs.current.get(`foundation-${suit}`);
          return typeof element?.animate === "function"
            ? [
                element.animate(clearGlowKeyframes, {
                  duration: clearGlowDurationMs,
                  delay: index * clearGlowStaggerMs,
                  easing: "ease-out",
                }),
              ]
            : [];
        }),
      completion: { type: "after-animations", holdMs: clearHoldMs },
      reducedMotionHoldMs: clearHoldMs,
      unanimatedHoldMs: clearHoldMs,
      onFinished: finishClearAnimation,
    });
  }, [clearingOperationId]);

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

  const wasteTop = state.waste.at(-1);
  const stockPile: SolitairePile = { pile: "stock" };
  const wastePile: SolitairePile = { pile: "waste" };

  return (
    <div ref={boardRef} className="relative size-full">
      <div
        className="absolute inset-y-0"
        style={{ left: contentLeft, width: geometry.contentWidth }}
      >
        <button
          {...getPileProps(stockPile, describeStock(state))}
          style={{
            left: getSolitaireSlotLeft(geometry, topRowSlots.stock),
            top: 0,
            width: cardWidth,
            height: cardHeight,
          }}
        >
          {state.stock.length > 0 ? (
            <SolitaireCardBack width={cardWidth} />
          ) : (
            <SolitaireEmptySlot width={cardWidth}>
              {state.waste.length > 0 ? (
                <RotateCcw
                  style={{ width: cardWidth * 0.45, height: cardWidth * 0.45 }}
                />
              ) : null}
            </SolitaireEmptySlot>
          )}
        </button>
        <button
          {...getPileProps(wastePile, describeWaste(state))}
          style={{
            left: getSolitaireSlotLeft(geometry, topRowSlots.waste),
            top: 0,
            width: cardWidth,
            height: cardHeight,
          }}
        >
          {wasteTop === undefined ? (
            <SolitaireEmptySlot width={cardWidth} />
          ) : (
            <SolitaireCardFace card={wasteTop} width={cardWidth} />
          )}
          {selectedSource?.pile === "waste" ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={selectionFrameStyle}
            />
          ) : null}
        </button>
        {solitaireSuits.map((suit, index) => {
          const top = getSolitaireFoundationTop(state.foundations, suit);
          const pile: SolitairePile = { pile: "foundation", suit };
          return (
            <button
              key={suit}
              {...getPileProps(
                pile,
                `${solitaireSuitSymbols[suit]}の組札、${top === null ? "なし" : formatSolitaireCardName(top)}`,
              )}
              style={{
                left: getSolitaireSlotLeft(
                  geometry,
                  topRowSlots.firstFoundation + index,
                ),
                top: 0,
                width: cardWidth,
                height: cardHeight,
              }}
            >
              {top === null ? (
                <SolitaireEmptySlot width={cardWidth}>
                  {solitaireSuitSymbols[suit]}
                </SolitaireEmptySlot>
              ) : (
                <SolitaireCardFace card={top} width={cardWidth} />
              )}
              {selectedSource?.pile === "foundation" &&
              selectedSource.suit === suit ? (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0"
                  style={selectionFrameStyle}
                />
              ) : null}
            </button>
          );
        })}
        {state.columns.map((column, columnIndex) => {
          const pile: SolitairePile = { pile: "column", columnIndex };
          const offset = geometry.columnOffsets[columnIndex] ?? 0;
          const selected =
            selectedSource?.pile === "column" &&
            selectedSource.columnIndex === columnIndex;
          return (
            <button
              key={getPileKey(pile)}
              {...getPileProps(
                pile,
                `列${columnIndex + 1}、${column.length === 0 ? "空" : column.map(formatSolitaireCardName).join(" ")}`,
              )}
              style={{
                left: getSolitaireSlotLeft(geometry, columnIndex),
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
                    className="absolute left-0"
                    style={{ top: cardIndex * offset }}
                  >
                    <SolitaireCardFace card={card} width={cardWidth} />
                  </span>
                ))
              )}
              {selected && column.length > 0 ? (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-0"
                  style={{
                    ...selectionFrameStyle,
                    ...getColumnSelectionFrame(state, columnIndex, geometry),
                    width: cardWidth,
                  }}
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
