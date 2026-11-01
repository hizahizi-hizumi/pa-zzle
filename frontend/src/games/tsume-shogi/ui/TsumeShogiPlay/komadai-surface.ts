import type { CSSProperties } from "react";
import { tsumeShogiRealToneClassNames as realTone } from "@/games/tsume-shogi/ui/board/real/real-tone";
import { tsumeShogiWoodTextures } from "@/games/tsume-shogi/ui/board/real/wood-texture";
import { tsumeShogiBoardStyle } from "@/games/tsume-shogi/ui/board-style";
import { tsumeShogiToneClassNames } from "@/games/tsume-shogi/ui/tsume-shogi-tone";
import { cn } from "@/lib/utils";

/** 案R の駒台の、手前にのぞかせる木口の高さ。 */
const REAL_KOMADAI_SIDE = "6px";

/**
 * 駒台の面。案ごとに形を変える。
 * - `current`: 角丸の淡い木の帯。
 * - `quiet`: 盤の罫線と同じ細い線で囲うだけの、角の立った枠。地は画面と同じ。
 * - `real`: 盤と同じ系統で一段濃い木の台。角を立て、手前に木口をのぞかせ、盤と同じ左上の光で影を落とす。
 *   盤の木の左右の端にそろえる（盤の右の段の列の分だけ右を空ける）。
 */
export const komadaiClassName = cn(
  {
    current: "rounded-md",
    quiet: "",
    real: cn(
      "h-full w-[calc(100%-var(--board-rank-band)+var(--board-frame))] pb-[6px]",
      realTone.komadaiTopFallback,
      realTone.komadaiShadow,
    ),
  }[tsumeShogiBoardStyle],
  tsumeShogiToneClassNames.komadai,
);

export const komadaiStyle: CSSProperties | undefined =
  tsumeShogiBoardStyle === "real"
    ? {
        backgroundImage: [
          "linear-gradient(rgb(40 20 5/0.2), rgb(40 20 5/0.45))",
          `url("${tsumeShogiWoodTextures.komadaiSide}")`,
          `url("${tsumeShogiWoodTextures.komadaiTop}")`,
        ].join(", "),
        backgroundPosition: "bottom, bottom, top",
        backgroundSize: `100% ${REAL_KOMADAI_SIDE}, 100% ${REAL_KOMADAI_SIDE}, 100% calc(100% - ${REAL_KOMADAI_SIDE})`,
        backgroundRepeat: "no-repeat",
      }
    : undefined;

/** 持駒のボタンの角。案S・案R では盤の升と同じく角を立てる。 */
export const handPieceRadiusClassName =
  tsumeShogiBoardStyle === "current" ? "rounded-md" : "rounded-[2px]";

/** 駒台に書く文字の色。 */
export const komadaiLabelClassName = tsumeShogiToneClassNames.coordinate;

/**
 * 駒台の「持駒」の札と、持駒が無いときの「なし」を見せるか。
 * 案R では本物の駒台に札は無いので見せず、「なし」は読み上げにだけ残す。
 */
export const showsKomadaiLabel = tsumeShogiBoardStyle !== "real";

/** 持駒の枚数の色。案R では駒に重ねず、駒台の木の上に墨で書く。 */
export const handCountClassName =
  tsumeShogiBoardStyle === "real" ? realTone.handCount : "";
