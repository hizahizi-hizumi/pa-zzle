import {
  type HakoiriMusumePieceKind,
  hakoiriMusumePieceShapes,
} from "@/games/hakoiri-musume/puzzle/board";
import {
  getWoodPieceBackground,
  hakoiriMusumeToneClassNames,
} from "@/games/hakoiri-musume/ui/hakoiri-musume-tone";

type HakoiriMusumePieceFaceProps = {
  kind: HakoiriMusumePieceKind;
  /** 木目の模様と地の明るさを駒ごとに変える種（0 以上の整数）。同じ盤面の駒には別々の値を渡す。 */
  grainSeed?: number;
};

/** 小駒の木目の向きを散らすための、種ごとの並び。 */
const SMALL_PIECE_GRAIN_ANGLES = [0, 90, 90, 0] as const;

function getGrainAngle(kind: HakoiriMusumePieceKind, seed: number): 0 | 90 {
  switch (kind) {
    case "vertical":
      return 0;
    case "horizontal":
      return 90;
    default:
      return SMALL_PIECE_GRAIN_ANGLES[seed % SMALL_PIECE_GRAIN_ANGLES.length]!;
  }
}

/**
 * 駒の面。置かれた所いっぱいに描く。娘だけは朱漆で「娘」の字を入れる。
 * 欅の駒には、うねりと節のある木目を駒ごとに違えて入れ、縦長は縦に、横長は横に木目を通す。
 */
export function HakoiriMusumePieceFace({
  kind,
  grainSeed = 0,
}: HakoiriMusumePieceFaceProps) {
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
      style={{
        background: getWoodPieceBackground(
          hakoiriMusumePieceShapes[kind],
          getGrainAngle(kind, grainSeed),
          grainSeed,
        ),
      }}
    />
  );
}
