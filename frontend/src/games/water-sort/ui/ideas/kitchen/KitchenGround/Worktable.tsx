import { useId } from "react";

const TOWEL_TOP_PATH =
  "M28 16 C22 16 20 21 20 25.5 C20 30 23 33.6 29 33.6 L101 33.6 C104.5 33.6 106 31 106 28 L106 21 C106 18 104 16 101 16 Z";
const TOWEL_BOTTOM_PATH =
  "M31 25 C25 25 22.5 30 22.5 35 C22.5 40 25.5 44 31.5 44 L104 44 C107.5 44 109.5 41.5 109.5 38 L109.5 30 C109.5 27 107.5 25 104 25 Z";

/** 手前の作業台。仕込みに使った果実と、たたんだふきんが置いてある。待ったの後ろなので、端に寄せて控えめにする。 */
export function Worktable() {
  const id = useId();
  const woodId = `${id}-wood`;
  const grainId = `${id}-grain`;
  const yuzuId = `${id}-yuzu`;
  const berryId = `${id}-berry`;
  const towelTopId = `${id}-towel-top`;
  const towelBottomId = `${id}-towel-bottom`;

  return (
    <div className="absolute inset-x-0 bottom-0 h-[112px]">
      <div className="absolute inset-x-0 -top-4 h-4 bg-[linear-gradient(180deg,rgba(90,60,30,0)_0%,rgba(90,60,30,0.12)_100%)] dark:bg-[linear-gradient(180deg,rgba(0,0,0,0)_0%,rgba(0,0,0,0.35)_100%)]" />
      <svg
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[calc(100%-20px)] w-full"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={woodId} x1="0" x2="0" y1="0" y2="1">
            <stop
              offset="0"
              className="[stop-color:#d5b98d] dark:[stop-color:#4b3524]"
            />
            <stop
              offset="0.12"
              className="[stop-color:#e4cca4] dark:[stop-color:#5e432d]"
            />
            <stop
              offset="1"
              className="[stop-color:#dcc196] dark:[stop-color:#3f2c1e]"
            />
          </linearGradient>
          <filter id={grainId} x="0" y="0" width="100%" height="100%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.004 0.16"
              numOctaves="3"
              seed="11"
            />
            <feColorMatrix values="0 0 0 0 0.45  0 0 0 0 0.3  0 0 0 0 0.16  0 0 0 0.55 -0.1" />
          </filter>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${woodId})`} />
        <rect
          width="100%"
          height="100%"
          filter={`url(#${grainId})`}
          className="opacity-60 dark:opacity-80"
        />
        <rect
          width="100%"
          height="2"
          className="fill-[#b8976a] dark:fill-[#2a1d13]"
        />
        <rect
          y="2"
          width="100%"
          height="1.5"
          className="fill-[#f3e3c6]/70 dark:fill-[#8a6a4a]/40"
        />
      </svg>
      {/* 天板の手前の木口と、その下の壁と同じ色に塗った戸棚。画面の下端を壁の色に揃える。 */}
      <div className="absolute inset-x-0 bottom-[13px] h-[7px] bg-[linear-gradient(180deg,#e9d4ae_0%,#c9a675_30%,#b48d5b_100%)] dark:bg-[linear-gradient(180deg,#6a4c33_0%,#3d2a1c_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-[13px] bg-[linear-gradient(180deg,#d9ccb6_0%,#efe6d5_70%)] dark:bg-[linear-gradient(180deg,#1c1611_0%,#2b231c_80%)]" />

      {/* 柚子と苺。 */}
      <svg
        aria-hidden="true"
        viewBox="0 0 100 56"
        className="absolute bottom-7 left-2 w-[88px] opacity-90 dark:opacity-70"
      >
        <defs>
          <radialGradient id={yuzuId} cx="0.38" cy="0.35" r="0.7">
            <stop offset="0" stopColor="#fff2a0" />
            <stop offset="0.55" stopColor="#efc93a" />
            <stop offset="1" stopColor="#c7951b" />
          </radialGradient>
          <radialGradient id={berryId} cx="0.35" cy="0.3" r="0.8">
            <stop offset="0" stopColor="#f2626a" />
            <stop offset="0.6" stopColor="#cf2f3a" />
            <stop offset="1" stopColor="#8f1620" />
          </radialGradient>
        </defs>
        <g className="fill-[#6b4a26]/25 dark:fill-black/40">
          <ellipse cx="64" cy="50" rx="17" ry="3.6" />
          <ellipse cx="24" cy="51" rx="10" ry="2.6" />
          <ellipse cx="40" cy="52" rx="9" ry="2.4" />
        </g>
        <circle cx="64" cy="34" r="16" fill={`url(#${yuzuId})`} />
        <g fill="#c99a20" fillOpacity="0.45">
          <circle cx="58" cy="30" r="0.8" />
          <circle cx="70" cy="38" r="0.8" />
          <circle cx="62" cy="42" r="0.7" />
          <circle cx="72" cy="28" r="0.7" />
          <circle cx="54" cy="38" r="0.7" />
        </g>
        <path
          d="M64 18.5 C66 14 72 12.6 76 14.4 C73 18.6 68 19.6 64 18.5 Z"
          fill="#5f8a36"
        />
        <path d="M64 19 L63 16" stroke="#5a4020" strokeWidth="1.2" />
        <path
          d="M24 34 C18 34 14.5 38 16.5 43.5 C18.5 48.5 22 51 24 51 C26 51 29.5 48.5 31.5 43.5 C33.5 38 30 34 24 34 Z"
          fill={`url(#${berryId})`}
        />
        <path
          d="M40 38 C34.5 38 31.5 41.5 33.2 46.5 C35 50.6 38.2 52.6 40 52.6 C41.8 52.6 45 50.6 46.8 46.5 C48.5 41.5 45.5 38 40 38 Z"
          fill={`url(#${berryId})`}
        />
        <g fill="#ffe7a3" fillOpacity="0.85">
          <circle cx="21" cy="40" r="0.6" />
          <circle cx="26.5" cy="39.5" r="0.6" />
          <circle cx="23.5" cy="45" r="0.6" />
          <circle cx="28" cy="44.5" r="0.6" />
          <circle cx="37.5" cy="44" r="0.55" />
          <circle cx="42.5" cy="43.5" r="0.55" />
          <circle cx="40" cy="48.5" r="0.55" />
        </g>
        <path
          d="M18.5 35.5 L21.5 33 L24 35 L26.5 33 L29.5 35.5 L26 36.4 L24 35.6 L22 36.4 Z"
          fill="#4f8a32"
        />
        <path
          d="M34.5 39.4 L37.4 37 L40 38.8 L42.6 37 L45.5 39.4 L42 40.3 L40 39.6 L38 40.3 Z"
          fill="#4f8a32"
        />
      </svg>

      {/* たたんだふきんと木べら。 */}
      <svg
        aria-hidden="true"
        viewBox="0 0 120 50"
        className="absolute right-1 bottom-6 w-[104px] opacity-90 dark:opacity-65"
      >
        <defs>
          <clipPath id={towelTopId}>
            <path d={TOWEL_TOP_PATH} />
          </clipPath>
          <clipPath id={towelBottomId}>
            <path d={TOWEL_BOTTOM_PATH} />
          </clipPath>
        </defs>
        <ellipse
          cx="64"
          cy="45.5"
          rx="46"
          ry="3.6"
          className="fill-[#6b4a26]/22 dark:fill-black/40"
        />
        <path
          d="M6 40.5 C30 40.8 60 41.6 90 42.6"
          fill="none"
          stroke="#b98d55"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <ellipse cx="9" cy="40.2" rx="8" ry="3.4" fill="#c79b63" />
        <ellipse cx="8.4" cy="39.6" rx="5.4" ry="1.9" fill="#b2844d" />
        <path d={TOWEL_BOTTOM_PATH} fill="#ece3d1" />
        <g
          clipPath={`url(#${towelBottomId})`}
          fill="#3d5b8f"
          fillOpacity="0.68"
        >
          <rect x="20" y="37.6" width="92" height="1.6" />
          <rect x="20" y="40.4" width="92" height="0.8" />
        </g>
        <path d={TOWEL_TOP_PATH} fill="#f8f3ea" />
        <g clipPath={`url(#${towelTopId})`} fill="#3d5b8f" fillOpacity="0.72">
          <rect x="18" y="19" width="92" height="1.6" />
          <rect x="18" y="21.8" width="92" height="0.8" />
        </g>
        <path
          d="M23.5 25 C21.6 29.5 23.6 33 29 33.6"
          fill="none"
          stroke="#cdbfa4"
          strokeWidth="1.1"
          strokeLinecap="round"
        />
        <path
          d="M30 33.8 L102 33.8"
          fill="none"
          stroke="#d6cab3"
          strokeWidth="0.9"
        />
      </svg>
    </div>
  );
}
