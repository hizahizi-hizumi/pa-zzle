import { getTsumeShogiLetteringGlyphPath } from "@/games/tsume-shogi/ui/board/lettering-glyph-paths";

function listLetteringGlyphs(text: string) {
  return Array.from(text, (character, index) => ({
    // 同じ字が並んでも区別できるよう、字の位置を key に含める。
    key: `${index}-${character}`,
    path: getTsumeShogiLetteringGlyphPath(character),
  }));
}

type TsumeShogiBoardLetteringProps = {
  text: string;
};

/** 盤の筋・段と同じ書体の輪郭で書く短い札。 */
export function TsumeShogiBoardLettering({
  text,
}: TsumeShogiBoardLetteringProps) {
  return (
    <span className="flex items-center" aria-label={text} role="img">
      {listLetteringGlyphs(text).map(({ key, path }) => (
        <svg
          key={key}
          viewBox="-50 -50 100 100"
          aria-hidden="true"
          className="size-[1.05em] fill-current"
        >
          {path && <path d={path} />}
        </svg>
      ))}
    </span>
  );
}
