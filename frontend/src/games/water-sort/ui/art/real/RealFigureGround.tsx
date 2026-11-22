import {
  cssImage,
  SURFACE_GRAIN_URI,
} from "@/games/water-sort/ui/art/real/real-texture";

const grainImage = cssImage(SURFACE_GRAIN_URI);

/**
 * 遊び方の図の試験管の後ろに敷く、プレイ画面と同じ壁と黒い実験台。試験管の底を、見下ろした天板の上の面の奥行きの中ほどに立てる。
 * 図の箱（下の端が試験管の箱の下の端）の最初の子に置き、試験管の幅は `--water-sort-figure-bottle` から読む。
 * 持ち上げた試験管と試験管ばさみが少し上へ出ても地の中に収まるよう、試験管の上と左右に余白を取る。
 */
export function RealFigureGround() {
  return (
    <span
      aria-hidden="true"
      data-lab-figure-ground=""
      className="pointer-events-none absolute -inset-x-[calc(var(--water-sort-figure-bottle)*0.3)] bottom-[calc(var(--water-sort-figure-bottle)*-0.16)] h-[calc(var(--water-sort-figure-bottle)*3.34)] overflow-hidden rounded-md bg-linear-to-b from-[#cdd4ca] to-[#b9c1b7] dark:from-[#273034] dark:to-[#1c2326]"
    >
      <span
        className="absolute inset-0 opacity-20 mix-blend-overlay dark:opacity-15"
        style={{ backgroundImage: grainImage }}
      />
      {/* 天板と壁の境の、光の届きにくい隅 */}
      <span className="absolute inset-x-0 bottom-[calc(var(--water-sort-figure-bottle)*0.34)] h-3 bg-linear-to-t from-[rgba(30,36,32,0.25)] to-transparent dark:from-[rgba(0,0,0,0.4)]" />
      {/* 天板の上の面。つやのある黒い樹脂に、左上の奥の窓がぼけて映る。 */}
      <span className="absolute inset-x-0 bottom-[calc(var(--water-sort-figure-bottle)*0.12)] h-[calc(var(--water-sort-figure-bottle)*0.22)] bg-linear-to-b from-[#2a2d2f] to-[#16181a] dark:from-[#17191b] dark:to-[#0a0b0c]">
        <span className="absolute inset-y-0 left-[4%] w-[40%] bg-linear-to-b from-[rgba(232,240,240,0.18)] to-transparent blur-[2px] dark:from-[rgba(200,150,130,0.08)]" />
      </span>
      {/* 天板の前の縁。上の角だけが光を受ける。 */}
      <span className="absolute inset-x-0 bottom-0 h-[calc(var(--water-sort-figure-bottle)*0.12)] border-t border-t-white/20 bg-[#0d0e0f] dark:border-t-white/10 dark:bg-[#060707]" />
    </span>
  );
}
