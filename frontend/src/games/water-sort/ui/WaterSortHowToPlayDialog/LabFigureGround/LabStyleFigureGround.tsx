/**
 * 遊び方の図の試験管の後ろに敷く、理科室の壁と実験台の縁。試験管のガラスはプレイ画面の壁と実験台に合わせた色なので、
 * 遊び方の白い面や例の面の上では薄く見える。プレイ画面と同じ地を後ろに敷き、ガラスと液を見分けやすくする。
 * 試験管を1段に並べた図の箱（下の端が試験管の箱の下の端）の中で、最初の子に置く。試験管の幅は `--water-sort-figure-bottle` から読む。
 * 持ち上げた試験管と試験管ばさみが少し上へ出ても地の中に収まるよう、試験管の上と左右に余白を取る。
 */
export function LabStyleFigureGround() {
  return (
    <span
      aria-hidden="true"
      data-lab-figure-ground=""
      className="pointer-events-none absolute -inset-x-[calc(var(--water-sort-figure-bottle)*0.3)] bottom-[calc(var(--water-sort-figure-bottle)*-0.12)] h-[calc(var(--water-sort-figure-bottle)*3.3)] overflow-hidden rounded-md bg-linear-to-b from-[#e2e9e1] to-[#cfd8d0] dark:from-[#1d2629] dark:to-[#161d21]"
    >
      {/* 実験台の天板の縁。試験管の底をこの上に立てる。 */}
      <span className="absolute inset-x-0 bottom-0 h-[calc(var(--water-sort-figure-bottle)*0.2)] bg-linear-to-b from-[#3a3f42] to-[#15171a] dark:from-[#22272a] dark:to-[#0c0d0f]" />
    </span>
  );
}
