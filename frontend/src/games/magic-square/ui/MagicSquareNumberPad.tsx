import {
  type CSSProperties,
  type ReactNode,
  useLayoutEffect,
  useRef,
} from "react";

import { TutorialCue } from "@/components/TutorialCue";
import { useTouchTap } from "@/components/touch-tap";
import type { MagicSquareValueState } from "@/games/magic-square/puzzle/rules";
import { getMagicSquareNumberPadColumnCount } from "@/games/magic-square/session/number-pad";
import { magicSquareTone } from "@/games/magic-square/ui/magic-square-tone";
import { playRejectionShake } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** チュートリアルで次に押す数に付ける指の印。数の札が2行以上に詰まるので、指は札の中に置く。`recallId` は `TutorialCue` と同じ。 */
export type MagicSquareValueCue = {
  value: number;
  recallId: number | null;
};

/** 受け付けなかった操作の知らせ。`id` が変わるたびに、押した数の札を揺らす。 */
export type MagicSquareValueRejection = {
  id: number;
  value: number;
};

type MagicSquareNumberPadProps = {
  size: number;
  /** 1 から n² までの数の状態。並びは数の小さい順。 */
  valueStates: readonly MagicSquareValueState[];
  /** メモを書く入れ方のとき `true`。数を小さく石墨の色で描く。 */
  memoInput?: boolean;
  interactionDisabled: boolean;
  onEnterValue: (value: number) => void;
  /** 最後の数のすぐ後ろの枠から順に置く操作。 */
  trailingActions?: readonly ReactNode[];
  rejection?: MagicSquareValueRejection | null;
  /** チュートリアルだけが渡す。渡さなければ本番と同じに描く。 */
  cue?: MagicSquareValueCue | null;
  /** 遊び方だけが渡す。数の札の上に重ねる物（押す所の手がかり・判定の印）。札のボタンの中に置く。 */
  renderValueOverlay?: (value: number) => ReactNode;
};

const valueShakeKeyframes: Keyframe[] = [
  { transform: "translateX(0)" },
  { transform: "translateX(-8%)" },
  { transform: "translateX(8%)" },
  { transform: "translateX(-4%)" },
  { transform: "translateX(0)" },
];

/** 最後の数の後ろに空く枠の数。最後の行が数で埋まるときは、次の行の全部の枠。 */
function getTrailingSlotCount(valueCount: number, columnCount: number): number {
  const remainder = valueCount % columnCount;
  return remainder === 0 ? columnCount : columnCount - remainder;
}

/**
 * 高さの足りない画面（320×568 など）で、数の欄が5行になる 6×6 は、数の札を幅より低くして盤面に高さを回す。
 * 低くしても、札の幅と高さはナンプレの数字の欄の幅（320px で 29.3px）を下回らない。
 */
const SHORT_SCREEN_COMPACT_ROW_COUNT = 5;
const shortScreenCompactValueClassName = "[@media(max-height:600px)]:h-9";

/** まだ置いていない数は札、選んだマスに置いてある数は縁取った札、使った数は札を取った跡のくぼみに薄く刻んだ数で描く。 */
function getValueFaceStyle(state: MagicSquareValueState): CSSProperties {
  switch (state) {
    case "available":
      return {
        backgroundColor: magicSquareTone.tablet,
        boxShadow:
          "inset 0 -3px 0 rgba(43,39,34,0.14), 0 1px 2px rgba(43,39,34,0.38)",
      };
    case "selected":
      return {
        backgroundColor: magicSquareTone.tablet,
        boxShadow: `inset 0 0 0 3px ${magicSquareTone.selection}, 0 1px 2px rgba(43,39,34,0.38)`,
      };
    case "used":
      return {
        backgroundColor: magicSquareTone.recess,
        boxShadow:
          "inset 0 2px 3px rgba(43,39,34,0.3), inset 0 -1px 0 rgba(255,255,255,0.3)",
        color: magicSquareTone.usedInk,
      };
  }
}

