import type { FukumenzanDigit } from "@/games/fukumenzan/puzzle/state";
import { fukumenzanToneClassNames } from "@/games/fukumenzan/ui/fukumenzan-tone";
import { cn } from "@/lib/utils";

type FukumenzanCardFaceProps = {
  digit: FukumenzanDigit;
  /** 先頭の0の知らせ。 */
  noticed?: boolean;
  /** 選んでいる文字に × を付けた札。× は数字の後ろに細く淡く描き、数字を読めるまま付けたと分かるようにする。 */
  crossed?: boolean;
  /** 運んでいる間、元の場所に残す薄い姿。 */
  lifted?: boolean;
};

/** 0〜9 の札の面。列にある札・式の文字に入れた札・運んでいる札で同じ面を使う。 */
export function FukumenzanCardFace({
  digit,
  noticed = false,
  crossed = false,
  lifted = false,
}: FukumenzanCardFaceProps) {
  return (
    <span
      className={cn(
        "relative flex size-full items-center justify-center rounded-[14%] border-2 font-sans font-semibold leading-none [font-size:min(60cqh,80cqw)]",
        fukumenzanToneClassNames.cardFace,
        noticed && fukumenzanToneClassNames.notice,
        lifted && "opacity-35",
      )}
    >
      {noticed && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-0 rounded-[inherit]",
            fukumenzanToneClassNames.noticeFill,
          )}
        />
      )}
      {crossed && (
        <svg
          aria-hidden="true"
          viewBox="0 0 10 10"
          className="pointer-events-none absolute inset-[12%] size-[76%]"
        >
          <path
            d="M 1 1 L 9 9 M 9 1 L 1 9"
            fill="none"
            strokeWidth={0.8}
            strokeLinecap="round"
            className={fukumenzanToneClassNames.cross}
          />
        </svg>
      )}
      <span className="relative">{digit}</span>
    </span>
  );
}
