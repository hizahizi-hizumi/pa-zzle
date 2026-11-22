import { useId } from "react";

/** 古い石積みの壁。盤面の後ろが最も明るく、隅へ行くほど闇に沈む。 */
export function WorkshopWall() {
  const id = useId();
  const grainId = `${id}-grain`;
  const stainId = `${id}-stain`;
  const roughId = `${id}-rough`;
  const masonryId = `${id}-masonry`;

  return (
    <>
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 52% at 50% 45%, #3a2717 0%, #28190e 40%, #170f09 76%, #110b07 100%)",
        }}
      />
      <svg
        className="absolute inset-0 size-full"
        aria-hidden="true"
        preserveAspectRatio="none"
      >
        <defs>
          <filter id={grainId} x="0" y="0" width="100%" height="100%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.85"
              numOctaves="2"
              seed="3"
            />
            <feColorMatrix values="0 0 0 0 1  0 0 0 0 0.85  0 0 0 0 0.66  0 0 0 0.16 -0.02" />
          </filter>
          <filter id={stainId} x="0" y="0" width="100%" height="100%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.009"
              numOctaves="3"
              seed="11"
            />
            <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.6 1.05" />
          </filter>
          <filter id={roughId} x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.06"
              numOctaves="2"
              seed="5"
              result="noise"
            />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="5" />
          </filter>
          <pattern
            id={masonryId}
            width="132"
            height="116"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 0 0.5 H 132 M 0 58.5 H 132 M 0.5 0 V 58 M 66.5 58 V 116"
              fill="none"
              stroke="#000"
              strokeOpacity="0.5"
              strokeWidth="2.2"
            />
            <path
              d="M 0 2.2 H 132 M 0 60.2 H 132"
              fill="none"
              stroke="#ffd2a0"
              strokeOpacity="0.05"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill={`url(#${masonryId})`}
          filter={`url(#${roughId})`}
          opacity="0.75"
        />
        <rect
          width="100%"
          height="100%"
          filter={`url(#${stainId})`}
          opacity="0.35"
        />
        <rect width="100%" height="100%" filter={`url(#${grainId})`} />
      </svg>
    </>
  );
}
