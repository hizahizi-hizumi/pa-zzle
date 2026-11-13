// 試作 label: 首に麻紐で下げる小さな札。文字は書かず、液の色の小さな見本の点だけを押す。
import { type Pose, poseTransform } from "./geometry";
import { baseLiquidColor, mix } from "./palette";

export type TagVisual = {
  key: string;
  pose: Pose;
  color: number;
  /** 紐の先の札の傾き（度）。 */
  angle: number;
  /** 札の向き。1 で正面、小さいほど横を向く。 */
  facing: number;
  /** 上から下がってくる進み（0〜1）。 */
  drop: number;
  /** 紐を首に巻いた見え方の進み（0〜1）。 */
  loop: number;
};

const KNOT_X = 11;
const KNOT_Y = 13.5;
const STRING = 9;
const n = (value: number) => value.toFixed(2);

export function Tag({ visual }: { visual: TagVisual }) {
  const { pose, drop, loop } = visual;
  if (loop <= 0 && drop <= 0) {
    return null;
  }
  const swatch = baseLiquidColor(visual.color);
  const facing = Math.max(0.15, visual.facing);
  const edgeShade = 1 - facing;
  const stringLength = STRING * drop;
  const tagY = stringLength - (1 - drop) * 6;
  return (
    <g transform={poseTransform(pose)}>
      <g opacity={n(Math.min(1, loop * 1.4))}>
        <path d="M-25.6,9.4 Q0,15.2 25.6,9.4" stroke="#7d6340" strokeWidth="2.1" fill="none" strokeLinecap="round" />
        <path d="M-25.6,9.4 Q0,15.2 25.6,9.4" stroke="#c9a978" strokeWidth="1.3" fill="none" strokeDasharray="1.6 1.2" strokeLinecap="round" />
        <path d="M-25.6,9.4 Q-27.2,8 -25,7.2" stroke="#9c7f55" strokeWidth="1.2" fill="none" opacity=".7" />
        <circle cx={KNOT_X} cy={KNOT_Y} r="1.9" fill="#a3845a" stroke="#6e5434" strokeWidth=".6" />
      </g>
      {drop > 0 && (
        <g transform={`translate(${KNOT_X} ${KNOT_Y}) rotate(${n(visual.angle)}) scale(1.5)`} opacity={n(Math.min(1, drop * 2))}>
          <path d={`M-0.6,0 L-1.6,${n(tagY + 4)} M0.6,0 L1.6,${n(tagY + 4)}`} stroke="#8d7148" strokeWidth=".8" fill="none" />
          <g transform={`translate(0 ${n(tagY)}) scale(${n(facing)} 1)`}>
            <path d="M-6,1.5 L-1.4,22 L13.5,24.6 L11,4.2 Z" transform="translate(1.8 1.6)" fill="#3a2610" opacity=".22" filter="url(#lbl-blur1)" />
            <path d="M-5,0 L5,0 L9,4 L9,25 L-9,25 L-9,4 Z" fill="url(#lbl-tag)" stroke="#b39566" strokeWidth=".7" />
            <path d="M-5,0 L5,0 L9,4 L9,25 L-9,25 L-9,4 Z" fill="url(#lbl-fiber)" />
            <path d="M-6.8,6.6 L6.8,6.6 L6.8,22.8 L-6.8,22.8 Z" fill="none" stroke="#c7ab7c" strokeWidth=".45" opacity=".8" />
            <circle cx="0" cy="4" r="2.7" fill="#e7d3a8" stroke="#b39566" strokeWidth=".5" />
            <circle cx="0" cy="4" r="1.3" fill="#6d5536" />
            <circle cx="0" cy="15" r="4.2" fill={mix(swatch, "#ffffff", 0.08)} opacity=".95" />
            <circle cx="0" cy="15" r="4.2" fill="none" stroke={mix(swatch, "#3a2610", 0.35)} strokeWidth=".55" />
            <circle cx="-1.3" cy="13.7" r="1.2" fill="#fff" opacity=".45" />
            <path d="M-9,4 L-9,25" stroke="#fffaf0" strokeWidth=".8" opacity=".7" />
            {edgeShade > 0.02 && (
              <path d="M-5,0 L5,0 L9,4 L9,25 L-9,25 L-9,4 Z" fill="#5a4022" opacity={n(edgeShade * 0.35)} />
            )}
          </g>
        </g>
      )}
    </g>
  );
}
