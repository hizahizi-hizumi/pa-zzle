import {
  cssImage,
  SURFACE_GRAIN_URI,
} from "@/games/water-sort/ui/art/real/real-texture";

const grainImage = cssImage(SURFACE_GRAIN_URI);

/**
 * 化学室の奥の壁と、左上の窓。光はこの窓からだけ入る（ダークは日の落ちた窓）。
 * 壁は窓の光を直接受けない面なので、窓よりずっと暗い。窓の桟と枠は、明るい空の前で影になる。
 * 窓台の上の面は、見下ろした分だけ細く見え、窓からの光を受けて明るい。
 * 実験台と流しの戸棚は、試験管立ての位置に合わせて盤面が描く。
 */
export function RealGround() {
  return (
    <div className="relative size-full overflow-hidden bg-[#c2cac0] dark:bg-[#1e2528]">
      {/* 壁。天井から返る光で上がわずかに明るい。 */}
      <div className="absolute inset-0 bg-linear-to-b from-[#cdd4ca] via-[#c3cbc1] to-[#b3bbb1] dark:from-[#273034] dark:via-[#20282b] dark:to-[#191f22]" />
      <div
        className="absolute inset-0 opacity-20 mix-blend-overlay dark:opacity-15"
        style={{ backgroundImage: grainImage }}
      />
      {/* 窓 */}
      <div className="absolute top-0 left-[-6%] h-[41%] w-[66%] sm:left-[4%] sm:w-[50%]">
        {/* 窓の下の壁に落ちる、窓台の陰 */}
        <div className="absolute inset-x-[-2%] -bottom-6 h-6 bg-linear-to-b from-[rgba(40,48,42,0.22)] to-transparent dark:from-[rgba(0,0,0,0.35)]" />
        {/* 枠 */}
        <div className="absolute inset-0 bg-[#aab1a8] dark:bg-[#2c3337]" />
        <div className="absolute inset-x-[12px] top-0 bottom-[16px] overflow-hidden">
          {/* 空（明るすぎて白く飛ぶ） */}
          <div className="absolute inset-0 bg-linear-to-b from-[#e7f1f6] via-[#f7fafa] to-[#fbfbf4] dark:from-[#1b2340] dark:via-[#3b3a5e] dark:to-[#b97a62]" />
          {/* 校庭の木立（ピントが合わずにぼける） */}
          <div className="absolute inset-x-[-10%] bottom-[-12%] h-[42%] blur-[12px]">
            <div className="absolute bottom-0 left-[0%] h-[85%] w-[36%] rounded-full bg-[#b9cdb2] dark:bg-[#141821]" />
            <div className="absolute bottom-0 left-[30%] h-[62%] w-[30%] rounded-full bg-[#c9d8c0] dark:bg-[#171b25]" />
            <div className="absolute right-[2%] bottom-0 h-[95%] w-[42%] rounded-full bg-[#b3c9ad] dark:bg-[#12161e]" />
          </div>
          {/* 桟。明るい空の前で影になり、縁には空の光がにじむ。 */}
          <div className="absolute inset-y-0 left-1/2 w-[7px] -translate-x-1/2 bg-[linear-gradient(90deg,#c9cec6,#9aa198_35%,#9aa198_65%,#c9cec6)] dark:bg-[linear-gradient(90deg,#3a4146,#262c30_35%,#262c30_65%,#3a4146)]" />
          <div className="absolute inset-x-0 top-[38%] h-[6px] bg-[linear-gradient(180deg,#d3d7cf,#9aa198_40%,#9aa198_70%,#c9cec6)] dark:bg-[linear-gradient(180deg,#3a4146,#262c30_40%,#262c30_70%,#3a4146)]" />
          {/* 外の光が枠の内側へにじむ */}
          <div className="absolute inset-0 shadow-[inset_0_0_10px_2px_rgba(255,255,255,0.55)] dark:shadow-[inset_0_0_10px_2px_rgba(200,140,110,0.12)]" />
        </div>
        {/* 窓台。上の面は窓の光を受けて明るく、正面は部屋の側を向いて暗い。 */}
        <div className="absolute inset-x-[-8px] bottom-[10px] h-[6px] bg-linear-to-b from-[#f3f2ea] to-[#dddcd2] dark:from-[#4a4f52] dark:to-[#3a3f42]" />
        <div className="absolute inset-x-[-8px] bottom-0 h-[10px] bg-linear-to-b from-[#b9bcb2] to-[#a2a59b] dark:from-[#2a3034] dark:to-[#22282b]" />
        {/* 枠と窓台の塗りにも、壁と同じざらつき */}
        <div
          className="absolute inset-x-[-8px] inset-y-0 opacity-20 mix-blend-overlay dark:opacity-15"
          style={{ backgroundImage: grainImage }}
        />
      </div>
    </div>
  );
}
