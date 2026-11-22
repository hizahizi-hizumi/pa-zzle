import { useLayoutEffect, useRef } from "react";

import {
  FLASK_CENTER_X,
  FLASK_VIEW_BOX,
  type FlaskShape,
} from "@/games/water-sort/ui/ideas/alchemy/flask-shapes";
import { SEALING_TIMELINE } from "@/games/water-sort/ui/ideas/alchemy/sealing-timeline";
import { prefersReducedMotion } from "@/lib/motion";

type FlaskSealProps = {
  shape: FlaskShape;
  animate: boolean;
};

const WAX = "#8e1b1b";
const WAX_LIGHT = "#d0503f";
const WAX_DARK = "#4e0b0b";
const SEAL_RADIUS = 4.4;

/** 印の縁の、蝋を押し広げたときの不揃いな輪郭。 */
function getSealOutline(centerY: number): string {
  const bumps = [1, 0.9, 1.04, 0.94, 1.02, 0.88, 1.05, 0.95, 1, 0.92];
  const points = bumps.map((scale, index) => {
    const angle = (index / bumps.length) * Math.PI * 2;
    const radius = SEAL_RADIUS * scale;
    return `${(FLASK_CENTER_X + Math.cos(angle) * radius).toFixed(2)} ${(centerY + Math.sin(angle) * radius).toFixed(2)}`;
  });
  return `M ${points.join(" L ")} Z`;
}

