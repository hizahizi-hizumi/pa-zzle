// 試作 bench の、手に持って傾けた試験管。液面は傾きによらず水平に描く。
import { liquidFill } from "@/games/water-sort/ui/prototypes/bench/BenchDefs";
import {
  CAVITY_D,
  PIVOT_Y,
  type Pose,
  tiltedBands,
} from "@/games/water-sort/ui/prototypes/bench/geometry";
import {
  type LiquidSegment,
  TubeArt,
} from "@/games/water-sort/ui/prototypes/bench/TubeArt";

export type TiltedTubeProps = {
  id: string;
  pose: Pose;
  k: number;
  segments: readonly LiquidSegment[];
};

export function TiltedTube({ id, pose, k, segments }: TiltedTubeProps) {
  const { bands, surface } = tiltedBands(segments, pose.angle);
  const offset = PIVOT_Y * Math.cos((pose.angle * Math.PI) / 180);
  const rotate = `rotate(${pose.angle}) translate(0 ${-PIVOT_Y})`;
  return (
    <g transform={`translate(${pose.x} ${pose.y}) scale(${k * pose.scale})`}>
      <clipPath id={id} clipPathUnits="userSpaceOnUse">
        <path d={CAVITY_D} transform={rotate} />
      </clipPath>
      <g clipPath={`url(#${id})`}>
        {bands.map((b) => (
          <rect
            key={`${b.color}-${b.bottom.toFixed(1)}`}
            x={-260}
            y={b.top - offset}
            width={520}
            height={Math.max(0, b.bottom - b.top + 0.6)}
            fill={liquidFill(b.color)}
          />
        ))}
        {bands.slice(0, -1).map((b) => (
          <rect
            key={`l${b.top.toFixed(1)}`}
            x={-260}
            y={b.top - offset - 0.5}
            width={520}
            height={1}
            fill="#fff"
            opacity={0.85}
          />
        ))}
        {surface !== null && (
          <rect
            x={-260}
            y={surface - offset - 0.7}
            width={520}
            height={1.4}
            fill="#fff"
            opacity={0.75}
          />
        )}
      </g>
      <g transform={rotate}>
        <TubeArt segments={[]} />
      </g>
    </g>
  );
}
