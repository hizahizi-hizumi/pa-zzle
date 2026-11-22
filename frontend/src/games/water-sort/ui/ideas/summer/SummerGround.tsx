import { Fireflies } from "@/games/water-sort/ui/ideas/summer/SummerGround/Fireflies";
import { Floor } from "@/games/water-sort/ui/ideas/summer/SummerGround/Floor";
import { MorningGlory } from "@/games/water-sort/ui/ideas/summer/SummerGround/MorningGlory";
import { MosquitoCoil } from "@/games/water-sort/ui/ideas/summer/SummerGround/MosquitoCoil";
import { Sudare } from "@/games/water-sort/ui/ideas/summer/SummerGround/Sudare";

// ブランドの帯（`BrandIdentityHeader` の compact）と同じ高さを鴨居にし、帯の単色と地の上端をつなげる。
const LINTEL_HEIGHT = "calc(1.75rem + env(safe-area-inset-top))";
const SUDARE_BOTTOM = `calc(${LINTEL_HEIGHT} + 60px)`;
const FLOOR_TOP = `calc(${LINTEL_HEIGHT} + 72px)`;

// 陽はすだれ越しに奥の左から差し、板の上に斜めの陽だまりと、すだれの細い影を落とす。
const sunBeamStyle = {
  backgroundImage:
    "repeating-linear-gradient(to bottom, rgba(255,248,226,0) 0 6px, rgba(120,82,38,0.12) 6px 9px), linear-gradient(to bottom, rgba(255,247,222,0.75), rgba(255,244,214,0.35))",
  maskImage:
    "linear-gradient(112deg, transparent 6%, #000 24%, #000 54%, transparent 74%)",
  WebkitMaskImage:
    "linear-gradient(112deg, transparent 6%, #000 24%, #000 54%, transparent 74%)",
} as const;

const sunBeamFadeStyle = {
  maskImage: "linear-gradient(to bottom, #000 0%, #000 30%, transparent 92%)",
  WebkitMaskImage:
    "linear-gradient(to bottom, #000 0%, #000 30%, transparent 92%)",
} as const;

export function SummerGround() {
  return (
    <div className="relative size-full overflow-hidden bg-[#b38f63] dark:bg-[#16120f]">
      <div className="absolute inset-x-0 bottom-0" style={{ top: FLOOR_TOP }}>
        <Floor />
        <div className="absolute inset-0 dark:hidden" style={sunBeamFadeStyle}>
          <div
            className="absolute -inset-x-[10%] inset-y-0"
            style={sunBeamStyle}
          />
        </div>
        {/* 夜は、縁側の灯りが左奥から板を照らす。 */}
        <div
          className="absolute inset-0 hidden dark:block"
          style={{
            background:
              "radial-gradient(ellipse 90% 75% at 8% 0%, rgba(255,170,84,0.34), rgba(255,170,84,0.12) 50%, transparent 85%)",
          }}
        />
      </div>
      {/* すだれの下から見える、明るい庭（夜は暗い庭） */}
      <div
        className="absolute inset-x-0 bg-[linear-gradient(to_bottom,#fbf7dc,#e6efc0_55%,#c9dd9c)] dark:bg-[linear-gradient(to_bottom,#1d2238,#1b2a2a_60%,#1a2420)]"
        style={{ top: SUDARE_BOTTOM, height: "12px" }}
      >
        <Fireflies />
      </div>
      {/* 縁側の框 */}
      <div
        className="absolute inset-x-0 h-[6px] bg-[linear-gradient(to_bottom,#f2dfbc,#c6a273_40%,#9a774b)] shadow-[0_2px_3px_rgba(80,50,20,0.25)] dark:bg-[linear-gradient(to_bottom,#5a4635,#33261c_40%,#1c140e)] dark:shadow-[0_2px_3px_rgba(0,0,0,0.5)]"
        style={{ top: `calc(${FLOOR_TOP} - 4px)` }}
      />
      <div
        className="absolute inset-x-0"
        style={{ top: LINTEL_HEIGHT, height: "60px" }}
      >
        <Sudare />
        {/* 夜は、縁側の灯りがすだれの左を照らす。 */}
        <div className="absolute inset-0 hidden bg-[radial-gradient(ellipse_60%_140%_at_6%_100%,rgba(255,168,80,0.22),transparent_70%)] dark:block" />
        {/* すだれの裾を留める布の縁 */}
        <div className="absolute inset-x-0 bottom-0 h-[3px] bg-[#6b4a2a] opacity-80 dark:bg-[#0c0907]" />
      </div>
      {/* 鴨居 */}
      <div
        className="absolute inset-x-0 top-0 bg-[#b38f63] shadow-[0_2px_4px_rgba(70,45,18,0.35)] dark:bg-[#16120f] dark:shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
        style={{ height: LINTEL_HEIGHT }}
      />
      <MorningGlory />
      <MosquitoCoil />
    </div>
  );
}
