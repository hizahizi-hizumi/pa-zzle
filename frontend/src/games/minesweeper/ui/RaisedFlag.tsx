/**
 * `cell` は盤面のマスに立てる旗、`control` は盤の下の操作のアイコン、`inline` は文の中に置く印。
 */
export type RaisedFlagSize = "cell" | "control" | "inline";

const SIZE_CLASS_NAMES = {
  cell: "size-[74%]",
  control: "size-6",
  inline: "mx-0.5 inline size-4 align-text-bottom",
} satisfies Record<RaisedFlagSize, string>;

type RaisedFlagProps = {
  size: RaisedFlagSize;
};

/**
 * 盤面の立体感に合わせ、布・支柱・台座を一つの駒として描く旗。色は `currentColor` で受ける。
 * 盤面に置く旗と、旗を置く入力へ切り替える操作で同じ形にする。
 */
export function RaisedFlag({ size }: RaisedFlagProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={SIZE_CLASS_NAMES[size]}
      aria-hidden="true"
    >
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
