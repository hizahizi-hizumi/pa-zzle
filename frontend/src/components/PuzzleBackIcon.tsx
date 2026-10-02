/**
 * 戻る導線のアイコン。lucide の chevron-left に、淡いパズルピースを寄り添わせる。
 * 線幅・座標・凸凹の比率は lucide の仕様と puzzle アイコンに合わせ、ピースの面だけを例外として塗る。
 * 線だけでは山形との隙間2pxを保ったままピースの凸凹を24×24に収められないため。
 */
export function PuzzleBackIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path
        d="M9 12L15 6A1.414 1.414 0 0 1 17 6L17.917 6.917A0.75 0.75 0 0 0 19.177 6.562A1.875 1.875 0 1 1 21.438 8.823A0.75 0.75 0 0 0 21.083 10.083L22 11A1.414 1.414 0 0 1 22 13L21.083 13.917A0.75 0.75 0 0 1 19.823 13.562A1.875 1.875 0 1 0 17.562 15.823A0.75 0.75 0 0 1 17.917 17.083L17 18A1.414 1.414 0 0 1 15 18L9 12Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="none"
      />
      <path d="m10 18-6-6 6-6" />
    </svg>
  );
}
