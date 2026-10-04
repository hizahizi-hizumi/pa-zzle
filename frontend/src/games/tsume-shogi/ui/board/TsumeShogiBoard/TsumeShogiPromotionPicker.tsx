import { useEffect, useRef } from "react";

import type { TapHandlers } from "@/components/touch-tap";
import type {
  TsumeShogiPieceType,
  TsumeShogiSquare,
} from "@/games/tsume-shogi/puzzle/position";
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
 * 成・不成のどちらも指せる移動で、移動先の升のそばに成った駒と成らない駒を並べて選ばせる。
 * 移動先が盤の上半分なら升の下、下半分なら升の上に出し、移動先と駒を隠さない。
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

  const column = 9 - to.file;
  const left = Math.min(Math.max(column - 0.5, 0), 7) * squareRatio;
  const placeBelow = to.rank <= 5;
  const top = (placeBelow ? to.rank : to.rank - 2) * squareRatio;
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
      className="absolute z-20 flex h-[calc(100%/9)] w-[calc(200%/9)] gap-px rounded-sm bg-popover p-px shadow-raised outline outline-(length:--border-width-normal) outline-border"
      style={{ left: `${left}%`, top: `${top}%` }}
    >
      {options.map(({ type, label, tapHandlers }, index) => (
        <button
          key={label}
          ref={index === 0 ? firstOptionRef : undefined}
          type="button"
          aria-label={label}
          className={cn(
            "relative flex min-w-0 flex-1 touch-manipulation flex-col items-center justify-center rounded-sm outline-none hover:bg-accent focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-foreground/70",
            tsumeShogiToneClassNames.boardSurface,
          )}
          onPointerUp={tapHandlers.onPointerUp}
          onClick={tapHandlers.onClick}
        >
          <TsumeShogiPieceGlyph type={type} side="attacker" size="choice" />
          <span className="absolute bottom-0 rounded-sm bg-popover/90 px-0.5 text-[0.625rem] leading-none text-popover-foreground">
            {label}
          </span>
        </button>
      ))}
    </div>
  );
}
