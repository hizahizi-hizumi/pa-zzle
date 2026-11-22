import { cn } from "@/lib/utils";

// 塗り壁のざらつき。ラスター画像を使わず、SVG のノイズで描く。
const plasterImage = `url("data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='2' seed='9'/><feColorMatrix values='0 0 0 0 0.3  0 0 0 0 0.32  0 0 0 0 0.3  0 0 0 0.5 0'/></filter><rect width='160' height='160' filter='url(#n)'/></svg>",
)}")`;

/** 化学室の壁の色。遊び方で、プレイ画面の知らせを本番と同じ見た目で描くときも、この色の上に置く。 */
export const waterSortGroundClassName = "bg-[#d9e1da] dark:bg-[#161d21]";

/**
 * 放課後の化学室の壁と窓。ライトは昼の光が差す窓、ダークは日が落ちた窓と蛍光灯の部屋。
 * 実験台と流しの戸棚は、試験管立ての位置に合わせて盤面が描く。
 */
export function WaterSortGround() {
  return (
    <div
      className={cn(
        "relative size-full overflow-hidden",
        waterSortGroundClassName,
      )}
    >
      {/* 壁 */}
      <div className="absolute inset-0 bg-linear-to-b from-[#e6ece4] via-[#dfe6de] to-[#d6ded6] dark:from-[#1d2629] dark:via-[#1a2226] dark:to-[#161d21]" />
      <div
        className="absolute inset-0 opacity-[0.35] dark:opacity-25"
        style={{ backgroundImage: plasterImage }}
      />
      {/* 窓 */}
      <div className="absolute inset-x-[4%] top-0 h-[44%] sm:inset-x-[12%]">
        <div className="absolute inset-0 rounded-b-[3px] bg-[#f2f0e8] shadow-[0_6px_18px_rgba(60,70,60,0.18)] dark:bg-[#2a3237] dark:shadow-[0_6px_18px_rgba(0,0,0,0.4)]" />
        <div className="absolute inset-x-[10px] top-0 bottom-[14px] overflow-hidden">
          {/* 空 */}
          <div className="absolute inset-0 bg-linear-to-b from-[#f4f9fb] via-[#eef6f6] to-[#eef0dc] dark:from-[#141c38] dark:via-[#3b3a63] dark:to-[#d08a6e]" />
          {/* 校庭の木立（ぼかして奥に置く） */}
          <div className="absolute inset-x-[-10%] bottom-[-14%] h-[40%] blur-[10px]">
            <div className="absolute left-[2%] bottom-0 h-[90%] w-[34%] rounded-full bg-[#c6dcc0] dark:bg-[#141821]" />
            <div className="absolute left-[28%] bottom-0 h-[70%] w-[30%] rounded-full bg-[#d2e3c8] dark:bg-[#171b25]" />
            <div className="absolute right-[4%] bottom-0 h-[100%] w-[40%] rounded-full bg-[#bfd8bb] dark:bg-[#12161e]" />
          </div>
          {/* 昼の光のにじみ */}
          <div className="absolute -top-1/4 left-[8%] h-[80%] w-[55%] rounded-full bg-white/70 blur-2xl dark:bg-[#f2b48a]/0" />
          {/* 窓枠の桟 */}
          <div className="absolute inset-y-0 left-1/2 w-[7px] -translate-x-1/2 bg-[#ebe8de] shadow-[1px_0_2px_rgba(60,60,50,0.18)] dark:bg-[#262d32]" />
          <div className="absolute inset-y-0 left-1/2 w-px translate-x-[3px] bg-[#c9c5b8] dark:bg-[#11161a]" />
          <div className="absolute inset-x-0 top-[38%] h-[5px] bg-[#ebe8de] shadow-[0_1px_2px_rgba(60,60,50,0.15)] dark:bg-[#262d32]" />
          {/* ガラスの映り込み */}
          <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent_30%,rgba(255,255,255,0.35)_38%,transparent_46%,transparent_60%,rgba(255,255,255,0.2)_64%,transparent_68%)] dark:bg-[linear-gradient(115deg,transparent_30%,rgba(255,255,255,0.05)_38%,transparent_46%)]" />
        </div>
        {/* 窓台 */}
        <div className="absolute inset-x-[-6px] bottom-0 h-[14px] rounded-[2px] bg-linear-to-b from-[#f7f5ee] to-[#d9d5c8] shadow-[0_4px_8px_rgba(60,60,50,0.2)] dark:from-[#343c42] dark:to-[#22292e] dark:shadow-[0_4px_8px_rgba(0,0,0,0.45)]" />
      </div>
      {/* 窓から部屋へ差し込む昼の光／蛍光灯の白い明かり */}
      <div className="absolute top-[30%] left-[-20%] h-[70%] w-[140%] origin-top-left -rotate-[8deg] blur-2xl bg-[linear-gradient(180deg,rgba(255,252,238,0.38),rgba(255,252,238,0)_75%)] dark:bg-[linear-gradient(180deg,rgba(210,230,255,0.05),rgba(210,230,255,0)_70%)]" />
      <div className="absolute inset-x-0 top-0 h-[3px] bg-transparent dark:bg-[#cfe3f0]/10 dark:shadow-[0_0_40px_10px_rgba(200,225,245,0.08)]" />
    </div>
  );
}
