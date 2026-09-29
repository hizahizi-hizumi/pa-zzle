import { Digit404 } from "@/views/NotFoundView/Digit404";
import type {
  Digit404Glyphs,
  ZeroPieceId,
} from "@/views/NotFoundView/jigsawLayout";
import { seamStrokeClassNames } from "@/views/NotFoundView/seamStroke";
import type { SnapPieceStatus } from "@/views/NotFoundView/useSnapPiece";

export type JigsawHole = {
  id: ZeroPieceId;
  path: string;
  status: SnapPieceStatus;
};

type JigsawBoardProps = {
  digits: Digit404Glyphs;
  height: number;
  holes: readonly JigsawHole[];
  outlinePath: string;
  width: number;
};

// 穴は平常時は静かに見せ、離せばはまる距離までピースが来たときだけ輪郭を強める。
const holeClassNames = {
  loose: `fill-muted ${seamStrokeClassNames.back} transition-colors motion-reduce:transition-none`,
  near: "fill-muted stroke-muted-foreground transition-colors motion-reduce:transition-none",
  placed: `fill-muted ${seamStrokeClassNames.back}`,
} satisfies Record<SnapPieceStatus, string>;

export function JigsawBoard({
  digits,
  height,
  holes,
  outlinePath,
  width,
}: JigsawBoardProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${width} ${height}`}
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      <path
        d={outlinePath}
        fill="none"
        className={seamStrokeClassNames.back}
        strokeWidth="2.5"
      />
      <Digit404 glyphs={digits} />
      {holes.map((hole) => (
        <path
          key={hole.id}
          d={hole.path}
          className={holeClassNames[hole.status]}
          strokeWidth="3"
        />
      ))}
    </svg>
  );
}
