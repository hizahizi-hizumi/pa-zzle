import { useEffect, useRef } from "react";

import type { TapHandlers } from "@/components/touch-tap";
import type {
  TsumeShogiPieceType,
  TsumeShogiSquare,
} from "@/games/tsume-shogi/puzzle/position";
import { placeTsumeShogiPromotionPicker } from "@/games/tsume-shogi/ui/board/TsumeShogiBoard/promotion-picker-placement";
import { TsumeShogiPieceGlyph } from "@/games/tsume-shogi/ui/board/TsumeShogiPieceGlyph";
import { tsumeShogiToneClassNames } from "@/games/tsume-shogi/ui/tsume-shogi-tone";
import { cn } from "@/lib/utils";

const promotedPieceTypes: Partial<
  Record<TsumeShogiPieceType, TsumeShogiPieceType>
> = {
  rook: "dragon",
  bishop: "horse",
  silver: "promSilver",
  knight: "promKnight",
  lance: "promLance",
  pawn: "promPawn",
};

type TsumeShogiPromotionPickerProps = {
  to: TsumeShogiSquare;
  pieceType: TsumeShogiPieceType;
  /** 成（`promote`）・不成（`keep`）を押したときの受け口。盤の升と同じ記録を共有し、続けて素早く押しても押した方で受ける。 */
  optionTapHandlers: { promote: TapHandlers; keep: TapHandlers };
};

/** 盤の幅に対する1升の割合。 */
const squareRatio = 100 / 9;

/**
 * 成・不成のどちらでも王手になる移動で、移動先の升のそばに成った駒と成らない駒を並べて選ばせる。
 * 移動先の升の真上（一段目なら真下）の升2つにちょうど重ね、移動先を隠さない（`promotion-picker-placement.ts`）。
 * 出したら「成」へフォーカスを移し、閉じたら出す前にフォーカスのあった升へ戻す。
 */
export function TsumeShogiPromotionPicker({
  to,
  pieceType,
  optionTapHandlers,
}: TsumeShogiPromotionPickerProps) {
  const groupRef = useRef<HTMLDivElement>(null);
  const firstOptionRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const group = groupRef.current;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    firstOptionRef.current?.focus();

    return () => {
      // 選んだ・やめたあとは選択肢が消えるので、フォーカスが消えたままにならないよう元の升へ戻す。
      const focusLeft =
        document.activeElement === document.body ||
        group?.contains(document.activeElement);
      if (focusLeft && previouslyFocused?.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, []);

  const placement = placeTsumeShogiPromotionPicker(to);
  const left = placement.column * squareRatio;
  const top = placement.row * squareRatio;
  const options = [
    {
      type: promotedPieceTypes[pieceType] ?? pieceType,
      label: "成",
      tapHandlers: optionTapHandlers.promote,
    },
    { type: pieceType, label: "不成", tapHandlers: optionTapHandlers.keep },
  ];

  return (
    <div
      ref={groupRef}
      role="group"
      aria-label="成・不成"
      className={cn(
        "absolute z-20 flex h-[calc(100%/9)] w-[calc(200%/9)]",
        tsumeShogiToneClassNames.promotionPicker,
      )}
      style={{ left: `${left}%`, top: `${top}%` }}
    >
      {options.map(({ type, label, tapHandlers }, index) => (
        <button
          key={label}
          ref={index === 0 ? firstOptionRef : undefined}
          type="button"
          aria-label={label}
          className={cn(
            "relative flex min-w-0 flex-1 touch-manipulation flex-col items-center justify-center outline-none focus-visible:outline-2 focus-visible:outline-solid",
            tsumeShogiToneClassNames.focusRing,
          )}
          onPointerUp={tapHandlers.onPointerUp}
          onClick={tapHandlers.onClick}
        >
          <TsumeShogiPieceGlyph
            type={type}
            side="attacker"
            size="choice"
            lifted
          />
          <span
            className={cn(
              "absolute bottom-0 px-0.5 text-[0.625rem] leading-none",
              tsumeShogiToneClassNames.promotionLabel,
            )}
          >
            {label}
          </span>
        </button>
      ))}
    </div>
  );
}
