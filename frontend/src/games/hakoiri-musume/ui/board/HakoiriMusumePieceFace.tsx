import type { HakoiriMusumePieceKind } from "@/games/hakoiri-musume/puzzle/board";
import { hakoiriMusumeToneClassNames } from "@/games/hakoiri-musume/ui/hakoiri-musume-tone";

type HakoiriMusumePieceFaceProps = {
  kind: HakoiriMusumePieceKind;
};

/** 駒の面。置かれた所いっぱいに描く。娘だけは朱漆で「娘」の字を入れる。 */
export function HakoiriMusumePieceFace({ kind }: HakoiriMusumePieceFaceProps) {
  if (kind === "daughter") {
    return (
      <span
        className={`flex size-full items-center justify-center rounded-[2.4cqw] ${hakoiriMusumeToneClassNames.daughterPiece}`}
      >
        <span
          className={`font-['Hiragino_Mincho_ProN','Yu_Mincho','Noto_Serif_JP',serif] text-[17cqw] leading-none ${hakoiriMusumeToneClassNames.daughterMark}`}
        >
          娘
        </span>
      </span>
    );
  }
  return (
    <span
      className={`block size-full rounded-[2.4cqw] ${hakoiriMusumeToneClassNames.woodPiece}`}
    />
  );
}
