import { useId } from "react";

/** 手前の古い机の天板。待ったの置き場の下に広がる。 */
export function WorkshopDesk() {
  const id = useId();
  const grainId = `${id}-grain`;
  const surfaceId = `${id}-surface`;

  return (
    <div className="absolute inset-x-0 bottom-0 h-[128px]">
      {/* 壁と天板の境に落ちる陰 */}
      <div className="absolute inset-x-0 -top-5 h-5 bg-linear-to-b from-transparent to-black/45" />
      <svg
        className="absolute inset-0 size-full"
        aria-hidden="true"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={surfaceId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#24160c" />
            <stop offset="0.35" stopColor="#3a2414" />
            <stop offset="1" stopColor="#140c07" />
          </linearGradient>
          <filter id={grainId} x="0" y="0" width="100%" height="100%">
            <feTurbulence
              type="turbulence"
              baseFrequency="0.0035 0.16"
              numOctaves="3"
              seed="8"
            />
            <feColorMatrix values="0 0 0 0 0.05  0 0 0 0 0.02  0 0 0 0 0  0 0 0 -2.4 1.25" />
          </filter>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${surfaceId})`} />
        <rect
          width="100%"
          height="100%"
          filter={`url(#${grainId})`}
          opacity="0.55"
        />
        {/* 天板の継ぎ目 */}
        <rect y="46" width="100%" height="1.2" fill="#000" opacity="0.4" />
        <rect
          y="47.2"
          width="100%"
          height="0.8"
          fill="#ffcf9a"
          opacity="0.05"
        />
        {/* 奥の縁が受ける蝋燭の光 */}
        <rect width="100%" height="1.2" fill="#ffc888" opacity="0.18" />
      </svg>
    </div>
  );
}
