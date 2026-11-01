import { getTsumeShogiLetteringGlyphPath } from "@/games/tsume-shogi/ui/board/lettering-glyph-paths";

type TsumeShogiCoordinateLabelProps = {
  text: string;
};

/** 筋・段の1文字。盤図らしい明朝の輪郭で書き、端末の書体によらない。 */
export function TsumeShogiCoordinateLabel({
  text,
}: TsumeShogiCoordinateLabelProps) {
  const path = getTsumeShogiLetteringGlyphPath(text);
  if (!path) return <span className="mx-auto">{text}</span>;
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
