import { useId } from "react";

import {
  FLASK_VIEW_BOX,
  type FlaskShape,
} from "@/games/water-sort/ui/ideas/alchemy/flask-shapes";

type FlaskGlassBackProps = {
  shape: FlaskShape;
};

/** 液の後ろに見える、ガラスの奥の壁。空のフラスコも暗い工房の中で器の形が分かるよう、ほのかに光を返す。 */
export function FlaskGlassBack({ shape }: FlaskGlassBackProps) {
  const gradientId = useId();

  return (
    <svg
      className="absolute inset-0 size-full overflow-visible"
      viewBox={FLASK_VIEW_BOX}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={shape.tint} stopOpacity="0.16" />
          <stop offset="0.3" stopColor={shape.tint} stopOpacity="0.05" />
          <stop offset="0.72" stopColor={shape.tint} stopOpacity="0.04" />
          <stop offset="0.88" stopColor="#ffcf96" stopOpacity="0.12" />
          <stop offset="1" stopColor={shape.tint} stopOpacity="0.18" />
        </linearGradient>
      </defs>
      <path d={shape.outline} fill="#0b0705" fillOpacity="0.35" />
      <path d={shape.outline} fill={`url(#${gradientId})`} />
    </svg>
  );
}
