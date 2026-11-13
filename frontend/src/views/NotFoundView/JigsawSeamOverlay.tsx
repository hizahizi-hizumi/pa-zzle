import { seamStrokeClassNames } from "@/views/NotFoundView/seamStroke";

type JigsawSeamOverlayProps = {
  height: number;
  outlinePath: string;
  width: number;
};

export function JigsawSeamOverlay({
  height,
  outlinePath,
  width,
}: JigsawSeamOverlayProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${width} ${height}`}
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      <path
        d={outlinePath}
        fill="none"
        className={seamStrokeClassNames.front}
        strokeWidth="1"
      />
    </svg>
  );
}
