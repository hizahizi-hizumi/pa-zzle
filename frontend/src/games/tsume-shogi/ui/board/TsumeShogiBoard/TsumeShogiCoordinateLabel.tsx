import { getTsumeShogiCoordinateGlyphPath } from "@/games/tsume-shogi/ui/board/real/selected-fonts";
import { tsumeShogiBoardStyle } from "@/games/tsume-shogi/ui/board-style";

type TsumeShogiCoordinateLabelProps = {
  text: string;
};

/** 筋・段の1文字。案R では盤図らしい明朝の輪郭で書き、端末の書体によらない。 */
export function TsumeShogiCoordinateLabel({
  text,
}: TsumeShogiCoordinateLabelProps) {
  const path = getTsumeShogiCoordinateGlyphPath(text);
  if (tsumeShogiBoardStyle !== "real" || !path) return <span>{text}</span>;
  return (
    <svg
      viewBox="-50 -50 100 100"
      aria-hidden="true"
      className="mx-auto size-[1em] fill-current"
    >
      <path d={path} />
    </svg>
  );
}