/** 純粋な精に還ったフラスコの、蝋の封と印。 */
export function FlaskSeal({ shape, animate }: FlaskSealProps) {
  const capRef = useRef<SVGGElement>(null);
  const dripRef = useRef<SVGGElement>(null);
  const stampRef = useRef<SVGGElement>(null);
  const { mouth, neckHalfWidth, sealY } = shape;
  const capHalf = mouth.halfWidth + 0.9;
  const capTop = mouth.y - 2.6;
  const capBottom = mouth.y + 1.6;
  const cx = FLASK_CENTER_X;
  const neck = neckHalfWidth;
  const cordY = Math.min(mouth.y + 5, sealY - SEAL_RADIUS - 1.5);

  useLayoutEffect(() => {
    if (!animate || prefersReducedMotion()) {
      return;
    }
    const timeline = SEALING_TIMELINE;
    const animations = [
      capRef.current?.animate?.(
        [
          { opacity: 0, transform: "translateY(-5px) scale(1.1, 0.7)" },
          {
            opacity: 1,
            transform: "translateY(0) scale(1.08, 0.86)",
            offset: 0.7,
          },
          { opacity: 1, transform: "translateY(0) scale(1, 1)" },
        ],
        {
          duration: timeline.capDurationMs,
          delay: timeline.capStartMs,
          easing: "ease-in",
          fill: "backwards",
        },
      ),
      dripRef.current?.animate?.(
        [{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }],
        {
          duration: timeline.dripDurationMs,
          delay: timeline.dripStartMs,
          easing: "cubic-bezier(.3,.7,.4,1)",
          fill: "backwards",
        },
      ),
      stampRef.current?.animate?.(
        [
          { opacity: 0, transform: "scale(1.9)" },
          { opacity: 1, transform: "scale(0.86)", offset: 0.55 },
          { opacity: 1, transform: "scale(1)" },
        ],
        {
          duration: timeline.stampDurationMs,
          delay: timeline.stampStartMs,
          easing: "ease-out",
          fill: "backwards",
        },
      ),
    ];
    return () => {
      for (const animation of animations) {
        animation?.cancel();
      }
    };
  }, [animate]);

  return (
    <svg
      className="absolute inset-0 size-full overflow-visible"
      viewBox={FLASK_VIEW_BOX}
      aria-hidden="true"
    >
      {/* 首に掛けた紐と、紐の先の印 */}
      <g
        ref={stampRef}
        style={{ transformBox: "fill-box", transformOrigin: "50% 70%" }}
      >
        <path
          d={`M ${cx - neck - 0.3} ${cordY} Q ${cx} ${cordY + 1.6} ${cx + neck + 0.3} ${cordY} M ${cx - 1.2} ${cordY + 0.9} L ${cx - 0.6} ${sealY} M ${cx + 1.2} ${cordY + 0.9} L ${cx + 0.6} ${sealY}`}
          fill="none"
          stroke="#c9a978"
          strokeWidth="0.5"
          strokeLinecap="round"
        />
        <path
          d={getSealOutline(sealY)}
          fill={WAX}
          stroke={WAX_DARK}
          strokeWidth="0.35"
          strokeLinejoin="round"
        />
        <circle
          cx={cx}
          cy={sealY}
          r={SEAL_RADIUS - 1.2}
          fill="none"
          stroke={WAX_DARK}
          strokeWidth="0.5"
        />
        <path
          d={`M ${cx - 2.6} ${sealY - 1.4} A ${SEAL_RADIUS - 1.2} ${SEAL_RADIUS - 1.2} 0 0 1 ${cx + 1.2} ${sealY - 2.9}`}
          fill="none"
          stroke={WAX_LIGHT}
          strokeWidth="0.45"
          strokeLinecap="round"
        />
        {/* 太陽の印。純粋な精、金の象徴。 */}
        <circle
          cx={cx}
          cy={sealY + 0.15}
          r="1.25"
          fill="none"
          stroke={WAX_DARK}
          strokeWidth="0.5"
        />
        <circle cx={cx} cy={sealY + 0.15} r="0.4" fill={WAX_DARK} />
        <path
          d={`M ${cx - 1.25} ${sealY - 0.25} A 1.25 1.25 0 0 1 ${cx + 0.4} ${sealY - 1.1}`}
          fill="none"
          stroke={WAX_LIGHT}
          strokeWidth="0.35"
          strokeOpacity="0.8"
        />
      </g>
      {/* 首を伝う蝋の垂れ */}
      <g
        ref={dripRef}
        style={{ transformBox: "fill-box", transformOrigin: "50% 0%" }}
      >
        <path
          d={`M ${cx + neck * 0.15} ${capBottom - 0.4} C ${cx + neck * 0.15} ${capBottom + 2.2} ${cx + neck * 0.75} ${capBottom + 2.2} ${cx + neck * 0.75} ${capBottom + 3.4} A 0.75 0.75 0 0 0 ${cx + neck * 0.75 + 1.5} ${capBottom + 3.4} L ${cx + neck + 0.5} ${capBottom - 0.4} Z`}
          fill={WAX}
        />
        <path
          d={`M ${cx - neck - 0.5} ${capBottom - 0.4} L ${cx - neck - 0.4} ${capBottom + 1.9} A 0.65 0.65 0 0 0 ${cx - neck + 0.9} ${capBottom + 1.9} L ${cx - neck * 0.3} ${capBottom - 0.4} Z`}
          fill={WAX}
        />
      </g>
      {/* 口を覆う蝋 */}
      <g
        ref={capRef}
        style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }}
      >
        <path
          d={`M ${cx - capHalf} ${capBottom} L ${cx - capHalf + 0.2} ${capTop + 1.4} Q ${cx - capHalf + 0.4} ${capTop} ${cx} ${capTop} Q ${cx + capHalf - 0.4} ${capTop} ${cx + capHalf - 0.2} ${capTop + 1.4} L ${cx + capHalf} ${capBottom} Q ${cx} ${capBottom + 0.9} ${cx - capHalf} ${capBottom} Z`}
          fill={WAX}
          stroke={WAX_DARK}
          strokeWidth="0.35"
        />
        <path
          d={`M ${cx - capHalf + 0.9} ${capTop + 1.5} Q ${cx - capHalf + 1.2} ${capTop + 0.5} ${cx - 0.6} ${capTop + 0.45}`}
          fill="none"
          stroke={WAX_LIGHT}
          strokeWidth="0.55"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
