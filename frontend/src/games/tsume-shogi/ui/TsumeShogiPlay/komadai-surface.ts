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
 * - `real`: 盤と同じ材で一段暗い木の台。縁を一段高い枠にし、角を立て、手前に同じ材の木口をのぞかせる。
 *   盤の木の左右の端にそろえ、盤との間は空けずに盤の落ち影の下へ差し込む。
 */
export const komadaiClassName = cn(
  {
    current: "rounded-md",
    quiet: "",
    real: cn(
      "mx-auto -mt-1 h-[calc(100%+0.25rem)] w-[calc(100%-2*var(--board-wood-inset))] pb-[6px]",
      realTone.komadaiTopFallback,
      realTone.komadaiShadow,
    ),
  }[tsumeShogiBoardStyle],
  tsumeShogiToneClassNames.komadai,
);

export const komadaiStyle: CSSProperties | undefined =
  tsumeShogiBoardStyle === "real"
    ? {
        // 木口（天面と同じ材で明度を下げる）、天面を一段暗くする層、天面の木目の順に重ねる。
        backgroundImage: [
          "linear-gradient(rgb(0 0 0/0.3), rgb(0 0 0/0.3))",
          `url("${tsumeShogiWoodTextures.komadaiTop}")`,
          "linear-gradient(rgb(0 0 0/0.08), rgb(0 0 0/0.08))",
          `url("${tsumeShogiWoodTextures.komadaiTop}")`,
        ].join(", "),
        backgroundPosition: "bottom, bottom, top, top",
        backgroundSize: `100% ${REAL_KOMADAI_SIDE}, 100% ${REAL_KOMADAI_SIDE}, 100% calc(100% - ${REAL_KOMADAI_SIDE}), 100% calc(100% - ${REAL_KOMADAI_SIDE})`,
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
