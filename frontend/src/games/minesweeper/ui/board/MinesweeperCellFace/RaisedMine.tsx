/** 丸い本体と突起で旗との形の違いを保つ。 */
export function RaisedMine() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="size-[58%] drop-shadow-[0_1px_1px_#0003]"
      aria-hidden="true"
    >
      <path
        d="M16 2v5M16 25v5M2 16h5M25 16h5M6 6l4 4M22 22l4 4M26 6l-4 4M10 22l-4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <circle cx="16" cy="16" r="8.5" fill="currentColor" />
      <circle cx="13" cy="12.5" r="2.1" fill="white" opacity=".55" />
    </svg>
  );
}
