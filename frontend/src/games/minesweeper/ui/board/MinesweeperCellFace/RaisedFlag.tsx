/** 盤面の立体感に合わせ、布・支柱・台座を一つの駒として描く。 */
export function RaisedFlag() {
  return (
    <svg viewBox="0 0 32 32" className="size-[74%]" aria-hidden="true">
      <path
        d="M11 6 26 9.5 11 17Z"
        transform="translate(0 1)"
        fill="#19283a"
        opacity=".18"
      />
      <path
        d="M10 5v22"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M11 6 26 9.5 11 17Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M6 27h11"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
