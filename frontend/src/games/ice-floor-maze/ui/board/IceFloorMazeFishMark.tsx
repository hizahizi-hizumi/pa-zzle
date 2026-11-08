/** 氷原案のゴール。ペンギンが目指す魚を氷面に刻み、装飾ではなく目的を示す。 */
export function IceFloorMazeFishMark() {
  return (
    <g data-goal-fish="">
      <circle r=".425" fill="#ecfdf9" opacity=".8" />
      <circle r=".355" fill="#246d88" stroke="#95d6d8" strokeWidth=".042" />
      <g transform="rotate(-30)">
        <path
          d="M.18 -.06 L.37 -.22 L.37 .22 L.18 .06Z"
          fill="#ffbc65"
          stroke="#fff0cb"
          strokeWidth=".024"
          strokeLinejoin="round"
        />
        <path
          d="M-.28 0 Q-.14 -.22 .095 -.17 Q.23 -.13 .26 0 Q.23 .13 .095 .17 Q-.14 .22 -.28 0Z"
          fill="#ffcf7b"
          stroke="#fff7db"
          strokeWidth=".029"
        />
        <path d="M-.015 -.16 L.055 -.24 L.13 -.12" fill="#ffb052" />
        <path d="M.015 .16 L.085 .23 L.15 .1" fill="#ffb052" />
        <circle cx="-.176" cy="-.037" r=".034" fill="#583f31" />
        <path
          d="M.06 -.115 Q.16 0 .06 .115"
          stroke="#f5a84f"
          strokeWidth=".024"
          fill="none"
          strokeLinecap="round"
        />
      </g>
    </g>
  );
}