/**
 * 数の欄。1 から n² までを小さい順に、使った数（最初から置いてある数を含む）も同じ位置に札を取った跡として並べる。
 * 選んだマスに置いてある数は縁取り、押すとそのマスから外す・メモから消す。
 */
export function MagicSquareNumberPad({
  size,
  valueStates,
  memoInput = false,
  interactionDisabled,
  onEnterValue,
  trailingActions = [],
  rejection = null,
  cue = null,
  renderValueOverlay,
}: MagicSquareNumberPadProps) {
  const { getTapHandlers } = useTouchTap();
  const valueElementRefs = useRef(new Map<number, HTMLButtonElement>());
  // 同じ知らせは描き直しても一度だけ揺らす。描き始めにある知らせは、再読み込みで戻した前の操作なので揺らさない。
  const shownRejectionIdRef = useRef(rejection?.id ?? null);
  const columnCount = getMagicSquareNumberPadColumnCount(size);
  const trailingSlotCount = getTrailingSlotCount(
    valueStates.length,
    columnCount,
  );
  const rowCount =
    Math.ceil(valueStates.length / columnCount) +
    (trailingActions.length > 0 && valueStates.length % columnCount === 0
      ? 1
      : 0);
  const compactOnShortScreen = rowCount >= SHORT_SCREEN_COMPACT_ROW_COUNT;

  useLayoutEffect(() => {
    if (!rejection || shownRejectionIdRef.current === rejection.id) {
      return;
    }
    shownRejectionIdRef.current = rejection.id;
    playRejectionShake(
      valueElementRefs.current.get(rejection.value),
      valueShakeKeyframes,
      { durationMs: 220, easing: "ease-out" },
    );
  }, [rejection]);

  return (
    <div
      role="group"
      aria-label="数の欄"
      className="grid touch-manipulation select-none items-center gap-1 font-sans [-webkit-touch-callout:none]"
      style={{
        gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
      }}
    >
      {valueStates.map((state, index) => {
        const value = index + 1;
        return (
          <button
            key={value}
            ref={(element) => {
              if (!element) {
                return;
              }
              valueElementRefs.current.set(value, element);
              return () => {
                valueElementRefs.current.delete(value);
              };
            }}
            type="button"
            aria-pressed={state === "selected"}
            disabled={state === "used"}
            className={cn(
              "relative flex h-11 items-center justify-center rounded-md tabular-nums leading-none outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              memoInput ? "text-base font-medium" : "text-lg font-semibold",
              compactOnShortScreen && shortScreenCompactValueClassName,
            )}
            style={{
              color: memoInput
                ? magicSquareTone.memoInk
                : magicSquareTone.placedInk,
              ...getValueFaceStyle(state),
            }}
            {...getTapHandlers(() => {
              if (!interactionDisabled) {
                onEnterValue(value);
              }
            })}
          >
            {value}
            {cue?.value === value && (
              <TutorialCue
                kind="pointer"
                placement="center"
                recallId={cue.recallId}
              />
            )}
            {renderValueOverlay?.(value)}
          </button>
        );
      })}
      {trailingActions.length > 0 && (
        // 待ったの丸いボタンは 48px で、狭い画面では1枠の幅より大きい。最後の数の後ろの空いた枠をまとめて取り、
        // 操作ごとに1枠の幅か 48px の大きい方を割り当てて、丸い形を保つ。
        <div
          className="flex items-center gap-1"
          style={{ gridColumn: `span ${trailingSlotCount}` }}
        >
          {trailingActions.map((action, slot) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: 最後の数の後ろの枠の順そのものが識別になる
              key={slot}
              className="flex min-w-12 items-center justify-center"
              style={{
                flexBasis: `calc((100% - ${trailingSlotCount - 1} * 0.25rem) / ${trailingSlotCount})`,
              }}
            >
              {action}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
